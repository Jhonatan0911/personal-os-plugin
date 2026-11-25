#!/usr/bin/env node
// Prueba de INSTALACIÓN LIMPIA: el plugin como lo recibe alguien nuevo, en carpetas temporales.
// Nació el 25/11/2026: todo funcionaba en el equipo del autor (config completado a mano durante meses) y en
// el de los clientes fallaba la consola, la corteza y la app. Se corre ANTES DE CADA VERSIÓN:
//   node scripts/pruebas/instalacion-limpia.prueba.js
// No toca la instalación real: usa PERSONAL_OS_HOME y una carpeta de estado temporales y un puerto propio.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');

const SCRIPTS = path.resolve(__dirname, '..');
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-limpia-'));
const HOME = path.join(T, 'os-home');
const ESTADO = path.join(T, 'estado');
const PUERTO = 7396;
const env = Object.assign({}, process.env, { PERSONAL_OS_HOME: HOME });
delete env.CLAUDE_PLUGIN_ROOT;

let fallos = 0;
const v = (nombre, ok, detalle) => { if (!ok) fallos++; console.log(`${ok ? 'OK   ' : 'FALLO'} ${nombre}${ok || !detalle ? '' : ' · ' + String(detalle).slice(0, 300)}`); };
const correr = (script, args, entrada) => spawnSync(process.execPath, [path.join(SCRIPTS, script), ...args],
  { env, encoding: 'utf8', input: entrada === undefined ? '' : entrada, timeout: 90000 });
const leerCfg = () => JSON.parse(fs.readFileSync(path.join(HOME, 'config.json'), 'utf8'));
const conEjemplos = (o) => JSON.stringify(o).match(/"\/ruta\/[^"]*"|Nombre de un cliente|nombre-de-un-servidor/g) || [];
const pedir = (ruta) => new Promise((res) => {
  const r = http.get({ host: '127.0.0.1', port: PUERTO, path: ruta, timeout: 5000 }, (x) => { let d = ''; x.on('data', (c) => { d += c; }); x.on('end', () => res({ codigo: x.statusCode, d, loc: x.headers.location })); });
  r.on('error', (e) => res({ codigo: 0, d: e.message })); r.on('timeout', () => { r.destroy(); res({ codigo: 0, d: 'timeout' }); });
});

(async () => {
  try {
    // 1. /os-setup en un equipo sin nada
    const s = correr('os-setup.js', ['--estado', ESTADO, '--owner', 'Persona de Prueba', '--zona', 'America/Bogota']);
    v('os-setup termina bien', s.status === 0, s.stdout + s.stderr);
    const cfg = leerCfg();
    v('config.json sin valores de ejemplo', conEjemplos(cfg).length === 0, conEjemplos(cfg).join(', '));
    v('corteza con carpeta que existe', !!(cfg.conocimiento && cfg.conocimiento.dir && fs.existsSync(cfg.conocimiento.dir)), cfg.conocimiento && cfg.conocimiento.dir);
    v('state.flag activo', fs.readFileSync(path.join(HOME, 'state.flag'), 'utf8').trim() === 'active');
    cfg.servidor = Object.assign({}, cfg.servidor, { puerto: PUERTO });
    fs.writeFileSync(path.join(HOME, 'config.json'), JSON.stringify(cfg, null, 2));

    // 2. Arranque de sesión y hook de cada prompt
    const ev = JSON.stringify({ prompt: 'hola, prueba de instalación', cwd: ESTADO });
    const si = correr('session-init.js', [], ev);
    v('session-init sale con 0 y carga el OS', si.status === 0 && /PERSONAL OS/i.test(si.stdout), si.stderr || si.stdout.slice(0, 200));
    const ph = correr('prompt-hook.js', ['--medir'], ev);
    v('prompt-hook sale con 0', ph.status === 0, ph.stderr);
    const bit = path.join(ESTADO, 'bitacora');
    const hoy = fs.existsSync(bit) ? fs.readdirSync(bit).filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f)) : [];
    v('el prompt quedó en la bitácora', hoy.some((f) => fs.readFileSync(path.join(bit, f), 'utf8').includes('prueba de instalación')));
    v('prompt-hook sin errores internos', !/ERROR/.test(ph.stderr), ph.stderr);

    // 3. La consola
    const b = correr('build-consola.js', []);
    v('build-consola termina bien', b.status === 0, b.stderr);
    v('la consola no dice «sin configurar»', !/sin configurar/i.test(b.stdout), (b.stdout.match(/.*sin configurar.*/i) || [''])[0]);
    const datos = fs.readFileSync(path.join(ESTADO, '_datos', 'datos.js'), 'utf8');
    v('la corteza llega a la consola (vacía, no ausente)', /"notas":\s*\[\]/.test(datos), 'no hay corteza en datos.js');

    // 4. El servidor y la app
    const a = correr('os-servidor.js', ['--asegurar', '--puerto', String(PUERTO)]);
    v('el servidor arranca', a.status === 0 && /Arrancado|Ya corría|Actualizado/.test(a.stdout), a.stdout + a.stderr);
    const raiz = await pedir('/');
    v('/ lleva a la consola', raiz.codigo === 302 && /consola\.html/.test(raiz.loc || ''), raiz.codigo);
    const app = await pedir(raiz.loc || '/estado/consola.html');
    v('la app trae Oficina y ⚙ Config (consola-app.js inyectado)', app.codigo === 200 && app.d.includes('consola-app.js'), app.codigo);
    for (const r of ['/api/estado', '/api/config/agentes', '/api/config/skills', '/api/config/bd', '/api/config/paso-produccion']) {
      const x = await pedir(r);
      v(`${r} responde`, x.codigo === 200, `${x.codigo} ${x.d.slice(0, 120)}`);
    }
    const sk = JSON.parse((await pedir('/api/config/skills')).d || '{}');
    const lista = (sk.skills || sk.grupos || []);
    v('Skills lista las skills del plugin', JSON.stringify(sk).includes('auditar-ux-ui'), JSON.stringify(sk).slice(0, 160));
    const salud = JSON.parse((await pedir('/salud')).d || '{}');
    if (salud.pid) { try { process.kill(salud.pid); } catch (_) { /* ya no estaba */ } }
    void lista;

    // 5. Reparación: un config.json que ya traía los ejemplos de la plantilla (instalaciones de antes)
    const viejo = leerCfg();
    viejo.conocimiento = { dir: '/ruta/a/tu/estado/../conocimiento', terminosProhibidos: ['Nombre de un cliente'] };
    viejo.ambitos = { carpetas: { laboral: ['/ruta/a/los/repos/de/la/empresa'] } };
    fs.writeFileSync(path.join(HOME, 'config.json'), JSON.stringify(viejo, null, 2));
    const r2 = correr('os-setup.js', ['--estado', ESTADO]);
    const rep = leerCfg();
    v('os-setup repara un config con ejemplos', r2.status === 0 && conEjemplos(rep).length === 0 && fs.existsSync(rep.conocimiento.dir), conEjemplos(rep).join(', '));
    v('la reparación no borra lo del usuario', rep.owner === 'Persona de Prueba' && rep.zonaHoraria === 'America/Bogota');
  } catch (e) {
    v('la prueba corre sin excepciones', false, e && e.stack);
  } finally {
    try { fs.rmSync(T, { recursive: true, force: true }); } catch (_) { /* Windows puede tardar en soltar */ }
  }
  console.log(fallos ? `\n${fallos} control(es) fallan: NO publicar.` : '\nInstalación limpia: todo funciona.');
  process.exit(fallos ? 1 : 0);
})();
