#!/usr/bin/env node
/*
 * Personal OS — helper de bitácora: el asistente anexa el resumen de SU respuesta a la entrada del
 * día, debajo del prompt más reciente que ya registró el hook.
 *
 * Uso:
 *   node bitacora-append.js "<resumen de 1-2 líneas>"
 *   node bitacora-append.js --ts "<rango>|<clave>|<categoría>|<cliente>|<est>|<tarea>|<evidencia>"
 *   node bitacora-append.js "<resumen>" --ts "..." --ts "..."
 *
 * La línea **TS:** es la fuente primaria del timesheet (skill `timesheet`): un tramo laboral = una
 * línea TS colgada de una issue. Se valida AL ESCRIBIR contra config.json → timesheet; si no cuadra,
 * NO se escribe (exit 1) para que el error salte en el momento y no dos semanas después.
 *
 *   rango      HH:MM-HH:MM (no cruza medianoche)
 *   clave      PROY-123 (formato en timesheet.formatoClave) o la marca sin issue: se aceptan
 *              SIN-ISSUE / SIN-JIRA / "SIN ISSUE" y se escribe timesheet.claveSinIssue (SIN-ISSUE
 *              por defecto; quien ya tiene bitácoras con SIN-JIRA pone "SIN-JIRA")
 *   categoría  una de timesheet.categorias (las de timesheet.aliasCategorias se reescriben y se avisa)
 *   cliente    uno de timesheet.clientes
 *   est        est=4h (leída de la issue) o SIN-EST
 *
 * Otras claves opcionales de config.json → timesheet:
 *   codigosInternos         prefijos de códigos internos que no pueden ir en la tarea (D-01, C-12…)
 *   reunionIssueRecurrente  cómo encontrar la issue de reuniones del periodo (texto; {hoy} = fecha)
 *   reunionIssueNueva       dónde se crea una issue de reunión nueva (texto)
 *
 * No pone hora propia: queda asociado a la última entrada "## HH:MM" del prompt en curso.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('./lib/comun.js');

const POR_DEFECTO = {
  categorias: ['Reuniones', 'Planning', 'Análisis', 'Desarrollo', 'Revisión técnica', 'Pruebas (QA)',
    'Soporte', 'Gestión del proyecto', 'Otros'],
  aliasCategorias: {},
  categoriasReunion: ['Reuniones'],
  clientes: ['Interno'],
  clienteInterno: 'Interno',
  categoriasSinIssuePermitidas: ['Otros', 'Reuniones'],
  reunionesExigenIssueDesde: null,
  formatoClave: '^[A-Z][A-Z0-9]{1,9}-\\d+$',
  prohibidoEnTarea: ['claude', 'prompt', 'skill', 'subagente', 'agente ia', 'asistido por ia'],
  codigosInternos: ['D', 'C', 'R', 'P', 'A'],
  claveSinIssue: 'SIN-ISSUE',
  reunionIssueRecurrente: null,
  reunionIssueNueva: null,
};
const TS = Object.assign({}, POR_DEFECTO, C.config().timesheet || {});
const ALIAS_SIN_ISSUE = ['SIN-JIRA', 'SIN-ISSUE', 'SIN ISSUE'];
const SIN_ISSUE = ALIAS_SIN_ISSUE.includes(String(TS.claveSinIssue || '').toUpperCase())
  ? String(TS.claveSinIssue).toUpperCase() : 'SIN-ISSUE';

function fail(msg) {
  process.stdout.write('error: ' + msg + '\n');
  process.exit(1);
}

/* Compara sin tildes ni mayúsculas: las consolas manglan los acentos y una categoría mal escrita
 * terminaría copiada tal cual en el archivo de envío. Devuelve la forma canónica. */
function canonico(valor, validos) { return validos.find((v) => C.sinTildes(v) === C.sinTildes(valor)); }

function escaparRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/* Valida y normaliza una línea TS. Devuelve el string ya formateado. */
function parseTs(raw) {
  const p = raw.split('|').map((s) => s.trim());
  if (p.length !== 7) {
    fail(`TS necesita 7 campos separados por "|" (rango|clave|categoría|cliente|est|tarea|evidencia), llegaron ${p.length}: ${raw}`);
  }
  const [rango, claveRaw, catRaw, cliRaw, est, tarea, evidencia] = p;
  let clave = claveRaw.toUpperCase();
  if (ALIAS_SIN_ISSUE.includes(clave)) clave = SIN_ISSUE;

  let categoria = canonico(catRaw, TS.categorias);
  if (!categoria) {
    const k = Object.keys(TS.aliasCategorias || {}).find((v) => C.sinTildes(v) === C.sinTildes(catRaw));
    if (k) {
      categoria = TS.aliasCategorias[k];
      process.stdout.write(`aviso: categoría "${k}" reescrita a "${categoria}" (aliasCategorias en config.json)\n`);
    }
  }
  if (!categoria) fail(`categoría inválida "${catRaw}". Válidas: ${TS.categorias.join(' | ')}`);
  const cliente = canonico(cliRaw, TS.clientes);
  if (!cliente) fail(`cliente inválido "${cliRaw}". Válidos: ${TS.clientes.join(' | ')} (se configuran en config.json → timesheet.clientes)`);

  const m = /^([01]?\d|2[0-3]):([0-5]\d)-([01]?\d|2[0-3]):([0-5]\d)$/.exec(rango);
  if (!m) fail(`rango horario inválido "${rango}" (formato HH:MM-HH:MM)`);
  const ini = Number(m[1]) * 60 + Number(m[2]);
  const fin = Number(m[3]) * 60 + Number(m[4]);
  if (fin <= ini) fail(`el rango "${rango}" no avanza; una línea TS no cruza medianoche: pártela en dos`);

  let reClave;
  try { reClave = new RegExp(TS.formatoClave); } catch (e) { reClave = new RegExp(POR_DEFECTO.formatoClave); }
  if (clave !== SIN_ISSUE && !reClave.test(clave)) {
    fail(`clave de issue inválida "${clave}" (formato PROY-123, o ${SIN_ISSUE} si de verdad no existe issue)`);
  }
  if (!/^(est=(\d+([.,]\d+)?)h|SIN-EST)$/i.test(est)) {
    fail(`estimación inválida "${est}" (formato est=4h leído de la issue, o SIN-EST si la issue no tiene horas)`);
  }
  const estNorm = /^sin-est$/i.test(est) ? 'SIN-EST' : est.toLowerCase().replace(',', '.');
  if (clave === SIN_ISSUE && estNorm !== 'SIN-EST') fail(`sin issue no puede haber estimación: usa ${SIN_ISSUE}|...|SIN-EST`);

  const esReunion = (TS.categoriasReunion || []).includes(categoria);
  const desde = TS.reunionesExigenIssueDesde;
  if (clave === SIN_ISSUE && esReunion && desde && C.hoyISO() >= desde) {
    const recurrente = TS.reunionIssueRecurrente
      ? String(TS.reunionIssueRecurrente).split('{hoy}').join('<día>')
      : 'la issue de reuniones recurrentes del periodo';
    const nueva = TS.reunionIssueNueva ? String(TS.reunionIssueNueva) : 'una issue de reunión nueva';
    fail(`reunión [${categoria}] sin issue. Desde el ${desde} toda reunión cuelga de una issue: la del `
      + `proyecto que se trató, ${recurrente}, o ${nueva} creada con el OK de ${C.nombreCorto()} y `
      + 'estimación igual a la duración agendada');
  }
  if (clave === SIN_ISSUE
      && (cliente !== TS.clienteInterno || !(TS.categoriasSinIssuePermitidas || []).includes(categoria))) {
    fail(`${SIN_ISSUE} solo se acepta en trabajo interno (${TS.clienteInterno}) y en `
      + `${(TS.categoriasSinIssuePermitidas || []).join(' | ')}. Este tramo es trabajo de proyecto `
      + `(${cliente} / ${categoria}): consigue o crea la issue antes de registrarlo`);
  }
  if (!tarea || tarea.length < 15) {
    fail(`la tarea "${tarea}" es demasiado corta: escribe qué se hizo, sobre qué componente y con qué resultado`);
  }
  const prohibidas = (TS.prohibidoEnTarea || []).filter(Boolean);
  if (prohibidas.length && new RegExp(`\\b(${prohibidas.map(escaparRegex).join('|')})\\b`, 'i').test(tarea)) {
    fail('la tarea no menciona herramientas internas ni de IA: tradúcela a su equivalente de negocio');
  }
  const prefijos = (Array.isArray(TS.codigosInternos) ? TS.codigosInternos : POR_DEFECTO.codigosInternos)
    .map(String).filter(Boolean).map(escaparRegex);
  const reCodigos = new RegExp(`\\b(${prefijos.length ? `(?:${prefijos.join('|')})-\\d+|` : ''}`
    + 'punto \\d+ del MVP|fase \\d+)\\b', 'i');
  if (reCodigos.test(tarea)) {
    fail(`la tarea no lleva códigos internos (${prefijos.map((p) => `${p}-n`).join(', ')}, "punto N del MVP", `
      + '"fase N"): escribe QUÉ era');
  }
  if (!evidencia) fail('falta la evidencia (commit, script, endpoint, acta, id, etc.)');

  return `- **TS:** ${rango} | ${clave} | ${categoria} | ${cliente} | ${estNorm} | ${tarea} | ${evidencia}`;
}

try {
  const stateDir = C.stateDir();
  if (!stateDir) fail('sin stateDir configurado: corre /os-setup');

  const argv = process.argv.slice(2);
  const tsRaw = [];
  const libres = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--ts') {
      if (!argv[i + 1]) fail('--ts sin contenido');
      tsRaw.push(argv[++i]);
    } else if (argv[i] === '--estado' || argv[i] === '--hoy') {
      i++; // ya los consume comun.js
    } else {
      libres.push(argv[i]);
    }
  }

  const resumen = libres.join(' ').trim();
  const lineasTs = tsRaw.map(parseTs); // valida todo ANTES de escribir nada
  if (!resumen && !lineasTs.length) { process.stdout.write('skip: sin resumen\n'); process.exit(0); }

  const dir = path.join(stateDir, 'bitacora');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${C.hoyISO()}.md`);

  let out = '';
  if (resumen) out += `- **OS:** ${resumen.replace(/\r?\n+/g, ' ').trim()}\n`;
  for (const l of lineasTs) out += l + '\n';
  fs.appendFileSync(file, out, 'utf8');
  process.stdout.write(`ok${lineasTs.length ? ` (+${lineasTs.length} TS)` : ''}\n`);
} catch (e) {
  process.stdout.write('skip: ' + e.message + '\n');
}
process.exit(0);
