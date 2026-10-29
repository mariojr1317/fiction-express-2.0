import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://hxdlndrlfqioxtufggcs.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_u8jBaZ2N8dpLl1vwiSRhnw_OmLLvv7C";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const style = document.createElement("style");
style.textContent = `
#fx-auth-panel{position:fixed;z-index:2147483646;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.72);font-family:Arial,sans-serif;padding:16px}
#fx-auth-card{background:#fff;color:#171717;width:min(420px,100%);padding:24px;border-radius:14px;box-shadow:0 10px 50px #0006}
#fx-auth-card h2{margin:0 0 8px;font-size:23px}
#fx-auth-card p{line-height:1.45}
#fx-auth-card input{box-sizing:border-box;width:100%;padding:12px;margin:6px 0;border:1px solid #bbb;border-radius:8px;font-size:16px}
#fx-auth-card button{padding:11px 14px;border:0;border-radius:8px;cursor:pointer;font-weight:600;margin:5px 5px 0 0}
#fx-auth-login{background:#1459c7;color:#fff} #fx-auth-signup{background:#e8eef9;color:#172d52}
#fx-auth-cancel{background:#eee;color:#222}
#fx-auth-status{font-size:14px;white-space:pre-wrap;color:#333;margin-top:12px}
#fx-auth-user{position:fixed;z-index:2147483645;bottom:10px;right:10px;background:#fff;color:#222;border:1px solid #ccc;border-radius:9px;padding:8px 10px;font:12px Arial,sans-serif;box-shadow:0 2px 10px #0002;display:none}
#fx-auth-user button{margin-left:8px}
`;
document.head.appendChild(style);

const panel = document.createElement("div");
panel.id = "fx-auth-panel";
panel.innerHTML = `
<div id="fx-auth-card" role="dialog" aria-modal="true" aria-labelledby="fx-auth-title">
<h2 id="fx-auth-title">Fiction Express 2.0</h2>
<p>Inicia sesión o crea una cuenta para comprobar tu acceso.</p>
<form id="fx-auth-form">
<input id="fx-auth-email" type="email" autocomplete="email" placeholder="Correo electrónico" required>
<input id="fx-auth-password" type="password" autocomplete="current-password" placeholder="Contraseña (mínimo 6 caracteres)" minlength="6" required>
<button id="fx-auth-login" type="submit">Iniciar sesión</button>
<button id="fx-auth-signup" type="button">Crear cuenta</button>
<button id="fx-auth-cancel" type="button">Cancelar</button>
</form>
<div id="fx-auth-status" aria-live="polite"></div>
</div>`;
document.body.appendChild(panel);

const chip = document.createElement("div");
chip.id = "fx-auth-user";
chip.innerHTML = '<span id="fx-auth-user-label"></span><button id="fx-auth-logout" type="button">Cerrar sesión</button>';
document.body.appendChild(chip);

const statusEl = document.getElementById("fx-auth-status");
const form = document.getElementById("fx-auth-form");
const emailEl = document.getElementById("fx-auth-email");
const passwordEl = document.getElementById("fx-auth-password");
let pendingOpen = null;
let heartbeatTimer = null;
let checking = false;

function setStatus(message) { statusEl.textContent = message || ""; }
function showPanel(message = "") { setStatus(message); panel.style.display = "flex"; }
function hidePanel() { panel.style.display = "none"; }
function updateChip(session) {
  chip.style.display = session ? "block" : "none";
  if (session) document.getElementById("fx-auth-user-label").textContent = session.user.email || "Sesión activa";
}
function openPending() {
  if (typeof pendingOpen === "function") {
    const action = pendingOpen;
    pendingOpen = null;
    hidePanel();
    action();
  }
}

async function checkAccess() {
  if (checking) return false;
  checking = true;
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const session = sessionData?.session;
    if (sessionError || !session) {
      updateChip(null);
      setStatus("Inicia sesión o crea una cuenta para continuar.");
      return false;
    }
    updateChip(session);
    const { data, error } = await supabase.rpc("record_my_heartbeat");
    if (error) {
      setStatus("No se pudo comprobar el acceso: " + error.message);
      return false;
    }
    if (data.role === "admin" || data.access_granted === true) {
      setStatus(data.role === "admin" ? "Acceso de administrador autorizado." : "¡Acceso autorizado!");
      openPending();
      return true;
    }
    const start = data.wait_started_at ? new Date(data.wait_started_at) : new Date();
    const remaining = Math.max(0, 7 * 86400000 - (Date.now() - start.getTime()));
    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    setStatus("Tu espera de 7 días está en curso. Tiempo aproximado restante: " + days + " días y " + hours + " horas.\nMantén esta página abierta. Si deja de enviar señales durante más de 90 segundos, la espera se reinicia.");
    return false;
  } finally {
    checking = false;
  }
}

function startHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  checkAccess();
  heartbeatTimer = setInterval(() => {
    if (document.visibilityState === "visible") checkAccess();
  }, 25000);
}

window.requestFictionAccess = async function (openAction) {
  pendingOpen = openAction;
  showPanel("Comprobando tu cuenta…");
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    setStatus("Inicia sesión o crea una cuenta para abrir este sitio.");
    emailEl.focus();
    return;
  }
  const allowed = await checkAccess();
  if (!allowed) showPanel(statusEl.textContent);
};

form.addEventListener("submit", async event => {
  event.preventDefault();
  setStatus("Iniciando sesión…");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailEl.value.trim(),
    password: passwordEl.value
  });
  if (error) {
    setStatus("No se pudo iniciar sesión: " + error.message);
    return;
  }
  updateChip(data.session);
  startHeartbeat();
  const allowed = await checkAccess();
  if (!allowed) showPanel(statusEl.textContent);
});

document.getElementById("fx-auth-signup").addEventListener("click", async () => {
  setStatus("Creando cuenta…");
  const { data, error } = await supabase.auth.signUp({
    email: emailEl.value.trim(),
    password: passwordEl.value,
    options: { emailRedirectTo: "https://mariojr1317.github.io/fiction-express-2.0/" }
  });
  if (error) {
    setStatus("No se pudo crear la cuenta: " + error.message);
    return;
  }
  if (!data.session) {
    setStatus("Cuenta creada. Revisa tu correo y confirma tu dirección; después vuelve e inicia sesión.");
    return;
  }
  updateChip(data.session);
  startHeartbeat();
  const allowed = await checkAccess();
  if (!allowed) showPanel(statusEl.textContent);
});

document.getElementById("fx-auth-cancel").addEventListener("click", () => {
  pendingOpen = null;
  hidePanel();
});
document.getElementById("fx-auth-logout").addEventListener("click", async () => {
  await supabase.auth.signOut();
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  pendingOpen = null;
  updateChip(null);
  showPanel("Sesión cerrada.");
});
supabase.auth.onAuthStateChange((_event, session) => {
  updateChip(session);
  if (session) startHeartbeat();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") checkAccess();
});
supabase.auth.getSession().then(({ data }) => {
  if (data.session) {
    updateChip(data.session);
    startHeartbeat();
  }
});
