/* Copia de seguridad en archivo: exportar e importar todos los datos. */
function exportarCopia() {
  const contenido = JSON.stringify({ aplicacion: "EstudIA", version: 1, exportado: new Date().toISOString(), datos }, null, 2);
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(new Blob([contenido], { type: "application/json" }));
  enlace.download = `estudia-copia-${hoyIso()}.json`;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
  guardarMeta({ ultimaCopia: Date.now() });
  render();
}

function leerCopia(texto) {
  let copia;
  try { copia = JSON.parse(texto); } catch { throw new Error("El archivo no es una copia válida."); }
  const origen = copia?.datos;
  if (copia?.aplicacion !== "EstudIA" || !origen) throw new Error("El archivo no es una copia de EstudIA.");
  for (const nombre of COLECCIONES) {
    origen[nombre] ??= []; // las copias antiguas no tienen horarios
    const valido = Array.isArray(origen[nombre]) && origen[nombre].every((item) => item && typeof item.id === "string");
    if (!valido) throw new Error("La copia está dañada o incompleta.");
  }
  return origen;
}

async function importarCopia(archivo) {
  if (!archivo) return;
  try {
    const origen = leerCopia(await archivo.text());
    abrirFormulario({
      titulo: "Restaurar copia",
      mensaje: `Se reemplazarán tus datos actuales por la copia: ${origen.materias.length} materias, ${origen.tareas.length} tareas y ${origen.examenes.length} exámenes.`,
      textoBoton: "Restaurar",
      peligro: true,
      alGuardar: () => reemplazarDatos(origen)
    });
  } catch (error) {
    mostrarAviso(error.message);
  }
}

/* Lo que no está en la copia se marca como eliminado para que la sincronización no lo traiga de vuelta. */
function reemplazarDatos(origen) {
  const ahora = Date.now();
  const nuevos = { eliminados: { ...datos.eliminados } };
  const idsDeLaCopia = new Set();
  for (const nombre of COLECCIONES) {
    nuevos[nombre] = origen[nombre].map((item) => { idsDeLaCopia.add(item.id); return { ...item, modificado: ahora }; });
  }
  for (const nombre of COLECCIONES) {
    for (const item of datos[nombre]) if (!idsDeLaCopia.has(item.id)) nuevos.eliminados[item.id] = ahora;
  }
  datos = nuevos;
  guardarYRenderizar();
  mostrarAviso("Copia restaurada.");
}

function seccionCopias() {
  const ultima = leerMeta().ultimaCopia;
  return `<h2>Copia de seguridad</h2><div class="panel">
    <p>Guardá tus datos en un archivo como respaldo o para pasarlos a otro dispositivo.</p>
    <p class="meta">${ultima ? `Última copia: ${new Date(ultima).toLocaleDateString("es-AR")}` : "Todavía no hiciste ninguna copia."}</p>
    <div class="barra-acciones"><button class="boton" data-accion="exportar">Exportar copia</button>
    <button class="boton" data-accion="importar">Importar copia</button>
    <input type="file" id="archivo-importacion" accept="application/json,.json" data-accion="elegir-archivo" hidden></div></div>`;
}

function avisoDeCopia() {
  const hayDatos = datos.materias.length || datos.tareas.length || datos.examenes.length;
  const protegido = sesion || leerMeta().ultimaCopia > Date.now() - 14 * 86400000;
  if (!hayDatos || protegido || enModoNoMolestar()) return "";
  return `<p class="nota">Tus datos solo están en este dispositivo. <button class="boton chico" data-accion="ir" data-vista="datos">Protegerlos</button></p>`;
}
