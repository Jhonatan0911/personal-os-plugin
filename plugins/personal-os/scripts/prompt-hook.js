#!/usr/bin/env node
/*
 * Personal OS — UN SOLO hook UserPromptSubmit (4.2.1).
 *
 * Antes había cuatro hooks por prompt (bitácora, hitos, reuniones, correo), cada uno con su propio
 * node. Solos tardan menos de 1 s, pero Claude Code los arranca EN PARALELO junto con los hooks de
 * otros plugins y, con el antivirus escaneando cada arranque, se pasaban de sus 3-5 s: el prompt
 * salía con «hook timed out», su aviso se perdía y, si el caído era la bitácora, quedaba un hueco
 * sin que nadie lo notara. Reportado por varias personas que prueban el plugin (25/11/2026).
 *
 * Ahora un solo node lee el evento una vez y corre todo en proceso, en este orden:
 *   1. bitácora (prompt-logger)   — lo que no puede faltar va primero; si falla, se AVISA (testigo)
 *   2. correo (correo-scan)       — una línea solo si el buzón quedó sin vigilar
 *   3. reunión (reunion-detector) — recordatorio de issue si el prompt menciona una reunión
 *   4. hitos (alcances-scan)      — lo más pesado, al final y solo si queda presupuesto
 * Cada paso va en su try/catch: uno roto no tumba a los demás ni al prompt. Siempre exit 0
 * (en UserPromptSubmit un código 2 BLOQUEA el prompt).
 *
 *   node prompt-hook.js            # lo llama el hook con el evento por stdin
 *   node prompt-hook.js --medir    # además escribe en stderr cuánto tardó cada paso
 */
'use strict';
const T0 = Date.now();
const MEDIR = process.argv.includes('--medir');
// Presupuesto: el hook se declara con timeout de 15 s; los pasos opcionales no arrancan pasado este tiempo
const PRESUPUESTO_MS = 6000;

const salida = [];
const tiempos = [];

function paso(nombre, opcional, fn) {
  const t = Date.now();
  if (opcional && t - T0 > PRESUPUESTO_MS) { tiempos.push(`${nombre}: omitido (sin presupuesto)`); return; }
  try {
    const r = fn();
    if (typeof r === 'string' && r.trim()) salida.push(r.replace(/\s+$/, ''));
    tiempos.push(`${nombre}: ${Date.now() - t} ms`);
  } catch (e) {
    tiempos.push(`${nombre}: ERROR ${e && e.message}`);
    if (nombre === 'bitácora') {
      // Testigo (CO-070): si la bitácora no registró el prompt, el modelo lo sabe y lo anexa a mano.
      salida.push(`⚠️ BITÁCORA: este prompt NO quedó registrado (${String(e && e.message || e).slice(0, 160)}). ` +
        'Anéxalo con bitacora-append.js bajo un encabezado ## HH:MM propio al cerrar el turno.');
    }
  }
}

try {
  const C = require('./lib/comun.js');
  const evento = C.eventoHook();   // se lee UNA vez; los módulos usan la misma copia en caché
  paso('bitácora', false, () => { require('./prompt-logger.js').registrar(evento); return ''; });
  paso('correo', true, () => require('./correo-scan.js').avisoPrompt());
  paso('reunión', true, () => require('./reunion-detector.js').aviso(evento));
  paso('hitos', true, () => require('./alcances-scan.js').hitosTexto());
} catch (e) {
  tiempos.push(`arranque: ERROR ${e && e.message}`);
}

if (salida.length) process.stdout.write(salida.join('\n') + '\n');
if (MEDIR) process.stderr.write(`prompt-hook · ${Date.now() - T0} ms en total\n  ${tiempos.join('\n  ')}\n`);
process.exit(0);
