"use strict";

/* ===== 1. Constantes ===== */
const CLAVE_ALMACENAMIENTO = "estudia:v1";
const PRIORIDADES = [
  { valor: "alta", texto: "Alta" },
  { valor: "media", texto: "Media" },
  { valor: "baja", texto: "Baja" }
];
const PESO_PRIORIDAD = { alta: 0, media: 1, baja: 2 };
const TIPOS_TAREA = ["Tarea", "Trabajo práctico"];
const COLORES_MATERIA = ["#3347E0", "#D6336C", "#1F8A5B", "#B36B00", "#7B3FE4", "#0E7C93", "#B5451B", "#5B6480"];
const DIAS_SEMANA = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

/* ===== 2. Estado y almacenamiento ===== */
const COLECCIONES = ["materias", "tareas", "examenes", "horarios"];
const CLAVE_META = "estudia:meta:v1"; // datos propios de este dispositivo (no se sincronizan)
let datos = { materias: [], tareas: [], examenes: [], horarios: [], eliminados: {} };
let vistaActual = "presentacion"; // lo primero que se ve es la presentación
let mesVisible = primerDiaDelMes(new Date());
let diaSeleccionado = hoyIso();
let temporizadorAviso = null;
let accionDeshacer = null;
let materiaAbierta = null; // id de la materia cuyo detalle se está mostrando

function cargarDatos() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_ALMACENAMIENTO));
    if (guardado) {
      datos.materias = guardado.materias || [];
      datos.tareas = guardado.tareas || [];
      datos.examenes = guardado.examenes || [];
      datos.horarios = guardado.horarios || [];
      datos.eliminados = guardado.eliminados || {};
      asegurarMarcasDeModificacion();
    }
  } catch (error) {
    console.error("No se pudieron leer los datos guardados:", error);
  }
}

/* Cada elemento lleva la hora de su última modificación; la sincronización la usa para fusionar. */
function asegurarMarcasDeModificacion() {
  let hubo = false;
  COLECCIONES.forEach((nombre) => datos[nombre].forEach((item) => {
    if (!item.modificado) { item.modificado = Date.now(); hubo = true; }
  }));
  if (hubo) guardarLocal();
}

function estampar(valores) {
  return { ...valores, modificado: Date.now() };
}

function registrarEliminaciones(elementos) {
  elementos.forEach((elemento) => { datos.eliminados[elemento.id] = Date.now(); });
}

function leerMeta() {
  try { return JSON.parse(localStorage.getItem(CLAVE_META)) || {}; } catch (error) { return {}; }
}

function guardarMeta(cambios) {
  try { localStorage.setItem(CLAVE_META, JSON.stringify({ ...leerMeta(), ...cambios })); } catch (error) { /* sin almacenamiento */ }
}

function guardarLocal() {
  try {
    localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(datos));
  } catch (error) {
    mostrarAviso("No se pudo guardar en este navegador. Los cambios se perderán al cerrar.");
  }
}

function guardarDatos() {
  guardarLocal();
  programarSincronizacion();
}

function guardarYRenderizar() {
  guardarDatos();
  render();
}

/* ===== 3. Utilidades ===== */
function nuevoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function escaparHtml(texto) {
  const reemplazos = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(texto).replace(/[&<>"']/g, (caracter) => reemplazos[caracter]);
}

function fechaAIso(fecha) {
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

function isoAFecha(iso) {
  const [anio, mes, dia] = iso.split("-").map(Number);
  return new Date(anio, mes - 1, dia);
}

function hoyIso() {
  return fechaAIso(new Date());
}

function primerDiaDelMes(fecha) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1);
}

function diasHasta(iso) {
  return Math.round((isoAFecha(iso) - isoAFecha(hoyIso())) / 86400000);
}

function textoDias(dias) {
  if (dias === 0) return "hoy";
  if (dias === 1) return "mañana";
  if (dias === -1) return "ayer";
  return dias > 1 ? `en ${dias} días` : `hace ${-dias} días`;
}

function formatearFecha(iso, opciones = { weekday: "short", day: "numeric", month: "short" }) {
  return isoAFecha(iso).toLocaleDateString("es-AR", opciones);
}

function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/* Con "No molestar" activo se retienen los avisos, salvo los que traen un "Deshacer". */
function mostrarAviso(texto, deshacer) {
  if (enModoNoMolestar() && !deshacer) { enfoque.avisos.push(texto); return; }
  const aviso = document.getElementById("aviso");
  accionDeshacer = deshacer || null;
  aviso.innerHTML = `<span>${escaparHtml(texto)}</span>${deshacer ? `<button class="boton chico" data-accion="deshacer">Deshacer</button>` : ""}`;
  aviso.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => { aviso.hidden = true; accionDeshacer = null; }, deshacer ? 7000 : 3500);
}

/* ===== 4. Consultas sobre los datos ===== */
function materiaPorId(id) {
  return datos.materias.find((materia) => materia.id === id);
}

function ordenarPorFechaYPrioridad(a, b) {
  return a.fecha.localeCompare(b.fecha) || PESO_PRIORIDAD[a.prioridad] - PESO_PRIORIDAD[b.prioridad];
}

function tareasPendientes() {
  return datos.tareas.filter((tarea) => !tarea.completada).sort(ordenarPorFechaYPrioridad);
}

function tareasCompletadas() {
  return datos.tareas.filter((tarea) => tarea.completada).sort(ordenarPorFechaYPrioridad);
}

function examenesProximos() {
  return datos.examenes.filter((examen) => examen.fecha >= hoyIso()).sort(ordenarPorFechaYPrioridad);
}

function examenesPasados() {
  return datos.examenes.filter((examen) => examen.fecha < hoyIso()).sort(ordenarPorFechaYPrioridad).reverse();
}

function actividadesDelDia(iso) {
  return {
    tareas: datos.tareas.filter((tarea) => tarea.fecha === iso),
    examenes: datos.examenes.filter((examen) => examen.fecha === iso)
  };
}

/* ===== 5. Piezas de interfaz reutilizables ===== */
function etiquetaMateria(materiaId) {
  const materia = materiaPorId(materiaId);
  if (!materia) return `<span class="materia">Sin materia</span>`;
  return `<span class="materia" style="--c:${escaparHtml(materia.color)}">${escaparHtml(materia.nombre)}</span>`;
}

function etiquetaPrioridad(prioridad) {
  const texto = PRIORIDADES.find((p) => p.valor === prioridad)?.texto || prioridad;
  return `<span class="prio prio-${escaparHtml(prioridad)}">${texto}</span>`;
}

function selectorPrioridad(tipo, id, valorActual) {
  const opciones = PRIORIDADES
    .map((p) => `<option value="${p.valor}"${p.valor === valorActual ? " selected" : ""}>${p.texto}</option>`)
    .join("");
  return `<select class="boton chico prio-sel prio-${escaparHtml(valorActual)}" aria-label="Prioridad" data-accion="cambiar-prioridad" data-tipo="${tipo}" data-id="${id}">${opciones}</select>`;
}

function botonesEdicion(tipo, id) {
  return `<button class="boton chico" data-accion="editar-${tipo}" data-id="${id}">Editar</button>
          <button class="boton chico peligro" data-accion="eliminar-${tipo}" data-id="${id}">Eliminar</button>`;
}

function textoFecha(iso, resaltarVencida) {
  const vencida = resaltarVencida && diasHasta(iso) < 0;
  return `<span class="${vencida ? "vencida" : ""}">${formatearFecha(iso)} (${textoDias(diasHasta(iso))})</span>`;
}

/* Convierte los enlaces http(s) de una descripción en vínculos, escapando antes el resto del texto. */
function enlazar(texto) {
  return escaparHtml(texto).replace(/https?:\/\/[^\s<]+/g, (url) =>
    `<a href="${url}" target="_blank" rel="noopener noreferrer">${url.length > 45 ? url.slice(0, 42) + "…" : url}</a>`);
}

function descripcionHtml(item) {
  return item.descripcion ? `<div class="descripcion">${enlazar(item.descripcion)}</div>` : "";
}

function filaTarea(tarea, conControles) {
  return `<li class="fila fila-prio-${escaparHtml(tarea.prioridad)}${tarea.completada ? " hecha" : ""}">
    <input type="checkbox" class="casilla" aria-label="Completada" data-accion="alternar-tarea" data-id="${tarea.id}"${tarea.completada ? " checked" : ""}>
    <div class="fila-texto"><strong>${escaparHtml(tarea.titulo)}</strong>
      <div class="meta">${etiquetaMateria(tarea.materiaId)}<span>${escaparHtml(tarea.tipo)}</span>${textoFecha(tarea.fecha, !tarea.completada)}</div>${descripcionHtml(tarea)}</div>
    <div class="acciones">${conControles ? selectorPrioridad("tarea", tarea.id, tarea.prioridad) + botonesEdicion("tarea", tarea.id) : etiquetaPrioridad(tarea.prioridad)}</div>
  </li>`;
}

function filaExamen(examen, conControles) {
  const materia = materiaPorId(examen.materiaId);
  return `<li class="fila fila-prio-${escaparHtml(examen.prioridad)}">
    <span class="marca-color" style="--c:${escaparHtml(materia ? materia.color : "#5B6480")}" title="Examen"></span>
    <div class="fila-texto"><strong>Examen: ${escaparHtml(examen.titulo)}</strong>
      <div class="meta">${etiquetaMateria(examen.materiaId)}${textoFecha(examen.fecha, false)}</div>${descripcionHtml(examen)}</div>
    <div class="acciones">${conControles ? selectorPrioridad("examen", examen.id, examen.prioridad) + botonesEdicion("examen", examen.id) : etiquetaPrioridad(examen.prioridad)}</div>
  </li>`;
}

function listaDeFilas(filas, mensajeVacio) {
  const contenido = filas.length ? filas.join("") : `<li class="vacio-lista">${mensajeVacio}</li>`;
  return `<ul class="lista">${contenido}</ul>`;
}

function encabezado(titulo, subtitulo, botones = "") {
  return `<header class="encabezado"><div><h1>${titulo}</h1><div class="subtitulo">${subtitulo}</div></div><div class="barra-acciones">${botones}</div></header>`;
}

const BOTON_NUEVA_TAREA = `<button class="boton primario" data-accion="nueva-tarea">Nueva tarea</button>`;
const BOTON_NUEVO_EXAMEN = `<button class="boton primario" data-accion="nuevo-examen">Nuevo examen</button>`;

/* ===== 6. Vistas ===== */
function vistaInicio() {
  const total = datos.tareas.length;
  const hechas = tareasCompletadas().length;
  const porcentaje = total ? Math.round((hechas / total) * 100) : 0;
  const hoy = actividadesDelDia(hoyIso());
  const pendientes = tareasPendientes();
  const titular = total ? `Completaste el ${porcentaje} % de tus tareas` : "Todavía no cargaste tareas";

  const filasHoy = [...clasesDeHoy().map((c) => filaClase(c, false)), ...hoy.examenes.map((e) => filaExamen(e, false)), ...hoy.tareas.map((t) => filaTarea(t, false))];
  const fechaHoy = capitalizar(formatearFecha(hoyIso(), { weekday: "long", day: "numeric", month: "long" }));

  return `${encabezado("Panel diario", fechaHoy)}${avisoDeCopia()}
    <section aria-label="Progreso académico">
      <p class="titular">${titular}</p>
      <div class="barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${porcentaje}"><span style="width:${porcentaje}%"></span></div>
      <p class="meta">${hechas} de ${total} completadas, ${pendientes.length} pendientes</p>
      ${progresoPorMateria()}
    </section>
    <h2>Actividades de hoy</h2>
    ${listaDeFilas(filasHoy, "No tenés actividades para hoy.")}
    <h2>Tareas pendientes</h2>
    ${listaDeFilas(pendientes.slice(0, 6).map((t) => filaTarea(t, false)), "No tenés tareas pendientes.")}
    <h2>Próximos exámenes</h2>
    ${listaDeFilas(examenesProximos().slice(0, 5).map((e) => filaExamen(e, false)), "No hay exámenes próximos.")}`;
}

function progresoPorMateria() {
  return datos.materias.map((materia) => {
    const tareas = datos.tareas.filter((tarea) => tarea.materiaId === materia.id);
    if (!tareas.length) return "";
    const hechas = tareas.filter((tarea) => tarea.completada).length;
    const porcentaje = Math.round((hechas / tareas.length) * 100);
    return `<div class="mini" style="--c:${escaparHtml(materia.color)}"><span>${escaparHtml(materia.nombre)}</span>
      <div class="barra chica"><span style="width:${porcentaje}%"></span></div><span class="meta">${hechas}/${tareas.length}</span></div>`;
  }).join("");
}

function vistaCalendario() {
  const anio = mesVisible.getFullYear();
  const mes = mesVisible.getMonth();
  const diasDelMes = new Date(anio, mes + 1, 0).getDate();
  const desfase = (new Date(anio, mes, 1).getDay() + 6) % 7; // la semana empieza el lunes
  let celdas = DIAS_SEMANA.map((dia) => `<div class="dia-semana">${dia}</div>`).join("");
  celdas += `<div class="cal-dia vacio"></div>`.repeat(desfase);

  for (let dia = 1; dia <= diasDelMes; dia++) {
    const iso = fechaAIso(new Date(anio, mes, dia));
    const { tareas, examenes } = actividadesDelDia(iso);
    const items = [
      ...examenes.map((e) => ({ clase: "examen", titulo: `Examen: ${e.titulo}`, materiaId: e.materiaId })),
      ...tareas.map((t) => ({ clase: t.completada ? "hecha" : "", titulo: t.titulo, materiaId: t.materiaId }))
    ];
    const chips = items.slice(0, 3).map((item) => {
      const materia = materiaPorId(item.materiaId);
      return `<span class="chip ${item.clase}" style="--c:${escaparHtml(materia ? materia.color : "#5B6480")}">${escaparHtml(item.titulo)}</span>`;
    }).join("");
    const resto = items.length > 3 ? `<span class="mas">+${items.length - 3}</span>` : "";
    const clases = ["cal-dia", iso === hoyIso() ? "hoy" : "", iso === diaSeleccionado ? "seleccionado" : ""].join(" ");
    celdas += `<button class="${clases}" data-accion="elegir-dia" data-fecha="${iso}" aria-label="${dia}, ${items.length} actividades">
      <span class="numero">${dia}</span><span class="chips">${chips}${resto}</span></button>`;
  }

  const delDia = actividadesDelDia(diaSeleccionado);
  const filasDia = [...delDia.examenes.map((e) => filaExamen(e, true)), ...delDia.tareas.map((t) => filaTarea(t, true))];
  const nombreMes = capitalizar(mesVisible.toLocaleDateString("es-AR", { month: "long", year: "numeric" }));
  const navegacion = `<button class="boton" data-accion="mes-anterior" aria-label="Mes anterior">‹</button>
    <button class="boton" data-accion="mes-hoy">Hoy</button>
    <button class="boton" data-accion="mes-siguiente" aria-label="Mes siguiente">›</button>`;

  return `${encabezado("Calendario", nombreMes, navegacion)}
    <div class="cal">${celdas}</div>
    <h2>${capitalizar(formatearFecha(diaSeleccionado, { weekday: "long", day: "numeric", month: "long" }))}</h2>
    ${listaDeFilas(filasDia, "No hay actividades este día.")}
    <div class="barra-acciones" style="margin-top:1rem">${BOTON_NUEVA_TAREA}${BOTON_NUEVO_EXAMEN}</div>`;
}

function vistaTareas() {
  return `${encabezado("Tareas", "Tareas y trabajos prácticos", BOTON_NUEVA_TAREA)}${barraFiltros("tareas")}<div id="resultados">${resultadosTareas()}</div>`;
}

function vistaExamenes() {
  return `${encabezado("Exámenes", "Fechas de evaluación por materia", BOTON_NUEVO_EXAMEN)}${barraFiltros("examenes")}<div id="resultados">${resultadosExamenes()}</div>`;
}

function vistaMaterias() {
  const filas = datos.materias.map((materia) => {
    const cantidadTareas = datos.tareas.filter((t) => t.materiaId === materia.id).length;
    const cantidadExamenes = datos.examenes.filter((e) => e.materiaId === materia.id).length;
    const abierta = materia.id === materiaAbierta;
    return `<li class="fila tarjeta-materia${abierta ? " abierta" : ""}" style="--c:${escaparHtml(materia.color)}" data-accion="alternar-materia" data-id="${materia.id}">
      <span class="marca-color" style="--c:${escaparHtml(materia.color)}"></span>
      <div class="fila-texto"><button class="nombre-materia" data-accion="alternar-materia" data-id="${materia.id}" aria-expanded="${abierta}"><strong>${escaparHtml(materia.nombre)}</strong></button>
        <div class="meta"><span>${cantidadTareas} tareas</span><span>${cantidadExamenes} exámenes</span></div></div>
      <div class="acciones">${botonesEdicion("materia", materia.id)}</div></li>${abierta ? detalleMateria(materia) : ""}`;
  });
  const boton = `<button class="boton primario" data-accion="nueva-materia">Nueva materia</button>`;
  return `${encabezado("Materias", "Las materias que cursás", boton)}
    ${listaDeFilas(filas, "Todavía no creaste materias. Empezá agregando la primera.")}`;
}

/* Detalle de una materia: sus tareas pendientes y sus próximos exámenes. */
function detalleMateria(materia) {
  const tareas = tareasPendientes().filter((tarea) => tarea.materiaId === materia.id);
  const examenes = examenesProximos().filter((examen) => examen.materiaId === materia.id);
  return `<li class="detalle-materia" style="--c:${escaparHtml(materia.color)}">
    <button class="boton chico cerrar-detalle" data-accion="cerrar-materia" aria-label="Cerrar detalle">✕</button>
    <div class="detalle-titulo">${escaparHtml(materia.nombre)}</div>
    <h3>Tareas pendientes (${tareas.length})</h3>
    ${listaDeFilas(tareas.map((t) => filaTarea(t, true)), "No hay tareas pendientes en esta materia.")}
    <h3>Próximos exámenes (${examenes.length})</h3>
    ${listaDeFilas(examenes.map((e) => filaExamen(e, true)), "No hay exámenes próximos en esta materia.")}</li>`;
}

const VISTAS = {
  presentacion: vistaPresentacion,
  inicio: vistaInicio,
  calendario: vistaCalendario,
  tareas: vistaTareas,
  examenes: vistaExamenes,
  materias: vistaMaterias,
  horario: vistaHorario,
  enfoque: vistaEnfoque,
  datos: vistaDatos
};

function vistaDatos() {
  return `${encabezado("Datos", "Sincronización y copias de seguridad")}${seccionSincronizacion()}${seccionCopias()}`;
}

function render() {
  document.querySelectorAll(".menu nav [data-vista]").forEach((boton) => {
    const activa = boton.dataset.vista === vistaActual;
    boton.classList.toggle("activa", activa);
    if (activa) boton.setAttribute("aria-current", "page"); else boton.removeAttribute("aria-current");
  });
  document.getElementById("contenido").innerHTML = VISTAS[vistaActual]();
  actualizarReloj();
}

/* ===== 7. Formularios (ventana de diálogo) ===== */
function abrirFormulario({ titulo, mensaje = "", campos = [], valores = {}, textoBoton = "Guardar", peligro = false, alGuardar }) {
  const dialogo = document.getElementById("dialogo");
  const camposHtml = campos.map((campo) => {
    const valor = valores[campo.nombre] ?? "";
    if (campo.tipo === "dias") {
      const marcados = Array.isArray(valor) ? valor : [];
      return `<fieldset class="dias"><legend>${campo.etiqueta}</legend><div class="dias-opciones">${campo.opciones.map((o) =>
        `<label class="dia-opcion"><input type="checkbox" name="${campo.nombre}" value="${escaparHtml(o.valor)}" aria-label="${escaparHtml(o.texto)}"${marcados.includes(o.valor) ? " checked" : ""}><span>${escaparHtml(o.texto.slice(0, 3))}</span></label>`).join("")}</div></fieldset>`;
    }
    const requerido = campo.opcional ? "" : " required";
    let control;
    if (campo.tipo === "select") {
      control = `<select name="${campo.nombre}">${campo.opciones.map((o) =>
        `<option value="${escaparHtml(o.valor)}"${o.valor === valor ? " selected" : ""}>${escaparHtml(o.texto)}</option>`).join("")}</select>`;
    } else if (campo.tipo === "textarea") {
      control = `<textarea name="${campo.nombre}" rows="3" maxlength="1500">${escaparHtml(valor)}</textarea>`;
    } else {
      control = `<input name="${campo.nombre}" type="${campo.tipo}" value="${escaparHtml(valor)}"${requerido}${campo.tipo === "text" ? ' maxlength="80" autocomplete="off"' : ""}>`;
    }
    return `<label>${campo.etiqueta}${control}</label>`;
  }).join("");

  dialogo.innerHTML = `<form><h2>${titulo}</h2>${mensaje ? `<p>${mensaje}</p>` : ""}${camposHtml}
    <div class="acciones-dialogo"><button type="button" class="boton" data-accion="cerrar-dialogo">Cancelar</button>
    <button class="boton ${peligro ? "eliminar" : "primario"}">${textoBoton}</button></div></form>`;

  dialogo.querySelector("form").addEventListener("submit", (evento) => {
    evento.preventDefault();
    const formulario = new FormData(evento.target);
    const valoresIngresados = Object.fromEntries(formulario);
    Object.keys(valoresIngresados).forEach((clave) => { valoresIngresados[clave] = valoresIngresados[clave].trim(); });
    campos.filter((c) => c.tipo === "dias").forEach((c) => { valoresIngresados[c.nombre] = formulario.getAll(c.nombre); }); // casillas múltiples
    if (campos.some((c) => c.tipo === "text" && !valoresIngresados[c.nombre])) return;
    dialogo.close();
    alGuardar(valoresIngresados);
  });
  dialogo.showModal();
}

function opcionesDeMaterias() {
  return datos.materias.map((materia) => ({ valor: materia.id, texto: materia.nombre }));
}

function hayMaterias() {
  if (datos.materias.length) return true;
  vistaActual = "materias";
  render();
  mostrarAviso("Primero creá una materia para poder asociarle actividades.");
  return false;
}

function formularioMateria(materia) {
  const colorInicial = COLORES_MATERIA[datos.materias.length % COLORES_MATERIA.length];
  abrirFormulario({
    titulo: materia ? "Editar materia" : "Nueva materia",
    campos: [
      { nombre: "nombre", etiqueta: "Nombre", tipo: "text" },
      { nombre: "color", etiqueta: "Color", tipo: "color" }
    ],
    valores: materia || { color: colorInicial },
    alGuardar(valores) {
      if (materia) Object.assign(materia, estampar(valores));
      else datos.materias.push({ id: nuevoId(), ...estampar(valores) });
      guardarYRenderizar();
    }
  });
}

const OPCIONES_REPETICION = [
  { valor: "1", texto: "No se repite" },
  { valor: "4", texto: "Todas las semanas, 4 veces" },
  { valor: "8", texto: "Todas las semanas, 8 veces" },
  { valor: "16", texto: "Todas las semanas, 16 veces (cuatrimestre)" }
];

function formularioTarea(tarea) {
  if (!hayMaterias()) return;
  const fechaInicial = vistaActual === "calendario" ? diaSeleccionado : hoyIso();
  const campos = [
    { nombre: "titulo", etiqueta: "Título", tipo: "text" },
    { nombre: "tipo", etiqueta: "Tipo", tipo: "select", opciones: TIPOS_TAREA.map((t) => ({ valor: t, texto: t })) },
    { nombre: "materiaId", etiqueta: "Materia", tipo: "select", opciones: opcionesDeMaterias() },
    { nombre: "fecha", etiqueta: "Fecha de entrega", tipo: "date" },
    { nombre: "prioridad", etiqueta: "Prioridad", tipo: "select", opciones: PRIORIDADES.map((p) => ({ valor: p.valor, texto: p.texto })) },
    { nombre: "descripcion", etiqueta: "Descripción o enlaces (consigna, material)", tipo: "textarea", opcional: true }
  ];
  if (!tarea) campos.push({ nombre: "repeticiones", etiqueta: "Repetición", tipo: "select", opciones: OPCIONES_REPETICION });
  abrirFormulario({
    titulo: tarea ? "Editar tarea" : "Nueva tarea",
    campos,
    valores: tarea || { tipo: TIPOS_TAREA[0], materiaId: datos.materias[0].id, fecha: fechaInicial, prioridad: "media", repeticiones: "1" },
    alGuardar(valores) {
      const { repeticiones, ...datosTarea } = valores;
      if (tarea) Object.assign(tarea, estampar(datosTarea));
      else crearTareasSemanales(datosTarea, Number(repeticiones));
      guardarYRenderizar();
    }
  });
}

/* Crea una tarea independiente por semana, desde la fecha elegida. */
function crearTareasSemanales(base, veces) {
  for (let semana = 0; semana < veces; semana++) {
    const fecha = isoAFecha(base.fecha);
    fecha.setDate(fecha.getDate() + 7 * semana);
    datos.tareas.push({ id: nuevoId(), completada: false, ...estampar({ ...base, fecha: fechaAIso(fecha) }) });
  }
  if (veces > 1) mostrarAviso(`Se crearon ${veces} tareas semanales.`);
}

function formularioExamen(examen) {
  if (!hayMaterias()) return;
  const fechaInicial = vistaActual === "calendario" ? diaSeleccionado : hoyIso();
  abrirFormulario({
    titulo: examen ? "Editar examen" : "Nuevo examen",
    campos: [
      { nombre: "titulo", etiqueta: "Título", tipo: "text" },
      { nombre: "materiaId", etiqueta: "Materia", tipo: "select", opciones: opcionesDeMaterias() },
      { nombre: "fecha", etiqueta: "Fecha del examen", tipo: "date" },
      { nombre: "prioridad", etiqueta: "Prioridad", tipo: "select", opciones: PRIORIDADES.map((p) => ({ valor: p.valor, texto: p.texto })) },
      { nombre: "descripcion", etiqueta: "Descripción o enlaces (temas, material)", tipo: "textarea", opcional: true }
    ],
    valores: examen || { materiaId: datos.materias[0].id, fecha: fechaInicial, prioridad: "alta" },
    alGuardar(valores) {
      if (examen) Object.assign(examen, estampar(valores));
      else datos.examenes.push({ id: nuevoId(), ...estampar(valores) });
      guardarYRenderizar();
    }
  });
}

/* Elimina al instante y ofrece deshacer: al restaurar se reponen los elementos y se anula su marca de eliminación. */
function eliminarConDeshacer(elementos, mensaje) {
  registrarEliminaciones(elementos.map((e) => e.item));
  elementos.forEach(({ coleccion, item }) => { datos[coleccion] = datos[coleccion].filter((x) => x.id !== item.id); });
  guardarYRenderizar();
  mostrarAviso(mensaje, () => {
    elementos.forEach(({ coleccion, item }) => {
      delete datos.eliminados[item.id];
      datos[coleccion].push({ ...item, modificado: Date.now() });
    });
    guardarYRenderizar();
  });
}

function eliminarMateria(materia) {
  const asociados = ["tareas", "examenes", "horarios"].flatMap((coleccion) =>
    datos[coleccion].filter((item) => item.materiaId === materia.id).map((item) => ({ coleccion, item })));
  const detalle = asociados.length ? ` y ${asociados.length} actividades asociadas` : "";
  eliminarConDeshacer([{ coleccion: "materias", item: materia }, ...asociados], `Se eliminó la materia “${materia.nombre}”${detalle}.`);
}

function eliminarElemento(coleccion, id, descripcion) {
  const item = datos[coleccion].find((e) => e.id === id);
  const nombre = item.titulo ?? materiaPorId(item.materiaId)?.nombre ?? "";
  eliminarConDeshacer([{ coleccion, item }], `Se eliminó ${descripcion} “${nombre}”.`);
}

/* ===== 8. Acciones y eventos ===== */
function cambiarMes(cantidad) {
  mesVisible = new Date(mesVisible.getFullYear(), mesVisible.getMonth() + cantidad, 1);
  render();
}

const ACCIONES = {
  "ir": ({ vista }) => { vistaActual = vista; render(); window.scrollTo(0, 0); },
  "cerrar-dialogo": () => document.getElementById("dialogo").close(),
  "nueva-materia": () => formularioMateria(null),
  "editar-materia": ({ id }) => formularioMateria(materiaPorId(id)),
  "eliminar-materia": ({ id }) => eliminarMateria(materiaPorId(id)),
  "alternar-materia": ({ id }) => { materiaAbierta = materiaAbierta === id ? null : id; render(); },
  "cerrar-materia": () => { materiaAbierta = null; render(); },
  "nueva-tarea": () => formularioTarea(null),
  "editar-tarea": ({ id }) => formularioTarea(datos.tareas.find((t) => t.id === id)),
  "eliminar-tarea": ({ id }) => eliminarElemento("tareas", id, "la tarea"),
  "nuevo-examen": () => formularioExamen(null),
  "editar-examen": ({ id }) => formularioExamen(datos.examenes.find((e) => e.id === id)),
  "eliminar-examen": ({ id }) => eliminarElemento("examenes", id, "el examen"),
  "deshacer": () => { accionDeshacer?.(); accionDeshacer = null; document.getElementById("aviso").hidden = true; },
  "nueva-clase": () => formularioClase(null),
  "editar-horario": ({ id }) => formularioClase(datos.horarios.find((c) => c.id === id)),
  "eliminar-horario": ({ id }) => eliminarClase(id),
  "enfoque-iniciar": () => iniciarEnfoque(),
  "enfoque-pausar": () => pausarEnfoque(),
  "enfoque-reiniciar": () => reiniciarEnfoque(),
  "iniciar-sesion": () => formularioInicioSesion(),
  "cerrar-sesion": () => cerrarSesion(),
  "sincronizar": () => sincronizarAhora(),
  "exportar": () => exportarCopia(),
  "importar": () => document.getElementById("archivo-importacion").click(),
  "mes-anterior": () => cambiarMes(-1),
  "mes-siguiente": () => cambiarMes(1),
  "mes-hoy": () => { mesVisible = primerDiaDelMes(new Date()); diaSeleccionado = hoyIso(); render(); },
  "elegir-dia": ({ fecha }) => { diaSeleccionado = fecha; render(); }
};

document.addEventListener("click", (evento) => {
  const elemento = evento.target.closest("[data-accion]");
  if (!elemento || elemento.matches("select, input")) return; // esos se resuelven en "change"
  ACCIONES[elemento.dataset.accion]?.(elemento.dataset);
});

document.addEventListener("change", (evento) => {
  const elemento = evento.target.closest("[data-accion]");
  if (!elemento) return;
  const { accion, id, tipo } = elemento.dataset;

  if (accion === "alternar-tarea") {
    const tarea = datos.tareas.find((t) => t.id === id);
    tarea.completada = elemento.checked;
    tarea.modificado = Date.now();
  } else if (accion === "cambiar-prioridad") {
    const coleccion = tipo === "tarea" ? datos.tareas : datos.examenes;
    const item = coleccion.find((e) => e.id === id);
    item.prioridad = elemento.value;
    item.modificado = Date.now();
  } else if (accion === "elegir-archivo") {
    importarCopia(elemento.files[0]);
    elemento.value = "";
    return;
  } else {
    return;
  }
  guardarYRenderizar();
  document.querySelector(`[data-accion="${accion}"][data-id="${id}"]`)?.focus();
});

/* ===== 9. Inicio de la aplicación ===== */
cargarDatos();
render();
navigator.storage?.persist?.(); // pide al navegador que no borre los datos por falta de espacio
iniciarSincronizacion();