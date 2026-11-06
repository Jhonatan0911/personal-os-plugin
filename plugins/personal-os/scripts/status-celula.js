#!/usr/bin/env node
'use strict';
/*
 * Personal OS — Status de la célula: maqueta el tablero HTML a partir de un JSON de datos.
 *
 *   node status-celula.js <datos.json> [--salida <archivo.html>] [--estado <carpeta>]
 *   node status-celula.js --ejemplo [--salida <archivo.html>]
 *
 * El JSON lo arma la skill `status-celula` cruzando el estado del Personal OS con Jira (solo lectura).
 * Este script NO consulta nada: solo calcula y maqueta. Así el tablero es reproducible y se puede
 * regenerar sin red. Las cifras (veredictos, colas, cobertura, métricas de Jira y de timesheets) se
 * calculan AQUÍ desde los datos crudos: el tablero no puede contradecir a su propia fuente.
 *
 * Salida por defecto: <stateDir>/status-celula-<corte>.html (archivo local y privado; no se publica).
 *
 * ── Formato del JSON (todo opcional salvo personas e items) ─────────────────────────────────────
 * {
 *   "corte": "AAAA-MM-DD",            // hoy por defecto
 *   "desde": "AAAA-MM-DD",            // día 1 del mes del corte por defecto (para ver la traza)
 *   "hasta": "AAAA-MM-DD",            // corte + 8 semanas por defecto
 *   "titulo": "...", "kicker": "...",
 *   "capacidad_factor": 0.8,          // parte de la jornada que es trabajo efectivo
 *   "sla_revision": 2, "sla_implementacion": 5,   // días hábiles que puede esperar cada cola
 *   "limite_wip": null,               // máximo de issues «en desarrollo» por persona (null = no se mide)
 *   "proyectos_propios": ["PROY"],    // lo de otro proyecto es TRANSVERSAL (se muestra con su nombre)
 *   "estados": { "revision": [...], "implementacion": [...], "no_cierre": [...], "pausa": [...],
 *                "desarrollo": [...] },  // nombres de estado de TU Jira (hay valores por defecto)
 *   "personas": [{ "slug", "nombre", "jira" (displayName exacto), "lider": true?, "prestamo"?, "color"? }],
 *   "frentes":  [{ "clave", "nombre", "color"?, "titular"?, "backup"? }],
 *   "reparto":  { "titular": 2, "backup": 2 }?,   // equilibrio que promete tu acuerdo de equipo
 *   "items": [{ "id", "titulo", "persona" (slug), "frente", "proyecto", "tipo"?,
 *               "inicio", "fin" (vencimiento), "cierre"? (fecha real de cierre), "horas" (estimado),
 *               "trabajado"? (registrado), "estado", "cerrada"?, "pausada"?, "entrada_cola"?,
 *               "nota"?, "url"? }],
 *       tipo: "issue" (por defecto) | "reunion" (horas = duración agendada) | "compromiso"
 *       horas: estimado de Jira. 0 = sin estimar (se marca, no se rellena).
 *       trabajado: lo registrado. Se OMITE si no se sabe; 0 significa «no ha registrado nada».
 *   "sin_programar": [{ "id", "titulo", "frente", "horas", "persona", "proyecto", "pausada"?, "etiqueta"? }],
 *   "bloqueos_cliente" | "bloqueos_equipo" | "recursos" | "requerimientos" | "frentes_status" | "resuelto":
 *       [{ "titulo", "detalle", "dias", "etiquetas": [{ "txt", "tipo": "c" | "a" | "" }] }],
 *   "lider": { "prioridad", "fecha_brief", "compromisos": [...], "terceros": [...], "riesgos": [...],
 *              "alcances": [...] },
 *   "jira": { "corte_movimiento"?, "proyectos": [{ "clave", "nombre" }], "externos"?: [{ "nombre", "jira" }],
 *             "issues": [{ "clave", "titulo", "proyecto", "persona" (displayName), "estado",
 *                          "categoria" ("new"|"indeterminate"|"done"), "fin", "estimado", "trabajado",
 *                          "actualizado", "url"? }] },
 *   "timesheets": { "desde", "hasta", "personas": [{ "nombre", "envios": [...], "filas": [...] }] }
 * }
 */
const fs = require('fs');
const path = require('path');
const C = require('./lib/comun.js');

const PLANTILLA = path.join(C.PLUGIN_ROOT, 'skills', 'status-celula', 'plantilla.html');
const EJEMPLO = path.join(C.PLUGIN_ROOT, 'skills', 'status-celula', 'ejemplo.json');

// Paleta categórica neutra (legible en claro y en oscuro con texto blanco). Sin identidad corporativa.
const PALETA = ['#4F6D8F', '#5B8C6E', '#9A6F3E', '#7A5C99', '#3F8A8C', '#A45A6A', '#6B7A3A', '#5E6B7D'];

const ESTADOS_DEF = {
  revision: ['Listo para revisión', 'En revisión técnica', 'En revisión', 'Code review'],
  implementacion: ['Listo para implementación', 'Listo para publicar'],
  no_cierre: ['Redefinido', "Won't Do", 'Duplicado'],
  pausa: ['Pausado', 'En pausa', 'Bloqueado'],
  desarrollo: ['En Desarrollo', 'En curso', 'In Progress'],
};

const DIAS_CFG = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];

function uso(msg) {
  if (msg) console.error(msg);
  console.error('Uso: node status-celula.js <datos.json> [--salida <archivo.html>] [--estado <carpeta>]\n' +
                '     node status-celula.js --ejemplo [--salida <archivo.html>]');
  process.exit(1);
}

/** Primer argumento posicional (que no sea una bandera ni el valor de una). */
function posicional() {
  const conValor = new Set(['--salida', '--estado', '--hoy']);
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (conValor.has(a[i])) { i++; continue; }
    if (!a[i].startsWith('--')) return a[i];
  }
  return null;
}

// ── Fechas ───────────────────────────────────────────────────────────────────────────────────
const MS = 86400000;
const dUTC = (s) => new Date(Date.parse(s + 'T00:00:00Z'));
const iso = (d) => d.toISOString().slice(0, 10);
const addD = (s, n) => iso(new Date(dUTC(s).getTime() + n * MS));
const valida = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));

function contexto(datos) {
  const cfg = C.config();
  const fest = new Set([...(cfg.festivos || []), ...(datos.festivos || [])].map(String));
  // Jornada por día de la semana: datos.jornada > config.json timesheet.jornada > lunes a viernes 8 h.
  const j = datos.jornada || (cfg.timesheet && cfg.timesheet.jornada) || null;
  const jornada = DIAS_CFG.map((k, i) => {
    if (Array.isArray(j)) return +j[i] || 0;
    if (j && j[k] != null) return +j[k] || 0;
    return i >= 1 && i <= 5 ? 8 : 0;
  });
  const habil = (s) => jornada[dUTC(s).getUTCDay()] > 0 && !fest.has(s);
  /** Días hábiles de a (excl.) a b (incl.). Negativo si b < a. */
  const habiles = (a, b) => {
    if (!valida(a) || !valida(b)) return null;
    if (a === b) return 0;
    const paso = a < b ? 1 : -1;
    let n = 0, cur = a;
    while (cur !== b) { cur = addD(cur, paso); if (habil(cur)) n += paso; }
    return n;
  };
  return { fest, jornada, habil, habiles };
}

const norm = (s) => C.sinTildes(s || '');
const enLista = (estado, lista) => lista.some((x) => norm(x) === norm(estado));

// ── Construcción ─────────────────────────────────────────────────────────────────────────────
function construir(datos) {
  const ctx = contexto(datos);
  const corte = valida(datos.corte) ? datos.corte : C.hoyISO();
  const desde = valida(datos.desde) ? datos.desde : corte.slice(0, 8) + '01';
  const hasta = valida(datos.hasta) ? datos.hasta : addD(corte, 56);
  const E = Object.assign({}, ESTADOS_DEF, datos.estados || {});
  const propios = (datos.proyectos_propios || []).map(String);
  const avisos = [];

  // Personas: el líder primero, siempre con carril propio.
  const personas = (datos.personas || []).map((p, i) => Object.assign({}, p, {
    slug: p.slug || norm(p.nombre).replace(/[^a-z0-9]+/g, '-'),
    color: p.color || PALETA[i % PALETA.length],
  }));
  personas.sort((a, b) => (b.lider ? 1 : 0) - (a.lider ? 1 : 0));
  const lider = personas.find((p) => p.lider) || null;
  const slugs = new Set(personas.map((p) => p.slug));
  if (!lider) avisos.push('Nadie está marcado como líder: las colas de revisión e implementación no tienen carril donde pintarse.');

  (datos.frentes || []).forEach((f, i) => { f.color = f.color || PALETA[i % PALETA.length]; });

  // Items: se normalizan, se clasifican y se anclan a la ventana. Nada se descarta en silencio.
  const items = [];
  const sinProgramar = (datos.sin_programar || []).map((x) => Object.assign({}, x));
  for (const x0 of datos.items || []) {
    const x = Object.assign({}, x0);
    x.tipo = x.tipo || 'issue';
    if (x.proyecto && propios.length && !propios.includes(x.proyecto)) x.transversal = true;
    if (enLista(x.estado, E.no_cierre)) { x.tipo = 'redefinido'; x.cerrada = false; }
    else if (enLista(x.estado, E.implementacion)) { x.tipo = 'implementacion'; x.cerrada = false; }
    if (enLista(x.estado, E.pausa)) x.pausada = true;
    if (!x.cerrada && x.tipo !== 'implementacion' && x.tipo !== 'redefinido' && enLista(x.estado, E.revision)) x.en_revision = true;

    x.vence = valida(x.fin) ? x.fin : null;
    if (x.cerrada || x.tipo === 'redefinido') {
      const fin = valida(x.cierre) ? x.cierre : x.vence;
      if (!fin) { x.sin_fecha_cierre = true; sinProgramar.push(Object.assign({ etiqueta: 'cerrada sin fecha' }, x)); continue; }
      x.ini = valida(x.inicio) && x.inicio <= fin ? x.inicio : fin;
      x.fin = fin;
      if (x.cerrada && x.vence && fin > x.vence) x.tarde = ctx.habiles(x.vence, fin);
      if (x.fin < desde) continue;   // la traza empieza en la ventana; lo anterior ya no es de este corte
    } else {
      if (!x.vence) { sinProgramar.push(Object.assign({ etiqueta: x.pausada ? 'pausada' : '' }, x)); continue; }
      x.fin = x.vence;
      x.ini = valida(x.inicio) && x.inicio <= x.fin ? x.inicio : x.fin;
      x.vencida = x.tipo !== 'implementacion' && x.fin < corte;
    }
    // Lo anterior a la ventana entra anclado al primer día con «↤ fecha real».
    if (x.fin < desde) { x.recortada = x.fin; x.ini = desde; x.fin = desde; }
    else if (x.ini < desde) { x.desde_real = x.ini; x.ini = desde; }
    if (x.fin > hasta) { x.sigue = x.fin; x.fin = hasta; if (x.ini > hasta) x.ini = hasta; }
    items.push(x);
  }

  // Colas del líder: revisión e implementación de cada persona. Son trabajo del líder aunque la
  // issue sea del desarrollador. Se pintan en SU carril como marcas cortas que terminan hoy.
  const colas = [];
  if (lider) {
    for (const tipo of ['revision', 'implementacion']) {
      for (const p of personas) {
        const lista = items.filter((i) => i.persona === p.slug &&
          (tipo === 'revision' ? i.en_revision : i.tipo === 'implementacion'));
        if (!lista.length) continue;
        const sla = tipo === 'revision' ? (datos.sla_revision ?? 2) : (datos.sla_implementacion ?? 5);
        const grupo = lista.map((i) => ({
          id: i.id, titulo: i.titulo, horas: +i.horas || 0, url: i.url || '',
          desde: valida(i.entrada_cola) ? i.entrada_cola : (i.recortada || i.desde_real || i.ini),
        })).sort((a, b) => a.desde.localeCompare(b.desde));
        const espera = Math.max(0, ctx.habiles(grupo[0].desde, corte) || 0);
        const c = {
          id: `COLA·${tipo}·${p.slug}`, tipo: 'grupo', cola: tipo, persona: lider.slug, de: p.slug,
          titulo: `${tipo === 'revision' ? 'Revisar a' : 'Publicar a'} ${p.nombre} · ${grupo.length}`,
          grupo, espera, sla, vencida: espera > sla, fijo: true, frente: null,
          ini: corte, fin: corte, horas: grupo.reduce((a, g) => a + g.horas, 0),
          sin_est: grupo.filter((g) => !g.horas).length,
          sin_entrada: lista.some((i) => !valida(i.entrada_cola)),
        };
        colas.push(c);
        items.push(c);
      }
    }
  }

  // Cobertura: ninguna regla oculta issues de alguien con carril, y lo que se pierda se dice.
  const porJira = new Map(personas.filter((p) => p.jira).map((p) => [norm(p.jira), p.slug]));
  const sinCarril = new Map();
  for (const x of [...items, ...sinProgramar]) {
    if (x.tipo === 'grupo' || !x.persona || slugs.has(x.persona)) continue;
    sinCarril.set(x.persona, (sinCarril.get(x.persona) || 0) + 1);
  }
  for (const [p, n] of sinCarril) avisos.push(`${n} item(s) asignados a «${p}», que no tiene carril: no se ven en el cronograma. Agrega la persona o corrige el slug.`);
  if (datos.jira && Array.isArray(datos.jira.issues)) {
    const vistos = new Set([...items.map((i) => i.id), ...sinProgramar.map((i) => i.id)]);
    const faltan = datos.jira.issues.filter((i) => i.persona && porJira.has(norm(i.persona)) &&
      i.categoria !== 'done' && !vistos.has(i.clave));
    if (faltan.length) {
      avisos.push(`${faltan.length} issue(s) abiertas de personas con carril vienen de Jira y no están en el tablero: ` +
        faltan.slice(0, 12).map((i) => `${i.clave} (${i.persona})`).join(', ') + (faltan.length > 12 ? '…' : '') +
        '. Revisa el filtro que armó los items.');
    }
    const nombresJira = new Set(datos.jira.issues.map((i) => norm(i.persona)).filter(Boolean));
    for (const p of personas) {
      if (p.jira && !nombresJira.has(norm(p.jira))) {
        avisos.push(`«${p.nombre}» no aparece en la lectura de Jira con el nombre «${p.jira}». Si no es el displayName exacto, su trabajo desaparece sin avisar.`);
      }
    }
  }
  if (items.some((i) => i.en_revision) && colas.some((c) => c.sin_entrada)) {
    avisos.push('Sin historial de cambios, la entrada a una cola se toma de la fecha de inicio o de la última actualización: la espera es aproximada.');
  }

  const salida = Object.assign({}, datos, {
    corte, desde, hasta, personas, items, sin_programar: sinProgramar,
    festivos: [...ctx.fest].sort(), jornada: ctx.jornada,
    capacidad_factor: datos.capacidad_factor ?? 0.8,
    cobertura: { avisos },
    colas_resumen: colas.map((c) => ({
      cola: c.cola, de: c.de, n: c.grupo.length, horas: c.horas, sin_est: c.sin_est,
      mas_vieja: c.grupo[0], espera: c.espera, sla: c.sla,
    })),
  });
  if (datos.jira) salida.jira = Object.assign({}, datos.jira, { metricas: metricasJira(datos.jira, corte, personas, E, datos.limite_wip) });
  if (datos.timesheets) salida.timesheets = Object.assign({}, datos.timesheets, { metricas: metricasTimesheets(datos.timesheets, corte, ctx) });
  return salida;
}

// ── Status Jira: las nueve columnas, calculadas desde las issues crudas ─────────────────────────
function fila(issues, corte, corteMov, E) {
  const f = { abiertas: issues.length, con_resp: 0, sin_resp: 0, en_desarrollo: 0, en_revision: 0,
              sin_mov: 0, vencidas: 0, sin_est: 0, sin_fecha: 0 };
  for (const i of issues) {
    if (i.persona) f.con_resp++; else f.sin_resp++;
    if (enLista(i.estado, E.desarrollo)) f.en_desarrollo++;
    if (enLista(i.estado, E.revision)) f.en_revision++;
    if ((i.actualizado || '9999').slice(0, 10) < corteMov) f.sin_mov++;
    if (i.estimado == null || !(+i.estimado)) f.sin_est++;
    if (!i.fin) f.sin_fecha++; else if (i.fin < corte) f.vencidas++;
  }
  return f;
}

function metricasJira(j, corte, personas, E, limiteWip) {
  const corteMov = j.corte_movimiento || addD(corte, -30);
  const abiertas = (j.issues || []).filter((i) => i.categoria !== 'done' && !enLista(i.estado, E.no_cierre));
  const claves = (j.proyectos || []).map((p) => p.clave);
  const proyectos = [];
  let delProyecto = [];
  for (const p of j.proyectos || []) {
    const sub = abiertas.filter((i) => i.proyecto === p.clave);
    delProyecto = delProyecto.concat(sub);
    proyectos.push(Object.assign({ clave: p.clave, nombre: p.nombre || '' }, fila(sub, corte, corteMov, E)));
  }
  if (proyectos.length) proyectos.push(Object.assign({ clave: 'TOTAL', nombre: '', total: true }, fila(delProyecto, corte, corteMov, E)));

  // La carga de una persona no se parte por proyecto: se cuentan TODAS sus issues abiertas.
  const celula = personas.filter((p) => p.jira).map((p) => Object.assign(
    { nombre: p.nombre, jira: p.jira, lider: !!p.lider },
    fila(abiertas.filter((i) => norm(i.persona) === norm(p.jira)), corte, corteMov, E)))
    .sort((a, b) => b.abiertas - a.abiertas);
  const nombresCelula = new Set(personas.filter((p) => p.jira).map((p) => norm(p.jira)));
  if (celula.length) celula.push(Object.assign({ nombre: 'TOTAL', jira: '', total: true },
    fila(abiertas.filter((i) => nombresCelula.has(norm(i.persona))), corte, corteMov, E)));

  // Los de fuera se miden SOLO dentro de tus proyectos: es lo único por lo que te pueden preguntar.
  const externos = (j.externos || []).map((p) => Object.assign({ nombre: p.nombre || p.jira, jira: p.jira, externo: true },
    fila(abiertas.filter((i) => norm(i.persona) === norm(p.jira) && claves.includes(i.proyecto)), corte, corteMov, E)))
    .sort((a, b) => b.abiertas - a.abiertas);
  const huerfanas = fila(abiertas.filter((i) => !i.persona && claves.includes(i.proyecto)), corte, corteMov, E);
  const excede = limiteWip ? celula.filter((f) => !f.total && f.en_desarrollo > limiteWip).map((f) => f.nombre) : [];
  return { proyectos, celula, externos, huerfanas, limite_wip: limiteWip || null, excede_wip: excede, corte_movimiento: corteMov };
}

// ── Timesheets del equipo: semáforo por día y % de horas que cuelgan de una issue ──────────────
function metricasTimesheets(t, corte, ctx) {
  const cfg = C.config();
  let reClave = /^[A-Z][A-Z0-9]{1,9}-\d+$/;
  try { if (cfg.timesheet && cfg.timesheet.formatoClave) reClave = new RegExp(cfg.timesheet.formatoClave); } catch (e) { /* se queda el de serie */ }
  const claveOk = (v) => reClave.test(String(v || '').trim().toUpperCase());
  if (!valida(t.desde) || !valida(t.hasta)) return { dias: [], personas: [], faltas: 0 };
  // Las semanas arrancan en lunes.
  let lunes = t.desde;
  while (dUTC(lunes).getUTCDay() !== 1) lunes = addD(lunes, -1);
  const dias = [];
  for (let d = lunes; d <= t.hasta; d = addD(d, 1)) {
    const w = dUTC(d).getUTCDay();
    if (ctx.jornada[w] > 0) dias.push({ f: d, festivo: ctx.fest.has(d) });
  }
  const personas = (t.personas || []).map((p) => {
    const envios = new Map((p.envios || []).map((e) => [e.id, e]));
    const filas = p.filas || [];
    // Un día sale de UN solo envío: el más reciente que lo traiga. Sumar envíos acumulados duplica horas.
    const elegido = new Map();
    for (const f of filas) {
      const cuando = (envios.get(f.envio) || {}).fecha_correo || '';
      if (f.fecha && cuando >= ((elegido.get(f.fecha) || [''])[0])) elegido.set(f.fecha, [cuando, f.envio]);
    }
    const vigentes = filas.filter((f) => f.fecha && (elegido.get(f.fecha) || [])[1] === f.envio);
    const porDia = dias.map(({ f: d, festivo }) => {
      const fd = vigentes.filter((f) => f.fecha === d);
      const horas = +fd.reduce((a, f) => a + (+f.horas || 0), 0).toFixed(2);
      const hj = +fd.filter((f) => claveOk(f.jira)).reduce((a, f) => a + (+f.horas || 0), 0).toFixed(2);
      const envio = envios.get((elegido.get(d) || [])[1]) || {};
      let estado;
      if (festivo) estado = 'festivo';
      else if (horas > 0) estado = (envio.fecha_correo || '').slice(0, 10) >= d ? 'ok' : 'sin_correo';
      else if ([...envios.values()].some((e) => e.leido === false && (e.dias || []).includes(d))) estado = 'no_leido';
      else if (d >= corte) estado = 'pendiente';
      else estado = 'falta';
      const agr = new Map();
      for (const f of fd) {
        const k = (claveOk(f.jira) ? String(f.jira).trim() : '') + '\u0001' + String(f.tarea || '').trim();
        agr.set(k, (agr.get(k) || 0) + (+f.horas || 0));
      }
      const actividades = [...agr.entries()].sort((a, b) => b[1] - a[1])
        .map(([k, h]) => ({ jira: k.split('\u0001')[0], tarea: k.split('\u0001')[1], horas: +h.toFixed(2) }));
      return { fecha: d, estado, horas, horas_jira: hj, actividades,
               sin_jira: fd.filter((f) => !claveOk(f.jira)).map((f) => ({ tarea: f.tarea || '', horas: +f.horas || 0 })),
               correo: envio.fecha_correo || '' };
    });
    const semanas = [];
    for (let i = 0; i < porDia.length; i += 5) {
      const s = porDia.slice(i, i + 5);
      const exig = s.filter((x) => ['ok', 'sin_correo', 'falta'].includes(x.estado));
      const h = +s.reduce((a, x) => a + x.horas, 0).toFixed(2);
      const hj = +s.reduce((a, x) => a + x.horas_jira, 0).toFixed(2);
      semanas.push({ desde: s[0].fecha, hasta: s[s.length - 1].fecha, dias_exigibles: exig.length,
                     dias_reportados: exig.filter((x) => x.estado !== 'falta').length,
                     horas: h, horas_jira: hj, pct_jira: h ? Math.round(hj / h * 100) : null });
    }
    return { nombre: p.nombre, envios: [...envios.values()].sort((a, b) => (a.fecha_correo || '').localeCompare(b.fecha_correo || '')),
             sin_leer: [...envios.values()].filter((e) => e.leido === false).length,
             dias: porDia, semanas, faltas: porDia.filter((x) => x.estado === 'falta').length };
  });
  return { dias: dias.map((d) => d.f), personas, faltas: personas.reduce((a, p) => a + p.faltas, 0),
           meta: (cfg.timesheet && cfg.timesheet.metaCoberturaIssue) || 0.9 };
}

// ── Maquetado ────────────────────────────────────────────────────────────────────────────────
const escHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function maquetar(d) {
  const html = C.leerTexto(PLANTILLA, null);
  if (html === null) throw new Error('No encuentro la plantilla: ' + PLANTILLA);
  // Texto de terceros (títulos, comentarios) viaja dentro de un <script>: "</" lo cerraría.
  const crudo = JSON.stringify(d).replace(/</g, '\\u003c');   // JSON.parse acepta U+2028/2029 tal cual
  const marca = '<script id="datos" type="application/json">__DATOS_JSON__</script>';
  if (!html.includes(marca)) throw new Error('La plantilla no tiene el bloque de datos: ' + PLANTILLA);
  // Primero los títulos y al final los datos: así un texto de los datos nunca se toma por marcador.
  return html
    .replace(/__TITULO__/g, () => escHtml(d.titulo || 'Status de la célula'))
    .replace(/__KICKER__/g, () => escHtml(d.kicker || 'PERSONAL OS · STATUS DE LA CÉLULA'))
    .replace(marca, () => marca.replace('__DATOS_JSON__', () => crudo));
}

function main() {
  const ejemplo = process.argv.includes('--ejemplo');
  const entrada = ejemplo ? EJEMPLO : posicional();
  if (!entrada) uso();
  const datos = C.leerJson(path.resolve(entrada), null);
  if (!datos) uso(`No pude leer el JSON: ${entrada}`);
  if (!Array.isArray(datos.personas) || !datos.personas.length) uso('El JSON no trae «personas»: el tablero no tiene carriles.');

  const d = construir(datos);
  let salida = C.arg('--salida', null);
  if (!salida) {
    const sd = C.stateDir();
    if (!sd) uso('No hay stateDir en ~/.claude/personal-os/config.json. Corre /os-setup o pasa --salida <archivo.html>.');
    salida = path.join(sd, `status-celula-${d.corte}.html`);
  }
  salida = path.resolve(salida);
  fs.mkdirSync(path.dirname(salida), { recursive: true });
  fs.writeFileSync(salida, maquetar(d), 'utf8');

  const pend = d.items.filter((i) => !i.cerrada && !['grupo', 'implementacion', 'redefinido'].includes(i.tipo));
  console.log('Tablero: ' + salida);
  console.log(`  ${d.personas.length} carriles · ${pend.length} pendientes con fecha · ${pend.filter((i) => i.vencida).length} vencidas · ` +
              `${d.sin_programar.length} sin programar · ${d.colas_resumen.length} colas del líder`);
  if (d.cobertura.avisos.length) {
    console.log('  COBERTURA — lo que se pierde o no cuadra:');
    d.cobertura.avisos.forEach((a) => console.log('   · ' + a));
  } else {
    console.log('  Cobertura: todo lo de las personas con carril está en el tablero.');
  }
}

if (require.main === module) {
  try { main(); } catch (e) { console.error('status-celula: ' + (e && e.message ? e.message : e)); process.exit(1); }
}

module.exports = { construir, metricasJira, metricasTimesheets };
