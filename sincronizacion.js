/* Sincronización con Supabase: inicio de sesión por correo y un documento JSON por usuario.
   Los datos locales siguen siendo la fuente principal: la app funciona sin conexión. */
let clienteSupabase = null;
let sesion = null;
let sincronizando = false;
let sincronizacionPendiente = false;
let temporizadorSincronizacion = null;
let errorSincronizacion = "";

function sincronizacionConfigurada() {
  return typeof supabase !== "undefined" && typeof CONFIGURACION_SUPABASE !== "undefined"
    && CONFIGURACION_SUPABASE.url.startsWith("https://") && !CONFIGURACION_SUPABASE.url.includes("TU-PROYECTO");
}

/* Une dos versiones de los datos: por cada elemento gana la modificación más reciente,
   y un elemento eliminado no vuelve a aparecer salvo que se haya editado después. */
function fusionarDatos(local, remoto) {
  if (!remoto) return local;
  const eliminados = { ...(remoto.eliminados || {}) };
  for (const [id, momento] of Object.entries(local.eliminados || {})) {
    eliminados[id] = Math.max(eliminados[id] || 0, momento);
  }
  const resultado = { eliminados };
  for (const coleccion of COLECCIONES) {
    const porId = new Map();
    for (const item of [...(remoto[coleccion] || []), ...(local[coleccion] || [])]) {
      const actual = porId.get(item.id);
      if (!actual || (item.modificado || 0) >= (actual.modificado || 0)) porId.set(item.id, item);
    }
    resultado[coleccion] = [...porId.values()].filter((item) => !(item.id in eliminados) || (item.modificado || 0) > eliminados[item.id]);
  }
  return resultado;
}

async function iniciarSincronizacion() {
  if (!sincronizacionConfigurada()) return;
  clienteSupabase = supabase.createClient(CONFIGURACION_SUPABASE.url, CONFIGURACION_SUPABASE.clavePublica);
  clienteSupabase.auth.onAuthStateChange((evento, nuevaSesion) => {
    const recienConectado = !sesion && nuevaSesion;
    sesion = nuevaSesion;
    if (recienConectado) setTimeout(sincronizarAhora, 0); // no se llama a Supabase dentro de este aviso
    else render();
  });
}

function programarSincronizacion() {
  if (!sesion) return;
  clearTimeout(temporizadorSincronizacion);
  temporizadorSincronizacion = setTimeout(sincronizarAhora, 1500);
}

async function sincronizarAhora() {
  if (!sesion) return;
  if (sincronizando) { sincronizacionPendiente = true; return; }
  sincronizando = true;
  errorSincronizacion = "";
  try {
    const { data, error } = await clienteSupabase.from("datos_usuario").select("contenido").eq("usuario_id", sesion.user.id).maybeSingle();
    if (error) throw error;
    const antes = JSON.stringify(datos);
    datos = fusionarDatos(datos, data?.contenido);
    if (JSON.stringify(datos) !== antes) { guardarLocal(); render(); }
    const { error: errorEnvio } = await clienteSupabase.from("datos_usuario")
      .upsert({ usuario_id: sesion.user.id, contenido: datos, actualizado: new Date().toISOString() });
    if (errorEnvio) throw errorEnvio;
    guardarMeta({ ultimaSincronizacion: Date.now() });
  } catch (error) {
    console.error("Error de sincronización:", error);
    errorSincronizacion = "No se pudo sincronizar. Tus datos siguen guardados en este dispositivo.";
  } finally {
    sincronizando = false;
    if (vistaActual === "datos") render();
    if (sincronizacionPendiente) { sincronizacionPendiente = false; programarSincronizacion(); }
  }
}

function formularioInicioSesion() {
  abrirFormulario({
    titulo: "Iniciar sesión",
    mensaje: "Te enviamos un enlace por correo. Abrilo en este mismo navegador.",
    campos: [{ nombre: "email", etiqueta: "Correo electrónico", tipo: "email" }],
    textoBoton: "Enviar enlace",
    alGuardar: enviarEnlaceDeAcceso
  });
}

async function enviarEnlaceDeAcceso({ email }) {
  if (location.protocol === "file:") {
    mostrarAviso("Para iniciar sesión, la app tiene que abrirse desde una dirección web (https), no desde un archivo local.");
    return;
  }
  const { error } = await clienteSupabase.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
  mostrarAviso(error ? `No se pudo enviar el enlace: ${error.message}` : "Listo, revisá tu correo.");
}

async function cerrarSesion() {
  await clienteSupabase.auth.signOut();
  sesion = null;
  render();
}

function seccionSincronizacion() {
  let cuerpo;
  if (!sincronizacionConfigurada()) {
    cuerpo = `<p class="meta">La sincronización no está configurada. Completá <code>configuracion.js</code> con los datos de tu proyecto de Supabase.</p>`;
  } else if (!sesion) {
    cuerpo = `<p>Iniciá sesión para tener los mismos datos en el celular y en la computadora.</p>
      <button class="boton primario" data-accion="iniciar-sesion">Iniciar sesión</button>`;
  } else {
    const ultima = leerMeta().ultimaSincronizacion;
    const estado = sincronizando ? "Sincronizando…" : ultima ? `Última sincronización: ${new Date(ultima).toLocaleString("es-AR")}` : "Todavía sin sincronizar.";
    cuerpo = `<p>Conectado como <strong>${escaparHtml(sesion.user.email)}</strong>.</p>
      <p class="meta">${estado}</p>${errorSincronizacion ? `<p class="vencida">${errorSincronizacion}</p>` : ""}
      <div class="barra-acciones"><button class="boton" data-accion="sincronizar">Sincronizar ahora</button>
      <button class="boton" data-accion="cerrar-sesion">Cerrar sesión</button></div>`;
  }
  return `<h2>Sincronización</h2><div class="panel">${cuerpo}</div>`;
}

// Se vuelve a sincronizar al volver a la app o al recuperar internet.
document.addEventListener("visibilitychange", () => { if (!document.hidden) sincronizarAhora(); });
window.addEventListener("online", sincronizarAhora);
