#!/usr/bin/env node
// correo-scan.js — vigía del correo del usuario (Personal OS).
//
// Nació de un incidente real: un correo «Urgente» del cliente con fecha límite llegó a media mañana,
// el brief de ese día ya había corrido, el conector de correo quedó abierto con la cuenta de otra
// persona y nadie lo vio hasta dos días después, cuando el usuario revisó su bandeja a mano.
// Un buzón que nadie barre no avisa que nadie lo barre: este script lo hace visible.
//
// Estado: <stateDir>/correo/barrido.json  { ultimo_iso, identidad, urgentes: [ {asunto, de, recibido, fecha_limite, estado} ], nota }
//
//   node correo-scan.js                       # SessionStart: bloque completo (vacío si todo está al día)
//   node correo-scan.js --prompt              # UserPromptSubmit: una línea solo si hay problema
//   node correo-scan.js --json                # estado en JSON
//   node correo-scan.js --marcar --identidad <correo> [--urgentes <archivo.json>] [--nota "<texto>"]
//                                             # registra un barrido hecho AHORA (lo llama la sesión, no el agente)
//
// Configuración (config.json → "correo"):
//   "correo": { "buzon": "usuario@empresa.com", "horasMaxSinBarrer": 3, "jornada": ["07:00", "19:00"] }
// Sin "buzon" no se valida la identidad (solo la frescura del barrido).

const fs = require('fs');
const path = require('path');
const C = require('./lib/comun.js');

const PROMPT = process.argv.includes('--prompt');
const JSON_OUT = process.argv.includes('--json');
const MARCAR = process.argv.includes('--marcar');

const base = C.stateDir();
if (!base || !fs.existsSync(base)) process.exit(0);
if (!MARCAR && !JSON_OUT && !C.arg('--estado', null) && !C.activo()) process.exit(0);

const cfg = Object.assign({ horasMaxSinBarrer: 3, jornada: ['07:00', '19:00'] }, C.config().correo || {});
const buzon = String(cfg.buzon || '').trim().toLowerCase();
const DIR = path.join(base, 'correo');
const ARCH = path.join(DIR, 'barrido.json');

const minutos = (hm) => { const [h, m] = String(hm).split(':').map(Number); return h * 60 + (m || 0); };

if (MARCAR) {
  const identidad = String(C.arg('--identidad', '') || '').trim().toLowerCase();
  if (!identidad) { console.error('Falta --identidad <correo del buzón leído>'); process.exit(1); }
  let urgentes = [];
  const fu = C.arg('--urgentes', null);
  if (fu) urgentes = C.leerJson(path.resolve(fu), []) || [];
  const previo = C.leerJson(ARCH, {}) || {};
  const reg = {
    ultimo_iso: new Date().toISOString(),
    identidad,
    identidad_ok: buzon ? identidad === buzon : null,
    urgentes: Array.isArray(urgentes) && urgentes.length ? urgentes : (previo.urgentes || []),
    nota: C.arg('--nota', '') || '',
  };
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(ARCH, JSON.stringify(reg, null, 2), 'utf8');
  console.log(`barrido registrado: ${reg.ultimo_iso} · ${identidad}${reg.identidad_ok === false ? ' · ⚠️ NO es el buzón del dueño' : ''} · urgentes abiertos: ${reg.urgentes.filter((u) => u.estado !== 'atendido').length}`);
  process.exit(0);
}

const est = C.leerJson(ARCH, null);
const ahora = C.ahora();
const habil = C.esHabil(ahora.ymd);
const enJornada = habil && minutos(ahora.hm) >= minutos(cfg.jornada[0]) && minutos(ahora.hm) <= minutos(cfg.jornada[1]);

const problemas = [];
let horasSin = null;
if (!est || !est.ultimo_iso) {
  problemas.push({ nivel: 'critico', texto: 'No hay ningún barrido de correo registrado: el buzón no se está vigilando.' });
} else {
  horasSin = (Date.now() - Date.parse(est.ultimo_iso)) / 3600000;
  if (buzon && est.identidad && est.identidad !== buzon) {
    problemas.push({ nivel: 'critico', texto: `El último barrido leyó el buzón de ${est.identidad}, no el de ${buzon}: el correo del dueño está SIN VIGILAR. Reconectar el conector de correo con su cuenta.` });
  }
  if (enJornada && horasSin > cfg.horasMaxSinBarrer) {
    problemas.push({ nivel: horasSin > 24 ? 'critico' : 'alerta', texto: `Correo sin barrer hace ${horasSin < 48 ? Math.round(horasSin) + ' h' : Math.round(horasSin / 24) + ' días'} (máximo ${cfg.horasMaxSinBarrer} h en jornada).` });
  }
}
const abiertos = ((est && est.urgentes) || []).filter((u) => u && u.estado !== 'atendido');

if (JSON_OUT) {
  console.log(JSON.stringify({ archivo: ARCH, buzon: buzon || null, horasSin, enJornada, problemas, urgentesAbiertos: abiertos, estado: est }, null, 2));
  process.exit(0);
}

if (!problemas.length && !abiertos.length) process.exit(0);

const nombre = C.nombreCorto();
if (PROMPT) {
  if (!problemas.length) process.exit(0);   // los urgentes abiertos ya salen al arrancar; aquí solo lo que está roto
  console.log(`📭 CORREO SIN VIGILAR: ${problemas.map((p) => p.texto).join(' ')} Antes de seguir con lo demás, haz el barrido de urgentes (brief-diario, paso «Barrido de urgentes») o díselo a ${nombre} en la primera línea.`);
  process.exit(0);   // en UserPromptSubmit un código 2 BLOQUEA el prompt: nunca
}

const L = ['## 📭 VIGÍA DE CORREO'];
for (const p of problemas) L.push(`- ${p.nivel === 'critico' ? '🔴 CRÍTICO' : '🟠 ALERTA'} · ${p.texto}`);
if (problemas.length) {
  L.push(`→ Lo PRIMERO de la sesión, antes de retomar cualquier frente: barrido de urgentes del buzón desde ${est && est.ultimo_iso ? est.ultimo_iso.slice(0, 16).replace('T', ' ') + ' UTC' : 'hace 3 días hábiles'} (procedimiento en brief-diario, «Barrido de urgentes») y registrarlo con \`${C.comandoScript('correo-scan.js')} --marcar --identidad <buzón leído>\`.`);
  L.push(`→ Si el buzón no es el de ${nombre}, decírselo en la PRIMERA línea de la respuesta y pedirle que reconecte o que revise su bandeja; nunca seguir callado.`);
}
if (abiertos.length) {
  L.push(`- Urgentes abiertos (${abiertos.length}):`);
  for (const u of abiertos.slice(0, 8)) L.push(`  · ${u.asunto || '(sin asunto)'} · de ${u.de || '?'} · recibido ${u.recibido || '?'}${u.fecha_limite ? ' · LÍMITE ' + u.fecha_limite : ''} · ${u.estado || 'sin atender'}`);
}
console.log(L.join('\n'));
process.exit(0);
