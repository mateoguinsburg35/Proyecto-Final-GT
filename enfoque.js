/* Modo Enfoque: temporizador Pomodoro, "No molestar" y sonido de fondo (ruido generado en el navegador). */
const enfoque = {
  fase: "foco", minutosFoco: 25, minutosDescanso: 5, restanteMs: 25 * 60000, finPrevisto: 0,
  activo: false, noMolestar: true, ruido: "ninguno", avisos: [], intervalo: null
};
let contextoAudio = null;
let fuenteRuido = null;

function enModoNoMolestar() {
  return enfoque.activo && enfoque.fase === "foco" && enfoque.noMolestar;
}

function restanteEnfoqueMs() {
  return enfoque.activo ? Math.max(0, enfoque.finPrevisto - Date.now()) : enfoque.restanteMs;
}

function formatearReloj(milisegundos) {
  const segundos = Math.ceil(milisegundos / 1000);
  return `${String(Math.floor(segundos / 60)).padStart(2, "0")}:${String(segundos % 60).padStart(2, "0")}`;
}

function actualizarReloj() {
  const texto = formatearReloj(restanteEnfoqueMs());
  const reloj = document.getElementById("reloj");
  if (reloj) reloj.textContent = texto;
  const pastilla = document.getElementById("pastilla");
  pastilla.hidden = !(enfoque.activo && vistaActual !== "enfoque");
  pastilla.textContent = `${enfoque.fase === "foco" ? "Estudio" : "Descanso"} ${texto}`;
}

/* Los avisos retenidos durante el estudio se muestran todos juntos al salir de ese modo. */
function liberarAvisos(mensajes = []) {
  const todos = [...mensajes, ...enfoque.avisos.splice(0)];
  if (todos.length) mostrarAviso(todos.join(" "));
}

function iniciarEnfoque() {
  if (enfoque.activo) return;
  enfoque.finPrevisto = Date.now() + enfoque.restanteMs;
  enfoque.activo = true;
  enfoque.intervalo = setInterval(avanzarEnfoque, 1000);
  actualizarSonido();
  render();
}

function pausarEnfoque() {
  if (!enfoque.activo) return;
  enfoque.restanteMs = restanteEnfoqueMs();
  enfoque.activo = false;
  clearInterval(enfoque.intervalo);
  actualizarSonido();
  liberarAvisos();
  render();
}

function reiniciarEnfoque() {
  pausarEnfoque();
  enfoque.fase = "foco";
  enfoque.restanteMs = enfoque.minutosFoco * 60000;
  render();
}

function avanzarEnfoque() {
  if (restanteEnfoqueMs() > 0) { actualizarReloj(); return; }
  sonarAlarma();
  if (enfoque.fase === "foco") {
    enfoque.fase = "descanso";
    enfoque.finPrevisto = Date.now() + enfoque.minutosDescanso * 60000;
    actualizarSonido();
    liberarAvisos(["¡Terminó el bloque de estudio! Descansá un rato."]);
  } else {
    clearInterval(enfoque.intervalo);
    enfoque.activo = false;
    enfoque.fase = "foco";
    enfoque.restanteMs = enfoque.minutosFoco * 60000;
    mostrarAviso("Terminó el descanso. Cuando quieras, empezá otro bloque.");
  }
  render();
}

function obtenerContextoAudio() {
  contextoAudio ??= new (window.AudioContext || window.webkitAudioContext)();
  return contextoAudio;
}

function sonarAlarma() {
  try {
    const contexto = obtenerContextoAudio();
    const oscilador = contexto.createOscillator();
    const volumen = contexto.createGain();
    volumen.gain.value = 0.15;
    oscilador.frequency.value = 880;
    oscilador.connect(volumen).connect(contexto.destination);
    oscilador.start();
    oscilador.stop(contexto.currentTime + 0.4);
  } catch (error) { /* sin audio disponible */ }
  navigator.vibrate?.(300);
}

function detenerRuido() {
  if (fuenteRuido) { fuenteRuido.stop(); fuenteRuido = null; }
}

/* El ruido suena solo mientras el temporizador de estudio está en marcha. */
function actualizarSonido() {
  detenerRuido();
  if (!(enfoque.activo && enfoque.fase === "foco" && enfoque.ruido !== "ninguno")) return;
  try {
    const contexto = obtenerContextoAudio();
    const largo = contexto.sampleRate * 2;
    const buffer = contexto.createBuffer(1, largo, contexto.sampleRate);
    const muestras = buffer.getChannelData(0);
    let anterior = 0;
    for (let i = 0; i < largo; i++) {
      const blanco = Math.random() * 2 - 1;
      if (enfoque.ruido === "marron") { anterior = (anterior + 0.02 * blanco) / 1.02; muestras[i] = anterior * 3.5; }
      else muestras[i] = blanco * 0.5;
    }
    fuenteRuido = contexto.createBufferSource();
    fuenteRuido.buffer = buffer;
    fuenteRuido.loop = true;
    const volumen = contexto.createGain();
    volumen.gain.value = 0.25;
    fuenteRuido.connect(volumen).connect(contexto.destination);
    fuenteRuido.start();
  } catch (error) { console.error("No se pudo reproducir el sonido:", error); }
}

function vistaEnfoque() {
  const minutos = [15, 25, 45, 50].map((m) => [String(m), `${m} minutos`]);
  const sonidos = [["ninguno", "Sin sonido"], ["blanco", "Ruido blanco"], ["marron", "Ruido marrón (más grave)"]];
  const boton = enfoque.activo
    ? `<button class="boton primario" data-accion="enfoque-pausar">Pausar</button>`
    : `<button class="boton primario" data-accion="enfoque-iniciar">Iniciar</button>`;
  return `${encabezado("Enfoque", "Temporizador Pomodoro y modo No molestar")}
    <div class="panel"><p class="fase">${enfoque.fase === "foco" ? "Estudio" : "Descanso"}</p>
      <p class="reloj" id="reloj" role="timer">${formatearReloj(restanteEnfoqueMs())}</p>
      <div class="barra-acciones">${boton}<button class="boton" data-accion="enfoque-reiniciar">Reiniciar</button></div></div>
    <h2>Ajustes</h2>
    <div class="panel ajustes">
      <label>Duración del bloque de estudio<select data-ajuste="minutosFoco">${opcionesHtml(minutos, String(enfoque.minutosFoco))}</select></label>
      <label>Sonido de fondo<select data-ajuste="ruido">${opcionesHtml(sonidos, enfoque.ruido)}</select></label>
      <label class="fila-casilla"><input type="checkbox" data-ajuste="noMolestar"${enfoque.noMolestar ? " checked" : ""}>
        No molestar: ocultar los avisos mientras estudiás</label></div>`;
}

document.addEventListener("change", (evento) => {
  const control = evento.target;
  const ajuste = control.dataset?.ajuste;
  if (!ajuste) return;
  if (ajuste === "noMolestar") enfoque.noMolestar = control.checked;
  if (ajuste === "ruido") { enfoque.ruido = control.value; actualizarSonido(); }
  if (ajuste === "minutosFoco") {
    enfoque.minutosFoco = Number(control.value);
    if (!enfoque.activo && enfoque.fase === "foco") enfoque.restanteMs = enfoque.minutosFoco * 60000;
  }
  if (!enModoNoMolestar()) liberarAvisos();
  render();
});
