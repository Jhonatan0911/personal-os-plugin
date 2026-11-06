#!/usr/bin/env node
/*
 * Personal OS — hook Stop: "no afirmes que algo no existe sin haberlo buscado en todo".
 *
 * Nació de un caso real: se afirmó que un acuerdo de equipo no decía nada de un tema tras buscar
 * en una sola carpeta. La regla estaba escrita en otra. El usuario tuvo que corregirlo.
 *
 * Si la respuesta final del turno afirma una AUSENCIA sobre lo documentado ("no está escrito",
 * "no aparece en", "no dice nada", "no lo encontré"...) y en ese turno no se ejecutó
 * os-buscar.js, el hook bloquea el cierre UNA vez y obliga a barrer todas las fuentes.
 * Nunca rompe la sesión: cualquier error => deja pasar.
 */
'use strict';
const fs = require('fs');

const AUSENCIA = new RegExp([
  'no (esta|estaba|quedo|quedaba) (escrit|registrad|documentad|anotad|en el estado|en la memoria)',
  'no (aparece|figura|existe|consta|hay nada|hay ninguna?) (en|sobre|registrad|escrit|documentad)',
  'no dice nada (de|sobre)',
  'no (lo|la|los|las) (encontre|encuentro|tengo registrad|tengo en)',
  'no (tengo|hay) (registro|constancia|evidencia) (de|en)',
  'nada (escrito|documentado|registrado) (sobre|de)',
].join('|'), 'i');

const plano = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function leerStdin() {
  try { return JSON.parse(fs.readFileSync(0, 'utf8').replace(/^﻿/, '') || '{}'); } catch (e) { return {}; }
}

try {
  const C = require('./lib/comun.js');
  if (!C.activo()) process.exit(0);
  const input = leerStdin();
  if (input.stop_hook_active) process.exit(0); // ya se bloqueó una vez en este cierre
  const tp = input.transcript_path;

  let texto = '';
  let busco = false;
  if (tp && fs.existsSync(tp)) {
    const filas = fs.readFileSync(tp, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean).map((l) => {
      try { return JSON.parse(l); } catch (e) { return null; }
    }).filter(Boolean);

    // Último prompt real del usuario (no un tool_result).
    let inicio = -1;
    for (let i = filas.length - 1; i >= 0; i--) {
      const f = filas[i];
      if (f.type !== 'user' || !f.message || f.isSidechain) continue;
      const c = f.message.content;
      const esPrompt = typeof c === 'string' || (Array.isArray(c) && c.some((b) => b.type === 'text'));
      if (esPrompt) { inicio = i; break; }
    }
    for (const f of filas.slice(inicio + 1)) {
      if (f.type !== 'assistant' || !f.message || !Array.isArray(f.message.content)) continue;
      for (const b of f.message.content) {
        if (b.type === 'text') texto += '\n' + b.text;
        if (b.type === 'tool_use' && /os-buscar/i.test(JSON.stringify(b.input || {}))) busco = true;
      }
    }
  }
  if (typeof input.last_assistant_message === 'string') texto += '\n' + input.last_assistant_message;

  if (!busco && AUSENCIA.test(plano(texto))) {
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason: 'Personal OS: tu respuesta afirma que algo NO está escrito/registrado o que no lo '
        + 'encontraste, y en este turno no barriste todas las fuentes. Ejecuta antes '
        + `\`${C.comandoScript('os-buscar.js')} "<término>" "<sinónimo>"\` (estado, CORE, skills, `
        + 'memoria, instrucciones globales y las carpetas de config.json → busqueda) y corrige la '
        + 'respuesta. Si sigue sin aparecer, di en qué fuentes buscaste ("no lo encontré en …"), nunca "no existe".',
    }));
  }
} catch (e) { /* nunca romper el cierre del turno */ }
process.exit(0);
