#!/usr/bin/env node
/*
 * Personal OS — rotación de la bitácora (el «olvido» del cerebro).
 * El cerebro olvida volviendo inaccesible, no borrando, y solo después de consolidar: aquí un diario con
 * config.json → bitacora.retencionDias días o más (30 por defecto) se MUEVE a bitacora/_archivo/AAAA-MM/
 * y solo si su semana ISO ya tiene su resumen-AAAA-Www.md (lo escribe el sueño semanal). Nada se borra:
 * el timesheet y los cortes de horas extra leen líneas TS antiguas, y os-buscar sigue encontrando lo archivado.
 * Los resúmenes y cualquier otro archivo se respetan.
 * Uso:  node bitacora-rotate.js         → archiva los vencidos ya consolidados
 *       node bitacora-rotate.js --dry   → solo lista lo que haría
 */
'use strict';
const fs = require('fs');
const path = require('path');

const dry = process.argv.includes('--dry');

/** Semana ISO 8601 de una fecha AAAA-MM-DD → "AAAA-Www". */
function semanaISO(ymd) {
  const d = new Date(`${ymd}T00:00:00Z`);
  const dia = (d.getUTCDay() + 6) % 7;            // lunes = 0
  d.setUTCDate(d.getUTCDate() - dia + 3);         // jueves de esa semana
  const anio = d.getUTCFullYear();
  const primerJueves = new Date(Date.UTC(anio, 0, 4));
  const semana = 1 + Math.round(((d - primerJueves) / 864e5 - 3 + ((primerJueves.getUTCDay() + 6) % 7)) / 7);
  return `${anio}-W${String(semana).padStart(2, '0')}`;
}

try {
  const C = require('./lib/comun.js');
  const reten = Number((C.config().bitacora || {}).retencionDias) || 30;
  const stateDir = C.stateDir();
  if (!stateDir) { console.log('sin stateDir configurado; corre /os-setup'); process.exit(0); }
  const dir = path.join(stateDir, 'bitacora');
  if (!fs.existsSync(dir)) { console.log('bitacora/ no existe; nada que rotar'); process.exit(0); }

  const hoy = C.hoyISO();
  const resumenes = new Set(fs.readdirSync(dir).map((f) => (f.match(/^resumen-(\d{4}-W\d{2})\.md$/) || [])[1]).filter(Boolean));
  let archivados = 0; let pendientes = 0;
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^(\d{4}-\d{2}-\d{2})\.md$/); // solo diarios
    if (!m) continue;
    const edad = C.diasEntre(m[1], hoy);
    if (edad === null || edad < reten) continue;
    const sem = semanaISO(m[1]);
    if (!resumenes.has(sem)) { pendientes++; if (dry) console.log('[dry] sin consolidar, se queda', f, `(${sem})`); continue; }
    const destino = path.join(dir, '_archivo', m[1].slice(0, 7));
    if (dry) { console.log('[dry] archivaría', f, '→', path.relative(dir, destino)); continue; }
    fs.mkdirSync(destino, { recursive: true });
    fs.renameSync(path.join(dir, f), path.join(destino, f));
    console.log('archivado', f, `(${edad} d, ${sem})`); archivados++;
  }
  console.log(`${dry ? 'dry-run' : 'rotación'} completa (retención ${reten} d): ${archivados} archivado(s) · ${pendientes} vencido(s) esperando su resumen semanal`);
} catch (e) {
  console.log('rotate skip:', e.message);
}
process.exit(0);
