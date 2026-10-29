import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://hxdlndrlfqioxtufggcs.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_u8jBaZ2N8dpLl1vwiSRhnw_OmLLvv7C";
const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const css = document.createElement("style");
css.textContent = `
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
document.head.appendChild(css);

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

const userChip = document.createElement("div");
userChip.id = "fx-auth-user";
userChip.innerHTML = '<span id="fx-auth-user-label"></span><button id="fx-auth-logout" type="button">Cerrar sesión</button>';
document.body.appendChild(userChip);

const statusEl = document.getElementById("fx-auth-status");
const form = document.getElementById("fx-auth-form");
const emailEl = document.getElementById("fx-auth-email");
const passwordEl = document.getElementById("fx-auth-password");
let pendingAccessResolver = null;
let latestResult = null;
let heartbeatTimer = null;

function status(message) { statusEl.textContent = message || ""; }
function showPanel(message = "") {
  status(message);
  panel.style.display = "flex";
  emailEl.focus();
}
function hidePanel() { panel.style.display = "none"; }
function updateUserChip(session) {
  if (!session) {
    userChip.style.display = "none";
    return;
  }
  document.getElementById("fx-auth-user-label").textContent = session.user.email || "Sesión activa";
  userChip.style.display = "block";
}
function settleAccess(value) {
  if (pendingAccessResolver) {
    pendingAccessResolver(value);
    pendingAccessResolver = null;
  }
}

async function checkAccess() {
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  const session = sessionData?.session;
  if (sessionError || !session) {
    latestResult = null;
    updateUserChip(null);
    settleAccess(false);
    return false;
  }
  updateUserChip(session);
  const { data, error } = await client.rpc("record_my_heartbeat");
  if (error) {
    latestResult = null;
    status("No se pudo comprobar el acceso: " + error.message + "\\nRevisa que la función SQL se haya creado correctamente.");
    settleAccess(false);
    return false;
  }
  latestResult = data;
  if (data.role === "admin" || data.access_granted === true) {
    status(data.role === "admin" ? "Acceso de administrador autorizado." : "¡Acceso autorizado!");
    settleAccess(true);
    return true;
  }
  const start = data.wait_started_at ? new Date(data.wait_started_at) : new Date();
  const elapsed = Math.max(0, Date.now() - start.getTime());
  const remaining = Math.max(0, 7 * 24 * 60 * 60 * 1000 - elapsed);
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  status("Tu espera de 7 días está en curso. Tiempo aproximado restante: " + days + " días y " + hours + " horas.\nMantén esta página abierta y vuelve a comprobar periódicamente.");
  settleAccess(false);
  return false;
}

function startHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  checkAccess();
  heartbeatTimer = setInterval(() => {
    if (document.visibilityState !== "hidden") checkAccess();
  }, 25000);
}

window.ensureFictionAccess = async function () {
  const { data } = await client.auth.getSession();
  if (!data.session) {
    showPanel("Inicia sesión para comprobar si tienes acceso.");
    return await new Promise(resolve => { pendingAccessResolver = resolve; });
  }
  const allowed = await checkAccess();
  if (!allowed) showPanel(statusEl.textContent);
  return allowed;
};

form.addEventListener("submit", async event => {
  event.preventDefault();
  status("Iniciando sesión…");
  const { data, error } = await client.auth.signInWithPassword({
    email: emailEl.value.trim(),
    password: passwordEl.value
  });
  if (error) {
    status("No se pudo iniciar sesión: " + error.message);
    return;
  }
  hidePanel();
  updateUserChip(data.session);
  startHeartbeat();
  const allowed = await checkAccess();
  if (!allowed) showPanel(statusEl.textContent);
});

document.getElementById("fx-auth-signup").addEventListener("click", async () => {
  status("Creando cuenta…");
  const { data, error } = await client.auth.signUp({
    email: emailEl.value.trim(),
    password: passwordEl.value,
    options: { emailRedirectTo: "https://mariojr1317.github.io/fiction-express-2.0/" }
  });
  if (error) {
    status("No se pudo crear la cuenta: " + error.message);
    return;
  }
  if (!data.session) {
    status("Cuenta creada. Revisa tu correo y confirma la dirección antes de iniciar sesión.");
    return;
  }
  hidePanel();
  updateUserChip(data.session);
  startHeartbeat();
  const allowed = await checkAccess();
  if (!allowed) showPanel(statusEl.textContent);
});

document.getElementById("fx-auth-cancel").addEventListener("click", () => {
  hidePanel();
  settleAccess(false);
});
document.getElementById("fx-auth-logout").addEventListener("click", async () => {
  await client.auth.signOut();
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  latestResult = null;
  updateUserChip(null);
  showPanel("Sesión cerrada. Inicia sesión para continuar.");
});
client.auth.onAuthStateChange((_event, session) => {
  updateUserChip(session);
  if (session) startHeartbeat();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") checkAccess();
});

client.auth.getSession().then(({ data }) => {
  if (data.session) {
    updateUserChip(data.session);
    startHeartbeat();
  }
});
