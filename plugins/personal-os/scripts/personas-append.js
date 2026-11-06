#!/usr/bin/env node
'use strict';
/*
 * Personal OS — anexar un hecho a la ficha de una persona.
 *
 * Esto es lo que convierte "lo que el usuario dice en una conversación" en memoria consultable.
 *
 *   node personas-append.js ana --hecho "Cerró el bug de la pasarela de pagos en media jornada"
 *   node personas-append.js luis --frente facturacion --nivel dueno --evidencia "construyó el módulo (PROY-142)"
 *   node personas-append.js persona-1 --frente reportes --cierra --hecho "Pasa a otro equipo"
 *
 * Reglas que el script HACE CUMPLIR, no sugiere:
 *   1. Un frente que no esté en _dominios.md se rechaza. Nunca se inventa un frente: un mapa con
 *      frentes inventados responde con confianza y se equivoca.
 *   2. Un hecho de frente que reemplaza a otro lo CIERRA con fecha; no lo borra ni lo reescribe.
 *   3. Los temas prohibidos por la política de datos de personas (salud, vida privada, creencias,
 *      credenciales) no se escriben. Ni con buena intención: la ficha es un registro sobre una
 *      persona real.
 *   4. Si el nombre es ambiguo (varias personas con el mismo nombre), falla y las lista.
 */

const fs = require('fs');
const path = require('path');
const L = require('./personas-lib.js');

const NIVELES = ['dueno', 'trabaja', 'toco', 'aprende'];
const FUENTES = ['declarado', 'jira', 'git', 'mixto'];

/*
 * Guardarraíl de la política de datos de personas. Deliberadamente corto y literal: no es un
 * clasificador, es un freno de mano. Su trabajo es interrumpir a quien escribe y obligar a decir
 * el hecho laboral en vez del dato personal: "no entregó" en vez de por qué no entregó.
 */
const PROHIBIDO = [
  { re: /\b(embaraz|licencia de maternidad|licencia de paternidad)/i, tema: 'situación familiar' },
  /*
   * SALUD — el guardarraíl más delicado de todos, y por una razón que no es obvia:
   * si el equipo hace software de salud, "diagnóstico", "cirugía", "paciente", "historia clínica"
   * y "quirófano" son vocabulario de NEGOCIO, no datos personales. Un detector por palabra suelta
   * rebota un "Diagnóstico de uso de Jira" y entrena a saltarse el control con --forzar.
   * Por eso se exige una MARCA PERSONAL junto al término: un posesivo, "está/estuvo", o la
   * palabra referida a la persona misma. El dominio del negocio no dispara; la vida de alguien sí.
   */
  { re: /\b(su|la|una)\s+(enfermedad|incapacidad|cirug[ií]a|cita m[eé]dica|licencia m[eé]dica)\b/i, tema: 'salud' },
  { re: /\b(est[aá]|estuvo|sigue|anda)\s+(enferm|incapacitad|hospitalizad|convalec)/i, tema: 'salud' },
  { re: /\b(diagnosticad[oa]|depresi[oó]n|crisis de ansiedad|psiqui[aá]tric|tratamiento m[eé]dico|incapacidad m[eé]dica)\b/i, tema: 'salud' },
  { re: /\b(divorci|separaci[oó]n|novi[oa]|esposa|esposo|pareja sentimental|infidel)/i, tema: 'vida privada' },
  { re: /\b(religi[oó]n|cristian|cat[oó]lic|evang[eé]lic|musulm|jud[ií]o|ate[oa]\b)/i, tema: 'religión' },
  { re: /\b(partido pol[ií]tico|vot[oó] por|izquierda pol[ií]tica|derecha pol[ií]tica)/i, tema: 'política' },
  { re: /\b(homosexual|gay|lesbian|orientaci[oó]n sexual|transg[eé]ner)/i, tema: 'orientación sexual' },
  /*
   * Credenciales: se busca el VALOR, no la palabra. Decir "Ana no tiene credenciales propias y
   * usa un token compartido" es un hecho operativo legítimo — y de los importantes. Bloquearlo
   * por contener la palabra "token" entrena a saltarse el guardarraíl con --forzar, que es la peor
   * forma de perder un control. Así que dispara cuando algo parece un secreto de verdad:
   * una asignación explícita, un bearer, o una cadena larga con pinta de clave.
   */
  { re: /\b(password|contrase[nñ]a|token|api[_ -]?key|secret|pat)\s*[:=]\s*\S/i, tema: 'credenciales' },
  { re: /\b(la (contrase[nñ]a|clave) es|bearer\s+[A-Za-z0-9._-]{10,})/i, tema: 'credenciales' },
  { re: /\b[A-Za-z0-9_-]{28,}\b/, tema: 'algo que parece una clave o un token' },
];

function salir(msg, codigo) {
  process.stderr.write(msg + '\n');
  process.exit(codigo === undefined ? 1 : codigo);
}

function uso() {
  process.stdout.write(`
personas-append — anexa un hecho fechado a la ficha de una persona

  node personas-append.js <persona> [opciones]

  --hecho "texto"        Lo que pasó. Va al historial de la ficha.
  --frente <alias>       Frente funcional (se resuelve contra _dominios.md por alias).
  --nivel <n>            ${NIVELES.join(' | ')}
  --desde AAAA-MM-DD     Desde cuándo es verdad el hecho (por defecto: hoy).
  --cierra               Cierra el hecho vigente de ese frente en vez de abrir uno nuevo.
  --corrige              Reemplaza el hecho vigente mal fechado en vez de cerrarlo.
  --fuente <f>           ${FUENTES.join(' | ')}   (por defecto: declarado)
  --evidencia "texto"    Qué lo sostiene. Obligatoria si hay --nivel.
  --crear                Crea la ficha si no existe.
  --dry-run              Muestra lo que haría, sin escribir.
  --forzar --motivo "…"  Salta el guardarraíl de datos personales. Queda registrado en la ficha.
  --estado <ruta>        Carpeta de estado alternativa (pruebas).

  Ejemplo: node personas-append.js ana --hecho "Entregó el reporte de cierre" --frente reportes
`);
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────── argumentos

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) uso();

const persona = argv[0].startsWith('--') ? null : argv[0];
if (!persona) salir('Falta la persona. Ej: node personas-append.js ana --hecho "…"');

const hecho = L.arg('--hecho', '');
const frenteRaw = L.arg('--frente', '');
const nivel = L.arg('--nivel', '');
const fuente = L.arg('--fuente', 'declarado');
const evidencia = L.arg('--evidencia', '');
const desde = L.arg('--desde', L.hoyISO());
const hoy = L.hoyISO();
const cierra = argv.includes('--cierra');
const corrige = argv.includes('--corrige');
const crear = argv.includes('--crear');
const dryRun = argv.includes('--dry-run');
const forzar = argv.includes('--forzar');
const motivo = L.arg('--motivo', '');

if (!hecho && !frenteRaw) salir('Nada que anexar: falta --hecho o --frente.');
if (nivel && !NIVELES.includes(nivel)) salir(`Nivel inválido "${nivel}". Válidos: ${NIVELES.join(', ')}`);
if (!FUENTES.includes(fuente)) salir(`Fuente inválida "${fuente}". Válidas: ${FUENTES.join(', ')}`);
if (nivel && !evidencia) {
  salir('Un nivel sin evidencia no se escribe (política de datos de personas).\n' +
        'Agrega --evidencia "qué lo sostiene, con fecha o clave de la issue".');
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) salir(`Fecha inválida en --desde: "${desde}". Formato: AAAA-MM-DD`);

// ────────────────────────────────────────── guardarraíl de datos personales

const textoCompleto = [hecho, evidencia].join(' ');
const choques = PROHIBIDO.filter((p) => p.re.test(textoCompleto));
if (choques.length) {
  const temas = [...new Set(choques.map((c) => c.tema))].join(', ');
  if (!forzar) {
    salir(
      `RECHAZADO por la política de datos de personas.\n` +
      `Tema detectado: ${temas}.\n\n` +
      `Esta ficha es un registro sobre una persona real. Escribe el HECHO LABORAL, no la causa\n` +
      `personal: "no entregó el 12/03" en vez de por qué no entregó.\n\n` +
      `Si de verdad hace falta, repite con:  --forzar --motivo "por qué es indispensable"`);
  }
  if (!motivo) salir('--forzar exige --motivo "por qué es indispensable". Sin motivo no se escribe.');
}

// ──────────────────────────────────────────────────────── cargar el estado

const base = L.stateDir();
if (!base) salir(L.SIN_ESTADO);
const dir = L.dirPersonas(base);
if (!fs.existsSync(dir)) salir(`No existe ${dir}. ¿Se sembró el módulo de personas con /os-setup?`);

const dominios = L.cargarDominios(base);

let frente = null;
if (frenteRaw) {
  // El diccionario solo se exige cuando hay frente: un hecho suelto en el historial no lo necesita.
  if (!dominios.frentes.length) {
    salir(`El diccionario ${path.join(dir, '_dominios.md')} está vacío o no se pudo leer.\n` +
          'Sin él no hay enlace semántico: declara ahí el frente antes de asignarlo.');
  }
  frente = L.resolverFrente(dominios, frenteRaw);
  if (!frente) {
    const sugerencias = dominios.frentes.map((f) => f.clave).join(', ');
    salir(
      `No conozco el frente "${frenteRaw}" y NO me lo voy a inventar.\n\n` +
      `Frentes en el diccionario:\n  ${sugerencias}\n\n` +
      `Si "${frenteRaw}" es como el usuario llama a uno de esos, agrégalo a su lista de alias en\n` +
      `${path.join(dir, '_dominios.md')} — esa es la pieza que hace que el módulo lo entienda.\n` +
      `Si es un frente nuevo, decláralo ahí primero.`);
  }
}

const fichas = L.leerFichas(base);
const res = L.resolverPersona(fichas, persona);

if (res && res.ambiguo) {
  salir(`"${persona}" es ambiguo. Coincide con:\n` +
        res.ambiguo.map((f) => `  · ${f.nombre}  (${f.slug})`).join('\n') +
        `\n\nUsa el slug exacto.`);
}

let ficha = res ? res.ficha : null;

if (!ficha) {
  if (!crear) {
    salir(`No hay ficha para "${persona}".\n` +
          `Fichas existentes: ${fichas.map((f) => f.slug).join(', ') || '(ninguna)'}\n` +
          `Para crearla: agrega --crear`);
  }
  ficha = crearFicha(persona);
}

// ─────────────────────────────────────────────────────────── construir edición

let texto = ficha.texto;
const acciones = [];

if (frente && cierra) {
  const r = cerrarHecho(texto, frente.clave, desde);
  if (!r.cambio) {
    salir(`No hay ningún hecho vigente de "${frente.clave}" en la ficha de ${ficha.nombre}.\n` +
          `Nada que cerrar. (Cerrar un hecho que no existe dejaría el histórico mintiendo.)`);
  }
  texto = r.texto;
  acciones.push(`cerrado el frente ${frente.clave} con hasta: ${desde}`);
}

if (frente && nivel) {
  const previo = L.parseListaObjetos(texto, 'frentes')
    .find((f) => f.clave === frente.clave && !L.txt(f.hasta));
  if (previo) {
    /*
     * Un hecho no puede terminar antes de empezar. Pasa de verdad: al corregir la fecha de un
     * hecho mal registrado (un frente pasó a alguien el 25/08, no el 15/09), cerrar el anterior
     * con la fecha nueva deja `desde: …-09-15, hasta: …-08-25`. Ese intervalo invertido envenena
     * toda consulta histórica, que es justo lo que el modelo bi-temporal existe para proteger.
     * Aquí se corta: o se corrige el hecho, o se explica por qué son dos.
     */
    const desdePrevio = L.txt(previo.desde);
    if (desdePrevio && desdePrevio > desde && !corrige) {
      salir(
        `El hecho vigente de "${frente.clave}" empieza el ${desdePrevio}, DESPUÉS de la fecha que\n` +
        `estás registrando (${desde}). Cerrarlo con esa fecha dejaría un intervalo invertido.\n\n` +
        `¿Lo que quieres es CORREGIR la fecha del hecho que ya está?  → agrega --corrige\n` +
        `¿De verdad son dos hechos distintos?  → revisa las fechas: algo no cuadra.`);
    }
    if (corrige) {
      texto = eliminarHecho(texto, frente.clave, desdePrevio);
      acciones.push(`CORREGIDO: reemplazado el hecho de ${frente.clave} que empezaba el ${desdePrevio}`);
    } else {
      const r = cerrarHecho(texto, frente.clave, desde);
      texto = r.texto;
      acciones.push(`cerrado el nivel anterior (${previo.nivel || '?'}) de ${frente.clave}`);
    }
  }
  texto = insertarHecho(texto, {
    clave: frente.clave, nivel, desde, fuente, evidencia, registrado_el: hoy,
  });
  acciones.push(`abierto ${frente.clave} = ${nivel} desde ${desde}`);
}

if (hecho) {
  const etiqueta = frente ? ` [${frente.clave}]` : '';
  const marca = (choques.length && forzar) ? `  ⚠️ forzado: ${motivo}` : '';
  const linea = `- **${desde}**${etiqueta} — ${hecho} *(fuente: ${fuente}${evidencia ? '; ' + evidencia : ''})*${marca}`;
  texto = anexarHistorial(texto, linea);
  acciones.push('anexado al historial');
}

if (dryRun) {
  process.stdout.write(`[dry-run] ${ficha.nombre} (${ficha.ruta})\n  ` + acciones.join('\n  ') + '\n');
  process.exit(0);
}

escribirAtomico(ficha.ruta, texto);
process.stdout.write(`ok — ${ficha.nombre}: ` + acciones.join('; ') + '\n');

// ─────────────────────────────────────────────────────────────── funciones

/** Inserta un hecho nuevo como primer item de la lista `frentes:` del frontmatter. */
function insertarHecho(texto, h) {
  const bloque = [
    `  - clave: ${h.clave}`,
    `    nivel: ${h.nivel}`,
    `    desde: ${h.desde}`,
    `    hasta: null`,
    `    fuente: ${h.fuente}`,
    `    evidencia: ${JSON.stringify(h.evidencia || '')}`,
    `    registrado_el: ${h.registrado_el}`,
  ].join('\n');

  if (/^frentes\s*:/m.test(texto)) {
    return texto.replace(/^frentes\s*:.*$/m, (m) => m + '\n' + bloque);
  }
  // No existe la clave: se crea justo antes del cierre del frontmatter.
  const fin = texto.indexOf('\n---', 4);
  if (fin < 0) return texto + '\n' + bloque;
  return texto.slice(0, fin) + '\nfrentes:\n' + bloque + texto.slice(fin);
}

/**
 * Pone `hasta: <fecha>` en el hecho vigente de ese frente. Recorre el bloque del item para no
 * tocar el `hasta` de otro frente que se llame parecido.
 */
function cerrarHecho(texto, clave, fecha) {
  const lineas = texto.split(/\r?\n/);
  let dentroFrentes = false;
  let inicio = -1;
  let fin = -1;

  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    if (/^frentes\s*:/.test(l)) { dentroFrentes = true; continue; }
    if (!dentroFrentes) continue;
    if (/^\S/.test(l) && l.trim() !== '') break;            // salió de la clave frentes

    const item = /^\s*-\s+clave\s*:\s*(.+)$/.exec(l);
    if (item) {
      if (inicio >= 0 && fin < 0) fin = i;                  // cerró el item que buscábamos
      if (L.limpia(item[1]) === clave && inicio < 0) inicio = i;
      continue;
    }
  }
  if (inicio < 0) return { texto, cambio: false };
  if (fin < 0) {
    fin = lineas.findIndex((l, i) => i > inicio && /^\S/.test(l) && l.trim() !== '');
    if (fin < 0) fin = lineas.length;
  }

  let cambio = false;
  for (let i = inicio; i < fin; i++) {
    const m = /^(\s*)hasta\s*:\s*(.*)$/.exec(lineas[i]);
    if (!m) continue;
    if (L.limpia(m[2]) !== '') return { texto, cambio: false };   // ya estaba cerrado
    lineas[i] = `${m[1]}hasta: ${fecha}`;
    cambio = true;
    break;
  }
  if (!cambio) { lineas.splice(inicio + 1, 0, `    hasta: ${fecha}`); cambio = true; }
  return { texto: lineas.join('\n'), cambio };
}

/**
 * Borra por completo el bloque de un hecho. Se usa SOLO con --corrige, cuando el hecho que hay
 * está mal fechado y lo correcto es reemplazarlo, no cerrarlo: cerrar un dato equivocado deja
 * el error dentro del histórico haciéndose pasar por un cambio real.
 */
function eliminarHecho(texto, clave, desdeEsperado) {
  const lineas = texto.split(/\r?\n/);
  let dentro = false;
  let inicio = -1;
  let fin = -1;

  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    if (/^frentes\s*:/.test(l)) { dentro = true; continue; }
    if (!dentro) continue;
    if (/^\S/.test(l) && l.trim() !== '') { if (inicio >= 0 && fin < 0) fin = i; break; }

    const item = /^\s*-\s+clave\s*:\s*(.+)$/.exec(l);
    if (!item) continue;
    if (inicio >= 0 && fin < 0) { fin = i; break; }
    if (L.limpia(item[1]) !== clave) continue;

    // Confirmar que es el bloque correcto mirando su `desde` antes de borrar nada.
    let coincide = !desdeEsperado;
    for (let j = i + 1; j < lineas.length && !/^\s*-\s+clave\s*:/.test(lineas[j]); j++) {
      const d = /^\s*desde\s*:\s*(.*)$/.exec(lineas[j]);
      if (d) { coincide = L.limpia(d[1]) === desdeEsperado; break; }
    }
    if (coincide) inicio = i;
  }
  if (inicio < 0) return texto;
  if (fin < 0) {
    fin = lineas.findIndex((l, i) => i > inicio && /^\S/.test(l) && l.trim() !== '');
    if (fin < 0) fin = lineas.length;
  }
  lineas.splice(inicio, fin - inicio);
  return lineas.join('\n');
}

function anexarHistorial(texto, linea) {
  if (/^##\s+Historial\s*$/m.test(texto)) {
    const partes = texto.split(/^##\s+Historial\s*$/m);
    const resto = partes[1] || '';
    // Se inserta al final de la sección: el historial se lee de arriba abajo, como la bitácora.
    const corte = resto.search(/^##\s+/m);
    if (corte < 0) return partes[0] + '## Historial' + resto.replace(/\s*$/, '\n') + linea + '\n';
    return partes[0] + '## Historial' + resto.slice(0, corte).replace(/\s*$/, '\n') + linea + '\n\n' + resto.slice(corte);
  }
  return texto.replace(/\s*$/, '\n') + '\n## Historial\n\n' + linea + '\n';
}

function crearFicha(nombreCrudo) {
  const slug = L.normalizar(nombreCrudo).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!slug) salir(`No se puede crear una ficha con el nombre "${nombreCrudo}".`);
  const ruta = path.join(dir, slug + '.md');
  if (fs.existsSync(ruta)) salir(`Ya existe ${ruta} pero no se pudo leer como ficha. Revísala a mano.`);

  const nombre = nombreCrudo.replace(/(^|\s)(\S)/g, (m, esp, c) => esp + c.toUpperCase());
  const contenido = `---
tipo: persona
nombre: "${nombre}"
slug: ${slug}
alias: [${L.normalizar(nombreCrudo).split(' ')[0]}]
estado: activo
relacion: reporta
rol: ""
desde: ${hoy}
hasta: null

identidades:
  jira: null
  correo: null
  git: []
  azure: null
  verificado: false

frentes:

clientes: []
proyectos: []

derivado_el: null
issues_abiertas: null
issues_vencidas: null
ultimo_movimiento_jira: null
conflictos: []
---

# ${nombre}

> Ficha creada el ${hoy} por personas-append. Falta completar rol, identidades y frentes.

## Cómo trabaja

*(sin hechos registrados todavía)*

## Historial
`;
  if (!dryRun) fs.writeFileSync(ruta, contenido, 'utf8');
  return { archivo: slug + '.md', ruta, texto: contenido, nombre, slug, alias: [], frentes: [] };
}

function escribirAtomico(ruta, contenido) {
  const tmp = ruta + '.tmp';
  fs.writeFileSync(tmp, contenido, 'utf8');
  fs.renameSync(tmp, ruta);
}
