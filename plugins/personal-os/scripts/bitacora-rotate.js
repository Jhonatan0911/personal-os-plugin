#!/usr/bin/env node
/*
 * Personal OS — rotación de la bitácora.
 * Política: los diarios con config.json → bitacora.retencionDias días de antigüedad o más (30 por defecto)
 * se borran; se conservan hoy y los (retencionDias - 1) días anteriores.
 * Los resúmenes (resumen-*.md) y cualquier otro archivo se respetan.
 * Uso:  node bitacora-rotate.js         → borra los vencidos
 *       node bitacora-rotate.js --dry   → solo lista lo que borraría
 */
'use strict';
const fs = require('fs');
const path = require('path');

const dry = process.argv.includes('--dry');

try {
  const C = require('./lib/comun.js');
  const reten = Number((C.config().bitacora || {}).retencionDias) || 30;
  const stateDir = C.stateDir();
  if (!stateDir) { console.log('sin stateDir configurado; corre /os-setup'); process.exit(0); }
  const dir = path.join(stateDir, 'bitacora');
  if (!fs.existsSync(dir)) { console.log('bitacora/ no existe; nada que rotar'); process.exit(0); }

  const hoy = C.hoyISO();
  let borrados = 0;
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^(\d{4}-\d{2}-\d{2})\.md$/); // solo diarios
    if (!m) continue;
    const edad = C.diasEntre(m[1], hoy);
    if (edad !== null && edad >= reten) {
      if (dry) console.log('[dry] borraría', f, `(${edad} d)`);
      else { fs.unlinkSync(path.join(dir, f)); console.log('borrado', f, `(${edad} d)`); borrados++; }
    }
  }
  console.log(dry ? `dry-run completo (retención ${reten} d)` : `rotación completa: ${borrados} archivo(s) borrado(s)`);
} catch (e) {
  console.log('rotate skip:', e.message);
}
process.exit(0);
