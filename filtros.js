/* Búsqueda, filtro por materia y orden por prioridad de las listas de tareas y exámenes,
   con secciones desplegables (Pendientes / Completadas y Próximos / Pasados). */
const filtros = {
  tareas: { texto: "", materiaId: "", orden: "" },
  examenes: { texto: "", materiaId: "", orden: "" }
};

/* Qué secciones están abiertas se recuerda en este dispositivo (datos propios, no se sincronizan). */
const SECCIONES_ABIERTAS_POR_DEFECTO = {
  "tareas-pendientes": true, "tareas-completadas": false,
  "examenes-proximos": true, "examenes-pasados": false
};

function seccionAbierta(clave) {
  const guardadas = leerMeta().secciones || {};
  return clave in guardadas ? guardadas[clave] : SECCIONES_ABIERTAS_POR_DEFECTO[clave];
}

function opcionesHtml(lista, valorActual) {
  return lista.map(([valor, texto]) => `<option value="${escaparHtml(valor)}"${valor === valorActual ? " selected" : ""}>${escaparHtml(texto)}</option>`).join("");
}

function barraFiltros(vista) {
  const f = filtros[vista];
  if (f.materiaId && !materiaPorId(f.materiaId)) f.materiaId = ""; // la materia filtrada ya no existe
  const materias = [["", "Todas las materias"], ...datos.materias.map((m) => [m.id, m.nombre])];
  const ordenes = [["", "Ordenar por fecha"], ["alta", "Prioridad: alta primero"], ["baja", "Prioridad: baja primero"]];
  return `<div class="filtros">
    <input type="search" placeholder="Buscar…" value="${escaparHtml(f.texto)}" data-filtro="texto" aria-label="Buscar">
    <select data-filtro="materiaId" aria-label="Filtrar por materia">${opcionesHtml(materias, f.materiaId)}</select>
    <select data-filtro="orden" aria-label="Ordenar">${opcionesHtml(ordenes, f.orden)}</select></div>`;
}

function coincideConFiltros(item, f) {
  const nombreMateria = materiaPorId(item.materiaId)?.nombre || "";
  const texto = `${item.titulo} ${item.descripcion || ""} ${nombreMateria}`.toLowerCase();
  return (!f.materiaId || item.materiaId === f.materiaId)
    && (!f.texto || texto.includes(f.texto.toLowerCase()));
}

/* Con orden por prioridad, dentro de cada prioridad se mantiene el orden por fecha. */
function ordenarPorPrioridad(elementos, orden, fechaDescendente) {
  if (!orden) return elementos;
  const sentido = orden === "baja" ? -1 : 1;
  return [...elementos].sort((a, b) => sentido * (PESO_PRIORIDAD[a.prioridad] - PESO_PRIORIDAD[b.prioridad])
    || (fechaDescendente ? b.fecha.localeCompare(a.fecha) : a.fecha.localeCompare(b.fecha)));
}

function seccionDesplegable(clave, titulo, elementos, f, crearFila, fechaDescendente) {
  const visibles = ordenarPorPrioridad(elementos.filter((elemento) => coincideConFiltros(elemento, f)), f.orden, fechaDescendente);
  return `<details class="seccion" data-seccion="${clave}"${seccionAbierta(clave) ? " open" : ""}>
    <summary><span class="seccion-titulo">${titulo}</span><span class="contador">${visibles.length}</span></summary>
    ${listaDeFilas(visibles.map(crearFila), "No hay resultados.")}</details>`;
}

function resultadosTareas() {
  const f = filtros.tareas;
  const fila = (tarea) => filaTarea(tarea, true);
  return seccionDesplegable("tareas-pendientes", "Pendientes", tareasPendientes(), f, fila)
    + seccionDesplegable("tareas-completadas", "Completadas", tareasCompletadas(), f, fila);
}

function resultadosExamenes() {
  const f = filtros.examenes;
  const fila = (examen) => filaExamen(examen, true);
  return seccionDesplegable("examenes-proximos", "Próximos", examenesProximos(), f, fila)
    + seccionDesplegable("examenes-pasados", "Pasados", examenesPasados(), f, fila, true);
}

function alCambiarFiltro(evento) {
  const control = evento.target.closest("[data-filtro]");
  if (!control) return;
  filtros[vistaActual][control.dataset.filtro] = control.value;
  document.getElementById("resultados").innerHTML = vistaActual === "tareas" ? resultadosTareas() : resultadosExamenes();
}
document.addEventListener("input", alCambiarFiltro);
document.addEventListener("change", alCambiarFiltro);

/* "toggle" no burbujea, por eso se escucha en la fase de captura. */
document.addEventListener("toggle", (evento) => {
  const seccion = evento.target;
  if (!seccion.matches?.("details[data-seccion]") || seccionAbierta(seccion.dataset.seccion) === seccion.open) return;
  guardarMeta({ secciones: { ...leerMeta().secciones, [seccion.dataset.seccion]: seccion.open } });
}, true);