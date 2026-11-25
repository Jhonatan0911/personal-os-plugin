#!/usr/bin/env node
/*
 * Personal OS — hook UserPromptSubmit: bitácora de "memoria reciente".
 * Registra CADA prompt del usuario con su hora local (zona de config.json) en:
 *     <stateDir>/bitacora/AAAA-MM-DD.md
 * Es SOLO efecto lateral: sale con 0 y sin stdout → no inyecta contexto ni bloquea el prompt.
 * Respeta el toggle del OS: si state.flag != "active", no registra nada.
 * Regla de oro: pase lo que pase, nunca romper el envío del prompt (todo en try/catch, exit 0).
 *
 * Desde la 4.2.1 lo corre `prompt-hook.js` en proceso (un solo node por prompt) a través de
 * `registrar(evento)`; llamado directo sigue funcionando igual.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('./lib/comun.js');

/** Escribe el prompt en la bitácora del día. Devuelve true si escribió, false si no tocaba.
 *  Lanza si falla la escritura: quien lo llama decide si avisa (el despachador sí avisa). */
function registrar(data) {
  if (!C.activo()) return false;
  const stateDir = C.stateDir();
  if (!stateDir || !fs.existsSync(stateDir)) return false;
  const prompt = (data.prompt != null ? data.prompt : (data.user_prompt != null ? data.user_prompt : '')).toString();
  if (!prompt.trim()) return false;

  const { ymd, hm } = C.ahora();
  const dir = path.join(stateDir, 'bitacora');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${ymd}.md`);
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, `# Bitácora — ${ymd}\n\n> Memoria reciente. El prompt lo escribe el hook; `
      + 'el resumen "OS" y las líneas "TS" las agrega el asistente al cerrar el turno.\n\n', 'utf8');
  }
  const clip = prompt.length > 2000 ? prompt.slice(0, 2000) + ' …[recortado]' : prompt;
  const oneLine = clip.replace(/\r?\n+/g, ' ').trim();
  fs.appendFileSync(file, `## ${hm}\n- **Tú:** ${oneLine}\n`, 'utf8');
  return true;
}

module.exports = { registrar };

if (require.main === module) {
  try { registrar(C.eventoHook()); } catch (e) { /* nunca romper el prompt */ }
  process.exit(0);
}
