/* Página de presentación de EstudIA: es lo primero que se ve al entrar y se vuelve a abrir desde el logo. */
const LOGO_ESTUDIA = `<img class="logo" src="img/logo.png" alt="Logo de EstudIA">`;

const ICONOS_PRESENTACION = {
  materias: `<path d="M4 19V5a2 2 0 0 1 2-2h13v14H6a2 2 0 0 0-2 2zm0 0a2 2 0 0 0 2 2h13"/>`,
  tareas: `<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1.5 1.5L7.5 5M3.5 12l1.5 1.5L7.5 11M3.5 18l1.5 1.5L7.5 17"/>`,
  examenes: `<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>`,
  calendario: `<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>`,
  horario: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`,
  enfoque: `<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 1.5M9.5 2.5h5"/>`
};

const FUNCIONES_PRESENTACION = [
  { vista: "materias", icono: "materias", color: "#3347E0", titulo: "Materias", texto: "Creá cada materia con su propio color y mirá todo lo que tenés pendiente en ella." },
  { vista: "tareas", icono: "tareas", color: "#D6336C", titulo: "Tareas", texto: "Cargá tareas y trabajos prácticos con prioridad, fecha de entrega, consignas y enlaces." },
  { vista: "examenes", icono: "examenes", color: "#B36B00", titulo: "Exámenes", texto: "Anotá cada evaluación y llegá a la fecha sabiendo qué temas te faltan." },
  { vista: "calendario", icono: "calendario", color: "#1F8A5B", titulo: "Calendario", texto: "Tu mes completo con entregas y exámenes a un vistazo, día por día." },
  { vista: "horario", icono: "horario", color: "#7B3FE4", titulo: "Horarios", texto: "Armá tu semana de cursada, con clases que se repiten y aviso de superposiciones." },
  { vista: "enfoque", icono: "enfoque", color: "#0E7C93", titulo: "Pomodoro", texto: "Estudiá en ciclos de concentración y descanso, con modo No molestar y sonido de fondo." }
];

function vistaPresentacion() {
  const tarjetas = FUNCIONES_PRESENTACION.map((f) => `<li><button class="funcion" style="--c:${f.color}" data-accion="ir" data-vista="${f.vista}">
      <span class="funcion-icono"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONOS_PRESENTACION[f.icono]}</svg></span>
      <strong>${f.titulo}</strong><span>${f.texto}</span></button></li>`).join("");

  return `<div class="presentacion">
    <section class="portada" aria-labelledby="titulo-presentacion">
      <div class="marca-grande">${LOGO_ESTUDIA}<span class="nombre">Estud<span>IA</span></span></div>
      <p class="etiqueta">Tu organizador académico</p>
      <h1 id="titulo-presentacion">Todo tu estudio, en un solo lugar.</h1>
      <p class="bajada">EstudIA es una app para estudiantes que reúne tus materias, tareas, exámenes y horarios en un panel simple. Te ayuda a saber qué hacer hoy, a no olvidarte ninguna entrega y a estudiar con foco.</p>
      <div class="barra-acciones"><button class="boton primario grande" data-accion="ir" data-vista="inicio">Ingresar a la aplicación</button></div>
    </section>
    <h2 class="titulo-funciones">Lo que podés hacer</h2>
    <ul class="funciones">${tarjetas}</ul>
    <p class="pie-presentacion">Funciona en el celular y en la computadora. Tus datos se guardan en tu dispositivo y, si querés, se sincronizan entre ambos.</p>
  </div>`;
}
