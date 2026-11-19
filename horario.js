/* Horario semanal fijo de cursada, con aviso de superposiciones.
   Una clase que se repite en varios días se guarda como una entrada por día, unidas por el campo
   opcional "grupo". Así el formato de los datos no cambia y la sincronización sigue funcionando por elemento. */
const NOMBRES_DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function aMinutos(hora) {
  const [horas, minutos] = hora.split(":").map(Number);
  return horas * 60 + minutos;
}

function diaDeLaSemana(fecha) {
  return (fecha.getDay() + 6) % 7; // 0 = lunes
}

function clasesOrdenadas() {
  return [...datos.horarios].sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio));
}

function clasesDeHoy() {
  return clasesOrdenadas().filter((clase) => clase.dia === diaDeLaSemana(new Date()));
}

/* Todas las entradas (una por día) que forman la misma clase repetida. Una clase suelta se devuelve sola. */
function miembrosDeClase(clase) {
  if (!clase.grupo) return [clase];
  return datos.horarios.filter((c) => c.grupo === clase.grupo && c.materiaId === clase.materiaId
    && c.inicio === clase.inicio && c.fin === clase.fin);
}

/* Una sola entrada por clase repetida (la del primer día), para listarlas sin duplicados. */
function clasesAgrupadas() {
  const vistas = new Set();
  return clasesOrdenadas().filter((clase) => {
    if (!clase.grupo) return true;
    const clave = [clase.grupo, clase.materiaId, clase.inicio, clase.fin].join("|");
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

function textoDiasDeClase(clase) {
  const dias = miembrosDeClase(clase).map((c) => c.dia).sort((a, b) => a - b);
  if (dias.length === 7) return "Todos los días";
  const nombres = dias.map((dia) => NOMBRES_DIAS[dia]);
  return nombres.length > 1 ? `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}` : nombres[0];
}

function buscarSuperposicion(candidata, idsIgnorados = []) {
  return datos.horarios.find((clase) => !idsIgnorados.includes(clase.id) && clase.dia === candidata.dia
    && clase.inicio < candidata.fin && candidata.inicio < clase.fin);
}

function textoHorario(clase) {
  return `${NOMBRES_DIAS[clase.dia]} ${clase.inicio} a ${clase.fin}`;
}

function filaClase(clase, conControles) {
  const materia = materiaPorId(clase.materiaId);
  const cuando = conControles
    ? `<span>${textoDiasDeClase(clase)}</span><span>${clase.inicio} a ${clase.fin}</span>`
    : `<span>${textoHorario(clase)}</span>`;
  return `<li class="fila">
    <span class="marca-color" style="--c:${escaparHtml(materia ? materia.color : "#5B6480")}" title="Clase"></span>
    <div class="fila-texto"><strong>${escaparHtml(materia ? materia.nombre : "Sin materia")}</strong>
      <div class="meta">${cuando}</div></div>
    <div class="acciones">${conControles ? botonesEdicion("horario", clase.id) : `<span class="meta">Clase</span>`}</div></li>`;
}

function vistaHorario() {
  const clases = clasesOrdenadas();
  const hoy = diaDeLaSemana(new Date());
  const desde = Math.min(8, ...clases.map((c) => Math.floor(aMinutos(c.inicio) / 60)));
  const hasta = Math.max(18, ...clases.map((c) => Math.ceil(aMinutos(c.fin) / 60)));
  const etiquetasHoras = Array.from({ length: hasta - desde }, (_, i) =>
    `<span style="top:calc(${i} * var(--alto-hora))">${String(desde + i).padStart(2, "0")}:00</span>`).join("");

  const columnas = NOMBRES_DIAS.map((nombreDia, dia) => {
    const bloques = clases.filter((c) => c.dia === dia).map((clase) => {
      const materia = materiaPorId(clase.materiaId);
      const arriba = (aMinutos(clase.inicio) - desde * 60) / 60;
      const alto = (aMinutos(clase.fin) - aMinutos(clase.inicio)) / 60;
      return `<button class="bloque" style="--c:${escaparHtml(materia ? materia.color : "#5B6480")};top:calc(${arriba} * var(--alto-hora));height:calc(${alto} * var(--alto-hora))"
        data-accion="editar-horario" data-id="${clase.id}"><strong>${escaparHtml(materia ? materia.nombre : "Sin materia")}</strong><span>${clase.inicio}–${clase.fin}</span></button>`;
    }).join("");
    return `<div class="grilla-dia${dia === hoy ? " es-hoy" : ""}"><div class="grilla-titulo">${nombreDia.slice(0, 3)}</div>
      <div class="grilla-cuerpo" style="--horas:${hasta - desde}">${bloques}</div></div>`;
  }).join("");

  const boton = `<button class="boton primario" data-accion="nueva-clase">Nueva clase</button>`;
  return `${encabezado("Horario", "Tu semana de cursada", boton)}
    <div class="grilla-scroll"><div class="grilla"><div class="grilla-horas" style="--horas:${hasta - desde}">${etiquetasHoras}</div>${columnas}</div></div>
    <h2>Clases</h2>${listaDeFilas(clasesAgrupadas().map((c) => filaClase(c, true)), "Todavía no cargaste clases.")}`;
}

function formularioClase(clase, valoresPrevios) {
  if (!hayMaterias()) return;
  abrirFormulario({
    titulo: clase ? "Editar clase" : "Nueva clase",
    campos: [
      { nombre: "materiaId", etiqueta: "Materia", tipo: "select", opciones: opcionesDeMaterias() },
      { nombre: "dias", etiqueta: "Días (podés elegir varios)", tipo: "dias", opciones: NOMBRES_DIAS.map((nombre, i) => ({ valor: String(i), texto: nombre })) },
      { nombre: "inicio", etiqueta: "Desde", tipo: "time" },
      { nombre: "fin", etiqueta: "Hasta", tipo: "time" }
    ],
    valores: valoresPrevios || (clase
      ? { materiaId: clase.materiaId, inicio: clase.inicio, fin: clase.fin, dias: miembrosDeClase(clase).map((c) => String(c.dia)) }
      : { materiaId: datos.materias[0].id, dias: ["0"], inicio: "08:00", fin: "12:00" }),
    alGuardar: (valores) => validarYGuardarClase(clase, valores)
  });
}

function validarYGuardarClase(clase, valores) {
  const dias = [...new Set(valores.dias.map(Number))].sort((a, b) => a - b);
  if (!dias.length) {
    mostrarAviso("Elegí al menos un día de la semana.");
    formularioClase(clase, valores);
    return;
  }
  if (valores.fin <= valores.inicio) {
    mostrarAviso("La hora de fin tiene que ser posterior a la de inicio.");
    formularioClase(clase, valores);
    return;
  }
  const propias = (clase ? miembrosDeClase(clase) : []).map((c) => c.id);
  const choques = dias
    .map((dia) => ({ dia, choque: buscarSuperposicion({ dia, inicio: valores.inicio, fin: valores.fin }, propias) }))
    .filter((x) => x.choque);
  if (!choques.length) { guardarClase(clase, valores, dias); return; }
  const detalle = choques.map(({ dia, choque }) => {
    const materiaChoque = materiaPorId(choque.materiaId);
    return `${NOMBRES_DIAS[dia]} con ${escaparHtml(materiaChoque ? materiaChoque.nombre : "otra clase")} (${choque.inicio} a ${choque.fin})`;
  }).join("; ");
  abrirFormulario({
    titulo: "Horario ocupado",
    mensaje: `Esta clase se superpone: ${detalle}. ¿Querés guardarla igual?`,
    textoBoton: "Guardar igual",
    alGuardar: () => guardarClase(clase, valores, dias)
  });
}

/* Crea o actualiza una entrada por día elegido. Si se editó una clase repetida, las entradas que ya
   existían se reutilizan (se mueven de día si hace falta) y solo se eliminan las que sobran. */
function guardarClase(clase, { materiaId, inicio, fin }, dias) {
  const actuales = clase ? miembrosDeClase(clase) : [];
  const grupo = clase?.grupo || (dias.length > 1 ? nuevoId() : null);
  const comunes = { materiaId, inicio, fin, ...(grupo ? { grupo } : {}) };

  const delMismoDia = new Map();
  const sobrantes = [];
  actuales.forEach((c) => {
    if (dias.includes(c.dia) && !delMismoDia.has(c.dia)) delMismoDia.set(c.dia, c); else sobrantes.push(c);
  });
  dias.forEach((dia) => {
    const existente = delMismoDia.get(dia) || sobrantes.shift();
    if (existente) Object.assign(existente, estampar({ ...comunes, dia }));
    else datos.horarios.push({ id: nuevoId(), ...estampar({ ...comunes, dia }) });
  });

  if (sobrantes.length) {
    eliminarConDeshacer(sobrantes.map((item) => ({ coleccion: "horarios", item })),
      `Se quitó la clase de ${sobrantes.map((c) => NOMBRES_DIAS[c.dia]).join(", ")}.`);
  } else {
    guardarYRenderizar();
  }
}

/* Elimina la clase con todos sus días repetidos (se puede deshacer). */
function eliminarClase(id) {
  const clase = datos.horarios.find((c) => c.id === id);
  if (!clase) return;
  const miembros = miembrosDeClase(clase);
  const nombre = materiaPorId(clase.materiaId)?.nombre ?? "";
  const dias = miembros.length > 1 ? ` (${textoDiasDeClase(clase)})` : "";
  eliminarConDeshacer(miembros.map((item) => ({ coleccion: "horarios", item })), `Se eliminó la clase “${nombre}”${dias}.`);
}