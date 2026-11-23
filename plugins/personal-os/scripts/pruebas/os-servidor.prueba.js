#!/usr/bin/env node
/**
 * Pruebas de control de os-servidor.js (CO-030): levanta una instancia en un puerto de prueba y la ataca
 * como lo haría una página ajena (Host, Origin, token, acciones fuera de la lista, traversal). Cada caso
 * dice qué código espera; ninguno escribe en el estado. Correr antes de cada versión del plugin:
 *   node scripts/pruebas/os-servidor.prueba.js [--puerto 7399]
 * Sale con código 1 si algún control falla.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const i = process.argv.indexOf('--puerto');
const P = i > -1 ? Number(process.argv[i + 1]) : 7399;
const SRV = path.join(__dirname, '..', 'os-servidor.js');
const OS_HOME = process.env.PERSONAL_OS_HOME || path.join(os.homedir(), '.claude', 'personal-os');

function pedir({ metodo = 'GET', ruta = '/', host = `127.0.0.1:${P}`, cab = {}, cuerpo = null }) {
  return new Promise((ok) => {
    const req = http.request({ host: '127.0.0.1', port: P, method: metodo, path: ruta, headers: Object.assign({ Host: host }, cab) }, (res) => {
      let d = ''; res.on('data', (x) => { d += x; }); res.on('end', () => ok({ codigo: res.statusCode, d }));
    });
    req.on('error', (e) => ok({ codigo: 0, d: e.message }));
    if (cuerpo !== null) req.write(cuerpo);
    req.end();
  });
}

(async () => {
  const srv = spawn(process.execPath, [SRV, '--puerto', String(P)], { stdio: ['ignore', 'pipe', 'pipe'] });
  srv.stderr.on('data', (d) => process.stderr.write('[srv] ' + d));
  await new Promise((r) => setTimeout(r, 900));
  const pag = await pedir({ ruta: '/estado/consola.html' });
  const token = (pag.d.match(/OS_TOKEN\s*=\s*"([0-9a-f]+)"/) || [])[1];
  const O = `http://127.0.0.1:${P}`;
  const J = { 'Content-Type': 'application/json' };
  const T = (extra) => Object.assign({ Origin: O, 'X-OS-Token': token }, J, extra || {});
  const casos = [
    ['salud con Host propio', 200, { ruta: '/salud' }],
    ['salud con Host ajeno (DNS rebinding)', 403, { ruta: '/salud', host: 'evil.example:' + P }],
    ['la raíz lleva a la consola', 302, { ruta: '/' }],
    ['la consola trae el token y el módulo', 'token', null],
    ['el módulo de la app', 200, { ruta: '/plantillas/consola-app.js' }],
    ['estado', 200, { ruta: '/api/estado' }],
    ['indicadores', 200, { ruta: '/api/indicadores' }],
    ['traversal con ..', [403, 404], { ruta: '/estado/../../.claude/personal-os/config.json' }],
    ['traversal codificado', [403, 404], { ruta: '/estado/%2e%2e/%2e%2e/x.json' }],
    ['extensión no permitida', 403, { ruta: '/estado/algo.yaml' }],
    ['traversal por /_vendor', [403, 404], { ruta: '/_vendor/%2e%2e/%2e%2e/.claude/personal-os/config.json' }],
    ['módulo de identidad compartido', 200, { ruta: '/plantillas/identidad-agente.js' }],
    ['POST sin Origin', 403, { metodo: 'POST', ruta: '/api/accion/abrir', cab: Object.assign({ 'X-OS-Token': token }, J), cuerpo: '{}' }],
    ['POST con Origin ajeno', 403, { metodo: 'POST', ruta: '/api/accion/abrir', cab: T({ Origin: 'https://evil.example' }), cuerpo: '{}' }],
    ['POST sin token', 403, { metodo: 'POST', ruta: '/api/accion/abrir', cab: Object.assign({ Origin: O }, J), cuerpo: '{}' }],
    ['POST con token falso', 403, { metodo: 'POST', ruta: '/api/accion/abrir', cab: T({ 'X-OS-Token': 'a'.repeat(48) }), cuerpo: '{}' }],
    ['POST como formulario (no JSON)', 415, { metodo: 'POST', ruta: '/api/accion/abrir', cab: T({ 'Content-Type': 'text/plain' }), cuerpo: '{}' }],
    ['acción fuera de la lista', 404, { metodo: 'POST', ruta: '/api/accion/rm-rf', cab: T(), cuerpo: '{}' }],
    ['acción válida con destino inexistente (sin efecto)', 500, { metodo: 'POST', ruta: '/api/accion/abrir', cab: T(), cuerpo: '{"destino":"nada"}' }],
    ['exigencia con nivel inexistente (sin efecto)', 500, { metodo: 'POST', ruta: '/api/accion/exigencia', cab: T(), cuerpo: '{"nivel":"relajado"}' }],
    ['GET a una acción', 404, { ruta: '/api/accion/abrir' }],
    ['PUT', 405, { metodo: 'PUT', ruta: '/api/accion/abrir' }],
  ];
  let fallos = 0;
  for (const [nombre, espera, req] of casos) {
    let ok, obtenido;
    if (espera === 'token') { ok = !!token && token.length === 48 && pag.d.includes('/plantillas/consola-app.js'); obtenido = ok ? 'sí' : 'no'; }
    else { const r = await pedir(req); obtenido = r.codigo; ok = Array.isArray(espera) ? espera.includes(r.codigo) : r.codigo === espera; }
    if (!ok) fallos++;
    console.log(`${ok ? 'OK   ' : 'FALLO'} ${nombre}: esperado ${espera}, obtenido ${obtenido}`);
  }
  srv.kill();
  try { fs.unlinkSync(path.join(OS_HOME, `_servidor-${P}.json`)); } catch (_) { /* ya no estaba */ }
  console.log(fallos ? `\n${fallos} FALLO(S)` : `\nLos ${casos.length} controles pasan.`);
  process.exit(fallos ? 1 : 0);
})();
