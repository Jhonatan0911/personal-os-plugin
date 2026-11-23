#!/usr/bin/env node
/**
 * os-servidor.js — el servidor local de la consola unificada del Personal OS (D-065).
 *
 * Sirve la app (consola + mandos + configuración) y una LISTA CERRADA de acciones. Corre todo el día
 * en segundo plano, así que es Node puro, sin dependencias, y no hace nada mientras nadie le pide algo.
 *
 * SEGURIDAD. Un servidor local que escribe archivos y lanza procesos es alcanzable desde CUALQUIER página
 * abierta en el navegador (CSRF y DNS rebinding). Por eso, sin excepción:
 *   1. Escucha solo en 127.0.0.1 y rechaza todo `Host` que no sea 127.0.0.1:<puerto> o localhost:<puerto>.
 *   2. Lo que escribe o ejecuta exige POST con `Content-Type: application/json`, el `Origin` de la propia app
 *      y la cabecera `X-OS-Token` con un token aleatorio por arranque. El token solo viaja dentro de la página
 *      servida (la política de mismo origen impide que otra página la lea) y nunca se escribe en disco.
 *   3. Ningún endpoint recibe un comando, una ruta ni un argumento libre: la acción se elige de una lista
 *      (las propias de abajo + `config.json → servidor.acciones`, que solo edita el dueño del equipo).
 *   4. Los archivos estáticos salen solo de la carpeta de estado y de las plantillas del plugin, sin `..`.
 *
 * Uso:
 *   node os-servidor.js [--puerto 7318] [--abrir]
 *   node os-servidor.js --instalar-tarea   → arranque oculto al iniciar sesión de Windows (schtasks)
 *   node os-servidor.js --quitar-tarea
 *   node os-servidor.js --salud            → ¿está vivo? (exit 0 sí, 1 no). Lo usa el testigo.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile, spawn } = require('child_process');
const C = require('./lib/comun.js');

const cfg = C.config();
const CFG_SRV = cfg.servidor || {};
const PUERTO = Number(C.arg('--puerto', null) || CFG_SRV.puerto || 7318);
const STATE = C.stateDir();
const PLANTILLAS = path.join(C.PLUGIN_ROOT, 'plantillas');
// pid y puerto, sin el token. Una marca por puerto: una instancia de prueba en otro puerto no pisa la real.
const MARCA = path.join(C.OS_HOME, `_servidor-${PUERTO}.json`);
const TOKEN = crypto.randomBytes(24).toString('hex');
// Versión: la del plugin; en una instalación suelta, la que el sync deja en <os-home>/plugin-version.json.
const VERSION = (() => {
  for (const r of [path.join(C.PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), path.join(C.OS_HOME, 'plugin-version.json')]) {
    const j = C.leerJson(r, null); if (j && j.version) return j.version;
  }
  return '?';
})();
const HOSTS = new Set([`127.0.0.1:${PUERTO}`, `localhost:${PUERTO}`]);
const ORIGENES = new Set([`http://127.0.0.1:${PUERTO}`, `http://localhost:${PUERTO}`]);
const NODE = process.execPath;
const TAREA = 'PersonalOS-Servidor';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8', '.glb': 'model/gltf-binary',
};

// ------------------------------------------------------------------ modos que no levantan servidor

function salud(cb) {
  const req = http.get({ host: '127.0.0.1', port: PUERTO, path: '/salud', timeout: 1500 }, (res) => {
    let d = ''; res.on('data', (x) => { d += x; }); res.on('end', () => cb(res.statusCode === 200, d));
  });
  req.on('timeout', () => { req.destroy(); cb(false, 'sin respuesta'); });
  req.on('error', (e) => cb(false, e.code || e.message));
}

if (process.argv.includes('--salud')) {
  salud((ok, d) => { console.log(ok ? `vivo en ${PUERTO}: ${d}` : `no responde en ${PUERTO} (${d})`); process.exit(ok ? 0 : 1); });
  return;
}

// Acceso directo en el Escritorio que abre la app como ventana propia (Edge en modo app, sin barra).
if (process.argv.includes('--crear-acceso')) {
  if (process.platform !== 'win32') { console.error('El acceso directo solo se crea en Windows.'); process.exit(1); }
  const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((r) => fs.existsSync(r));
  if (!edge) { console.error('No encontré Microsoft Edge; abre http://127.0.0.1:' + PUERTO + '/ en tu navegador.'); process.exit(1); }
  const icono = C.arg('--icono', null);
  const q = (s) => String(s).replace(/'/g, "''");
  // Nunca pisa un acceso ajeno con el mismo nombre (p. ej. el de una app anterior): usa otro nombre.
  const ps = `$d=[Environment]::GetFolderPath('Desktop');$w=New-Object -ComObject WScript.Shell;$l=Join-Path $d 'Personal OS.lnk';`
    + `if((Test-Path $l) -and ($w.CreateShortcut($l).TargetPath -notlike '*msedge.exe')){$l=Join-Path $d 'Personal OS (consola).lnk'};`
    + `$s=$w.CreateShortcut($l);$s.TargetPath='${q(edge)}';`
    + `$s.Arguments='--app=http://127.0.0.1:${PUERTO}/ --window-size=1280,860';$s.Description='Personal OS: consola, mandos y configuración';`
    + (icono ? `$s.IconLocation='${q(icono)}';` : '') + `$s.Save();Write-Output $l`;
  execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true }, (e, out, err) => {
    if (e) { console.error(`✖ ${(err || e.message).trim()}`); process.exit(1); }
    console.log(`Acceso directo: ${String(out).trim()}`);
  });
  return;
}

if (process.argv.includes('--instalar-tarea') || process.argv.includes('--quitar-tarea')) {
  if (process.platform !== 'win32') { console.error('La tarea de arranque solo existe en Windows.'); process.exit(1); }
  const quitar = process.argv.includes('--quitar-tarea');
  // Acceso directo en la carpeta Inicio del usuario: no pide administrador (schtasks ONLOGON sí lo pide)
  // y el usuario lo ve y lo apaga en Configuración → Aplicaciones → Inicio.
  // conhost --headless arranca node sin ventana (Windows 11).
  const inicio = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
  const lnk = path.join(inicio, `${TAREA}.lnk`);
  if (quitar) {
    try { fs.unlinkSync(lnk); console.log(`Arranque quitado: ${lnk}`); } catch (_) { console.log('No había arranque instalado.'); }
    return;
  }
  const q = (s) => String(s).replace(/'/g, "''");
  const ps = `$s=(New-Object -ComObject WScript.Shell).CreateShortcut('${q(lnk)}');`
    + `$s.TargetPath='${q(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'conhost.exe'))}';`
    + `$s.Arguments='--headless "${q(NODE)}" "${q(__filename)}" --puerto ${PUERTO}';`
    + `$s.WorkingDirectory='${q(path.dirname(__filename))}';$s.WindowStyle=7;$s.Description='Personal OS: servidor de la consola (solo 127.0.0.1)';$s.Save()`;
  execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true }, (e, out, err) => {
    if (e || !fs.existsSync(lnk)) { console.error(`✖ no se pudo crear el arranque: ${(err || (e && e.message) || 'el acceso directo no quedó').trim()}`); process.exit(1); }
    console.log(`Arranque instalado: ${lnk} (oculto al iniciar sesión, puerto ${PUERTO}).`);
  });
  return;
}

// ------------------------------------------------------------------ lectura del estado

function mtime(ruta) { try { return fs.statSync(ruta).mtime.toISOString(); } catch (_) { return null; } }

function estado() {
  const ex = require('./exigencia.js').leer();
  const ex_mod = require('./exigencia.js');
  return {
    version: VERSION,
    os: { flag: C.flag ? C.flag() : null, activo: C.activo ? C.activo() : null },
    exigencia: {
      nivel: ex.nivel, etiqueta: ex.etiqueta, tono: ex.tono, aviso: ex.aviso,
      niveles: Object.entries(ex_mod.NIVELES).map(([k, v]) => ({ clave: k, etiqueta: v.etiqueta, tono: v.tono })),
    },
    tablero: { md: mtime(path.join(STATE || '', 'tablero.md')), html: mtime(path.join(STATE || '', 'tablero.html')) },
    consola: mtime(path.join(STATE || '', 'consola.html')),
    // mostrar_si / ocultar_si: {indicador, valor}. Así una acción se alterna con su contraria
    // (abrir o cerrar un widget) según lo que diga un indicador, sin que la app conozca el widget.
    acciones: Object.entries(accionesConfig()).map(([id, a]) => ({ id, etiqueta: a.etiqueta || id, ayuda: a.ayuda || '',
      confirmar: a.confirmar || null, mostrar_si: a.mostrar_si || null, ocultar_si: a.ocultar_si || null })),
    hoy: C.hoyISO(),
  };
}

// ------------------------------------------------------------------ indicadores (módulos del usuario)

/**
 * `config.json → servidor.indicadores`: [{id, etiqueta, cmd: [...]}]. Cada comando imprime UNA línea JSON
 * {valor, detalle, tono: ok|aviso|error|neutro}. Así entran datos propios del usuario (horas de la jornada,
 * un widget) sin que el plugin conozca sus rutas. Caché corta: la página los pide cada 30 s solo si está visible.
 */
let cacheInd = { t: 0, datos: null };
async function indicadores() {
  if (cacheInd.datos && Date.now() - cacheInd.t < 20000) return cacheInd.datos;
  const lista = ((C.config().servidor || {}).indicadores || []).filter((i) => i && /^[a-z0-9-]{2,40}$/.test(i.id) && Array.isArray(i.cmd));
  const datos = await Promise.all(lista.map((i) => new Promise((resolve) => {
    const [exe, ...args] = i.cmd.map(sustituir);
    // 30 s: un indicador que lee un libro de Excel tarda en frío más de 10 s.
    execFile(exe, args, { windowsHide: true, timeout: 30000, cwd: STATE || C.OS_HOME }, (e, out, err) => {
      let r;
      try { r = JSON.parse(String(out || '').trim().split(/\r?\n/).pop()); } catch (_) { r = null; }
      // Nunca un número inventado: si el comando falla o no da JSON, se dice POR QUÉ (no la línea de comandos).
      const causa = e && e.killed ? 'tardó más de 30 s' : (String(err || '').trim().split(/\r?\n/).pop() || (e ? `salió con código ${e.code}` : 'no devolvió JSON'));
      resolve(Object.assign({ id: i.id, etiqueta: i.etiqueta || i.id },
        r && typeof r === 'object' ? r : { valor: 'sin dato', detalle: causa.slice(0, 160), tono: 'error' }));
    });
  })));
  cacheInd = { t: Date.now(), datos };
  return datos;
}

// ------------------------------------------------------------------ acciones (lista cerrada)

/** Las del usuario: `config.json → servidor.acciones`. {id: {etiqueta, ayuda, confirmar, cmd: [...], esperar}} */
function accionesConfig() {
  const a = (C.config().servidor || {}).acciones || {};
  const ok = {};
  for (const [id, def] of Object.entries(a)) {
    if (!/^[a-z0-9-]{2,40}$/.test(id) || !def || !Array.isArray(def.cmd) || !def.cmd.length) continue;
    ok[id] = def;
  }
  return ok;
}

const sustituir = (s) => String(s)
  .replace(/\$\{STATE\}/g, STATE || '').replace(/\$\{OS_HOME\}/g, C.OS_HOME)
  .replace(/\$\{SCRIPTS\}/g, C.SCRIPTS_DIR).replace(/\$\{NODE\}/g, NODE);

function correr(cmd, esperar) {
  return new Promise((resolve) => {
    const [exe, ...args] = cmd.map(sustituir);
    if (!esperar) {
      const p = spawn(exe, args, { cwd: STATE || C.OS_HOME, detached: true, stdio: 'ignore', windowsHide: true });
      p.on('error', (e) => resolve({ ok: false, mensaje: e.message }));
      p.unref();
      return setTimeout(() => resolve({ ok: true, mensaje: 'lanzado' }), 300);
    }
    execFile(exe, args, { cwd: STATE || C.OS_HOME, windowsHide: true, timeout: 15 * 60 * 1000, maxBuffer: 4 * 1024 * 1024 },
      (e, out, err) => {
        const lineas = `${out || ''}${err || ''}`.trim().split(/\r?\n/).filter(Boolean);
        // El resultado se dice, no se supone: última línea de la salida y el código real.
        resolve({ ok: !e, mensaje: (lineas.pop() || (e ? e.message : 'hecho')).slice(0, 300) });
      });
  });
}

function abrirEnSistema(ruta) {
  if (!fs.existsSync(ruta)) return { ok: false, mensaje: `no existe: ${path.basename(ruta)}` };
  const [exe, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', ruta]]
    : process.platform === 'darwin' ? ['open', [ruta]] : ['xdg-open', [ruta]];
  execFile(exe, args, { windowsHide: true }, () => {});
  return { ok: true, mensaje: `abierto: ${path.basename(ruta)}` };
}

const PROPIAS = {
  'os-flag': (b) => {
    if (typeof b.activo !== 'boolean') return { ok: false, mensaje: 'falta activo: true|false' };
    fs.writeFileSync(path.join(C.OS_HOME, 'state.flag'), b.activo ? 'active' : 'paused', 'utf8');
    return { ok: true, mensaje: `Personal OS ${b.activo ? 'activado' : 'pausado'} · aplica desde la próxima sesión` };
  },
  exigencia: (b) => {
    const n = require('./exigencia.js').fijar(b.nivel);
    return { ok: true, mensaje: `exigencia: ${n} · aplica en la próxima sesión de Claude` };
  },
  abrir: (b) => {
    const destinos = {
      estado: STATE,
      'bitacora-hoy': path.join(STATE || '', 'bitacora', `${C.hoyISO()}.md`),
      tablero: path.join(STATE || '', 'tablero.html'),
    };
    if (!destinos[b.destino]) return { ok: false, mensaje: `destino desconocido: ${b.destino}` };
    return abrirEnSistema(destinos[b.destino]);
  },
  // En una instalación suelta build-consola necesita --config-dir: va en servidor.consola_args.
  'consola-build': () => correr([NODE, path.join(C.SCRIPTS_DIR, 'build-consola.js'),
    ...((C.config().servidor || {}).consola_args || [])], true),
};

async function ejecutar(id, cuerpo) {
  if (PROPIAS[id]) return PROPIAS[id](cuerpo || {});
  const def = accionesConfig()[id];
  if (!def) return null;                                   // 404: no está en la lista
  return correr(def.cmd, def.esperar !== false);
}

// ------------------------------------------------------------------ servidor

function paginaApp() {
  const ruta = path.join(PLANTILLAS, 'app.html');
  const html = fs.existsSync(ruta) ? fs.readFileSync(ruta, 'utf8')
    : '<!doctype html><meta charset="utf-8"><title>Personal OS</title><p>Consola unificada: servidor activo. La app llega en la fase F2.</p><script>window.OS_TOKEN="__OS_TOKEN__"</script>';
  return html.replace(/__OS_TOKEN__/g, TOKEN).replace(/__OS_VERSION__/g, VERSION);
}

function estatico(base, rel) {
  const destino = path.resolve(base, '.' + rel);
  if (!destino.startsWith(path.resolve(base) + path.sep)) return { codigo: 403 };
  const ext = path.extname(destino).toLowerCase();
  if (!MIME[ext]) return { codigo: 403 };
  if (!fs.existsSync(destino) || !fs.statSync(destino).isFile()) return { codigo: 404 };
  return { codigo: 200, tipo: MIME[ext], cuerpo: fs.readFileSync(destino) };
}

const servidor = http.createServer((req, res) => {
  const enviar = (codigo, tipo, cuerpo, extra) => {
    res.writeHead(codigo, Object.assign({
      'Content-Type': tipo, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      // SAMEORIGIN: la app muestra la consola en un iframe propio; ninguna página ajena puede enmarcarla.
      'X-Frame-Options': 'SAMEORIGIN', 'Content-Security-Policy': "frame-ancestors 'self'", 'Referrer-Policy': 'no-referrer',
    }, extra || {}));
    res.end(cuerpo);
  };
  const json = (codigo, obj) => enviar(codigo, MIME['.json'], JSON.stringify(obj));

  // 1. Host: corta el DNS rebinding antes de mirar nada más.
  if (!HOSTS.has(String(req.headers.host || '').toLowerCase())) return enviar(403, 'text/plain', 'host no permitido');

  let url;
  try { url = new URL(req.url, `http://127.0.0.1:${PUERTO}`); } catch (_) { return enviar(400, 'text/plain', 'url inválida'); }
  const ruta = decodeURIComponent(url.pathname);

  if (req.method === 'GET') {
    if (ruta === '/salud') return json(200, { ok: true, version: VERSION, pid: process.pid, desde: INICIO });
    if (ruta === '/' || ruta === '/app') return enviar(200, MIME['.html'], paginaApp());
    if (ruta === '/api/estado') {
      try { return json(200, estado()); } catch (e) { return json(500, { error: String(e && e.message) }); }
    }
    if (ruta === '/api/indicadores') {
      indicadores().then((d) => json(200, d), (e) => json(500, { error: String(e && e.message) }));
      return;
    }
    if (ruta.startsWith('/estado/') && STATE) {
      const r = estatico(STATE, ruta.slice('/estado'.length));
      return r.codigo === 200 ? enviar(200, r.tipo, r.cuerpo) : enviar(r.codigo, 'text/plain', String(r.codigo));
    }
    if (ruta.startsWith('/plantillas/')) {
      const r = estatico(PLANTILLAS, ruta.slice('/plantillas'.length));
      return r.codigo === 200 ? enviar(200, r.tipo, r.cuerpo) : enviar(r.codigo, 'text/plain', String(r.codigo));
    }
    return enviar(404, 'text/plain', 'no existe');
  }

  if (req.method !== 'POST') return enviar(405, 'text/plain', 'método no permitido');

  // 2. Lo que escribe o ejecuta: Origin propio + JSON + token.
  if (!ORIGENES.has(String(req.headers.origin || ''))) return enviar(403, 'text/plain', 'origen no permitido');
  if (!/^application\/json\b/i.test(String(req.headers['content-type'] || ''))) return enviar(415, 'text/plain', 'se espera JSON');
  const tok = String(req.headers['x-os-token'] || '');
  if (tok.length !== TOKEN.length || !crypto.timingSafeEqual(Buffer.from(tok), Buffer.from(TOKEN))) {
    return enviar(403, 'text/plain', 'token inválido');
  }

  let crudo = '';
  req.on('data', (d) => { crudo += d; if (crudo.length > 20000) req.destroy(); });
  req.on('end', async () => {
    let cuerpo = {};
    try { cuerpo = crudo ? JSON.parse(crudo) : {}; } catch (_) { return json(400, { ok: false, mensaje: 'JSON inválido' }); }

    if (ruta === '/api/log') {
      try { fs.mkdirSync(path.join(STATE, '_runtime'), { recursive: true }); fs.appendFileSync(path.join(STATE, '_runtime', 'app-errores.log'), `${new Date().toISOString()} ${crudo.slice(0, 2000)}\n`); } catch (_) { /* nunca tumbar el servidor por un log */ }
      return enviar(204, 'text/plain', '');
    }
    const m = ruta.match(/^\/api\/accion\/([a-z0-9-]{2,40})$/);
    if (!m) return json(404, { ok: false, mensaje: 'ruta desconocida' });
    try {
      const r = await ejecutar(m[1], cuerpo);
      if (!r) return json(404, { ok: false, mensaje: `acción no permitida: ${m[1]}` });
      return json(r.ok ? 200 : 500, r);
    } catch (e) {
      return json(500, { ok: false, mensaje: String(e && e.message).slice(0, 300) });
    }
  });
});

const INICIO = new Date().toISOString();

servidor.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `✖ El puerto ${PUERTO} está ocupado (¿ya hay otro os-servidor?). Prueba --salud.` : `✖ ${e.message}`);
  process.exit(1);
});

const limpiar = () => { try { const m = JSON.parse(fs.readFileSync(MARCA, 'utf8')); if (m.pid === process.pid) fs.unlinkSync(MARCA); } catch (_) { /* nada */ } };
process.on('exit', limpiar);
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => process.exit(0));

// 127.0.0.1 explícito: NO 0.0.0.0. Aquí hay riesgos, compromisos y datos de clientes.
servidor.listen(PUERTO, '127.0.0.1', () => {
  try { fs.writeFileSync(MARCA, JSON.stringify({ pid: process.pid, puerto: PUERTO, desde: INICIO, version: VERSION }, null, 2)); } catch (_) { /* el testigo lo dirá */ }
  const url = `http://127.0.0.1:${PUERTO}/`;
  console.log(`Personal OS ${VERSION} en ${url} · solo 127.0.0.1 · estado: ${STATE || '(sin configurar)'}`);
  if (process.argv.includes('--abrir') && process.platform === 'win32') execFile('cmd', ['/c', 'start', '', url], { windowsHide: true }, () => {});
});
