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

/** -1, 0 o 1 al comparar «4.2.1» con «4.10.0» número a número. */
function compararVersion(a, b) {
  const x = String(a).split('.').map((n) => parseInt(n, 10) || 0); const y = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0) ? -1 : 1; }
  return 0;
}
// Registro de errores del servidor (corre oculto: sin esto, si no arranca nadie sabe por qué).
const LOG_SRV = path.join(C.OS_HOME, 'servidor.log');
function anotarLog(linea) {
  try { fs.mkdirSync(C.OS_HOME, { recursive: true }); fs.appendFileSync(LOG_SRV, `${new Date().toISOString()} [${process.pid}] ${linea}\n`); } catch (_) { /* sin log */ }
}
const LNK_INICIO = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', `${TAREA}.lnk`);
// Abre la app en el navegador por defecto y devuelve si lo logró (4.3.2). Antes era un execFile asíncrono y el
// proceso salía a los 300 ms: en equipos donde la herramienta cierra el árbol del comando al terminar, el
// `cmd start` moría antes de abrir la ventana y la salida no decía nada (26/11/2026). Ahora es síncrono y, en
// Windows, el navegador nace por WMI, fuera del árbol, igual que el servidor; si WMI falla, `cmd start` síncrono.
function abrirNavegador(url) {
  const cp = require('child_process');
  if (process.platform === 'win32') {
    const q = (s) => String(s).replace(/'/g, "''");
    const linea = `rundll32.exe url.dll,FileProtocolHandler ${url}`;
    const ps = `$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = '${q(linea)}' }; $r.ReturnValue`;
    try {
      const out = cp.execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
      if (String(out).trim() === '0') return { ok: true, via: 'WMI' };
      anotarLog(`WMI no abrió el navegador (ReturnValue ${String(out).trim()}); se usa cmd start`);
    } catch (e) { anotarLog(`WMI no abrió el navegador (${e.message.split('\n')[0]}); se usa cmd start`); }
    try { cp.execFileSync('cmd', ['/c', 'start', '', url], { windowsHide: true, timeout: 15000 }); return { ok: true, via: 'cmd start' }; }
    catch (e) { return { ok: false, motivo: e.message.split('\n')[0] }; }
  }
  try { cp.execFileSync(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { timeout: 15000 }); return { ok: true, via: 'open' }; }
  catch (e) { return { ok: false, motivo: e.message.split('\n')[0] }; }
}

// --asegurar (4.2.2): lo que usa /consola. Deja el servidor corriendo con ESTA versión y, con --abrir, abre la app.
// Antes /consola solo miraba si respondía y, si no, abría el HTML suelto: quien instalaba el plugin nunca veía
// la Oficina ni ⚙ Config, porque nadie arrancaba el servidor (en el equipo del autor lo arrancaba Inicio).
//   · no corre → lo lanza en segundo plano (desacoplado, sin ventana) y espera a que responda;
//   · corre una versión MÁS VIEJA (se actualizó el plugin) → lo detiene y lanza esta;
//   · corre la misma versión pero con OTRO código (un sync o una edición sin subir la versión) → lo reinicia;
//     la huella son los archivos que carga el servidor (él mismo, lib/ y las plantillas de la consola);
//   · corre esta o una más nueva con el mismo código → no lo toca. --reiniciar lo reinicia siempre.
// Sale con 0 si al final responde; con 1 si no (y /consola abre el HTML suelto diciendo por qué).
/** Huella del código que sirve este proceso: si cambia en disco, el que corre quedó viejo. */
function huellaCodigo() {
  const h = require('crypto').createHash('sha256');
  const dir = path.dirname(__filename);
  const archivos = [__filename];
  for (const sub of ['lib', path.join('..', 'plantillas'), 'plantillas']) {
    try { for (const f of fs.readdirSync(path.join(dir, sub)).sort()) if (/\.(js|py|html|css)$/.test(f)) archivos.push(path.join(dir, sub, f)); } catch (_) { /* no existe en esta instalación */ }
  }
  for (const f of archivos) { try { h.update(f.slice(dir.length)); h.update(fs.readFileSync(f)); } catch (_) { /* ilegible: no cuenta */ } }
  return h.digest('hex').slice(0, 16);
}
const HUELLA = huellaCodigo();

if (process.argv.includes('--asegurar')) {
  const url = `http://127.0.0.1:${PUERTO}/`;
  const lanzar = () => {
    // Windows: por WMI (Win32_Process.Create). El proceso nace fuera del árbol de Claude Code, así que no muere
    // cuando termina el comando que lo lanzó (en algunos equipos la herramienta cierra todo su árbol al salir).
    // conhost --headless lo deja sin ventana, igual que el arranque de Inicio. Si WMI falla, spawn desacoplado.
    // WMI no hereda el entorno: con PERSONAL_OS_HOME (instalaciones de prueba) se usa spawn para no perderlo.
    if (process.platform === 'win32' && !process.env.PERSONAL_OS_HOME) {
      const q = (s) => String(s).replace(/'/g, "''");
      const conhost = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'conhost.exe');
      const linea = `"${conhost}" --headless "${NODE}" "${__filename}" --puerto ${PUERTO}`;
      const ps = `$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = '${q(linea)}'; CurrentDirectory = '${q(path.dirname(__filename))}' }; $r.ReturnValue`;
      try {
        const out = require('child_process').execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
        if (String(out).trim() === '0') return;
        anotarLog(`WMI no lanzó el servidor (ReturnValue ${String(out).trim()}); se usa spawn`);
      } catch (e) { anotarLog(`WMI falló (${e.message.split('\n')[0]}); se usa spawn`); }
    }
    const p = spawn(NODE, [__filename, '--puerto', String(PUERTO)], { cwd: path.dirname(__filename), detached: true, stdio: 'ignore', windowsHide: true });
    p.unref();
  };
  const esperar = (vivo, n, cb) => salud((ok, d) => (ok === vivo || n <= 0 ? cb(ok, d) : setTimeout(() => esperar(vivo, n - 1, cb), 250)));
  const terminar = (ok, d, que) => {
    let info = {}; try { info = JSON.parse(d); } catch (_) { /* texto de error */ }
    if (ok) {
      console.log(`${que}: Personal OS ${info.version || '?'} en ${url}`);
      if (process.platform === 'win32') console.log(`Arranque al iniciar Windows: ${fs.existsSync(LNK_INICIO) ? 'instalado' : 'NO instalado (node os-servidor.js --instalar-tarea)'}`);
      if (process.argv.includes('--abrir')) {
        const n = abrirNavegador(url);
        console.log(n.ok ? `Navegador: abierto (${n.via})` : `✖ Navegador: no se pudo abrir (${n.motivo}). Ábrela a mano: ${url}`);
      }
      setTimeout(() => process.exit(0), 300);
    } else {
      console.error(`✖ El servidor no respondió en ${url} (${d}). Si el puerto ${PUERTO} lo usa otro programa, cambia config.json → servidor.puerto.`);
      try {
        const cola = fs.readFileSync(LOG_SRV, 'utf8').trim().split('\n').slice(-8).join('\n');
        if (cola) console.error(`Últimas líneas de ${LOG_SRV}:\n${cola}`);
      } catch (_) { console.error(`(sin registro en ${LOG_SRV})`); }
      process.exit(1);
    }
  };
  salud((ok, d) => {
    let vivo = null; try { vivo = JSON.parse(d); } catch (_) { /* no es el nuestro o no responde */ }
    const masViejo = ok && vivo && vivo.version && VERSION !== '?' && compararVersion(vivo.version, VERSION) < 0;
    const mismaVersion = ok && vivo && vivo.version === VERSION;
    const otroCodigo = mismaVersion && vivo.huella !== HUELLA;   // sin huella = servidor anterior a esta regla
    const forzar = ok && process.argv.includes('--reiniciar');
    if ((masViejo || otroCodigo || forzar) && vivo && vivo.pid) {
      try { process.kill(vivo.pid); } catch (_) { /* ya no estaba */ }
      const que = masViejo ? `Actualizado de ${vivo.version} a ${VERSION}` : otroCodigo ? 'Reiniciado: el código cambió en disco' : 'Reiniciado';
      return esperar(false, 20, () => { lanzar(); esperar(true, 40, (ok2, d2) => terminar(ok2, d2, que)); });
    }
    if (ok) return terminar(true, d, 'Ya corría');
    lanzar();
    esperar(true, 40, (ok2, d2) => terminar(ok2, d2, 'Arrancado'));
  });
  return;
}

if (process.argv.includes('--salud')) {
  salud((ok, d) => { console.log(ok ? `vivo en ${PUERTO}: ${d}` : `no responde en ${PUERTO} (${d})`); process.exit(ok ? 0 : 1); });
  return;
}

// Acceso en el Escritorio que abre la app como una PESTAÑA del navegador por defecto, igual que /consola
// (decisión del usuario, 23/11: nada de ventana aparte). Es un acceso a Internet (.url), sin consola ni flash.
if (process.argv.includes('--crear-acceso')) {
  if (process.platform !== 'win32') { console.error(`Abre http://127.0.0.1:${PUERTO}/ en tu navegador.`); process.exit(1); }
  const icono = C.arg('--icono', null);
  const q = (s) => String(s).replace(/'/g, "''");
  const contenido = ['[InternetShortcut]', `URL=http://127.0.0.1:${PUERTO}/`].concat(icono ? [`IconFile=${icono}`, 'IconIndex=0'] : []).join('\r\n') + '\r\n';
  // Nunca pisa un acceso ajeno: si «Personal OS.url» existe y apunta a otra cosa, usa otro nombre.
  const ps = `$d=[Environment]::GetFolderPath('Desktop');$l=Join-Path $d 'Personal OS.url';`
    + `if((Test-Path (Join-Path $d 'Personal OS.lnk')) -or ((Test-Path $l) -and -not ((Get-Content $l -Raw) -match '127\\.0\\.0\\.1:${PUERTO}'))){$l=Join-Path $d 'Personal OS (consola).url'};`
    + `[IO.File]::WriteAllText($l,'${q(contenido)}');Write-Output $l`;
  execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true }, (e, out, err) => {
    if (e) { console.error(`✖ ${(err || e.message).trim()}`); process.exit(1); }
    console.log(`Acceso directo: ${String(out).trim()} (abre una pestaña en el navegador por defecto)`);
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
  // El acceso apunta a un lanzador estable en <OS_HOME>, no a esta carpeta: instalado como plugin, cada versión
  // vive en su propia carpeta de la caché y al actualizar la vieja puede desaparecer (el servidor dejaría de
  // arrancar en silencio). El lanzador busca en cada arranque la versión instalada en installed_plugins.json.
  const lanzador = path.join(C.OS_HOME, 'arrancar-servidor.js');
  const enCache = /[\\/]plugins[\\/]cache[\\/]/i.test(__filename);
  const js = [
    '// Generado por os-servidor.js --instalar-tarea. Arranca el servidor de la consola del Personal OS.',
    "'use strict';",
    "const fs = require('fs'); const path = require('path'); const os = require('os');",
    `let destino = ${JSON.stringify(__filename)};`,
    enCache ? [
      'try {',
      "  const d = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude', 'plugins', 'installed_plugins.json'), 'utf8').replace(/^\\uFEFF/, ''));",
      "  const k = Object.keys(d.plugins || {}).find((x) => x.startsWith('personal-os@'));",
      "  const filas = (k && d.plugins[k]) || [];",
      "  const e = filas.find((x) => x.scope === 'user') || filas[0];",
      "  const c = e && path.join(e.installPath, 'scripts', 'os-servidor.js');",
      '  if (c && fs.existsSync(c)) destino = c;',
      '} catch (_) { /* sin registro: la ruta de cuando se instaló */ }',
    ].join('\n') : '// Instalación suelta: la ruta es fija.',
    "process.chdir(path.dirname(destino));",
    'require(destino);',
    '',
  ].join('\n');
  try { fs.mkdirSync(C.OS_HOME, { recursive: true }); fs.writeFileSync(lanzador, js, 'utf8'); }
  catch (e) { console.error(`✖ no se pudo escribir el lanzador ${lanzador}: ${e.message}`); process.exit(1); }
  const ps = `$s=(New-Object -ComObject WScript.Shell).CreateShortcut('${q(lnk)}');`
    + `$s.TargetPath='${q(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'conhost.exe'))}';`
    + `$s.Arguments='--headless "${q(NODE)}" "${q(lanzador)}" --puerto ${PUERTO}';`
    + `$s.WorkingDirectory='${q(C.OS_HOME)}';$s.WindowStyle=7;$s.Description='Personal OS: servidor de la consola (solo 127.0.0.1)';$s.Save()`;
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
    // Consumo real del proceso del servidor (la página mide el suyo en el navegador).
    recursos: { servidor_mb: Math.round(process.memoryUsage().rss / 1048576), desde: INICIO, oficina: fs.existsSync(path.join(STATE || '', 'oficina.html')) },
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

// ------------------------------------------------------------------ agentes (F3)

/*
 * Tres grupos, sacados de los archivos (CO-086):
 *   · propios del OS → los que trae el plugin (PLUGIN_ROOT/agents o la lista que deja el sync). Candado.
 *   · míos           → frontmatter `origen: personal-os-usuario`. Se crean, editan y borran desde la app.
 *   · de terceros    → todo lo demás (otros frameworks, sueltos). Candado.
 * Solo se escribe en ~/.claude/agents. El borrado mueve a <os-home>/_papelera-agentes (fuera de la carpeta
 * que Claude Code escanea). Un agente nuevo aparece en la siguiente sesión de Claude.
 */
const DIR_AGENTES = path.join(require('os').homedir(), '.claude', 'agents');
const PAPELERA = path.join(C.OS_HOME, '_papelera-agentes');
const ORIGEN_MIO = 'personal-os-usuario';
const RESERVADOS = new Set(['general-purpose', 'explore', 'plan', 'claude', 'fork', 'statusline-setup', 'claude-code-guide']);
const MODELOS = ['inherit', 'sonnet', 'opus', 'haiku', 'fable'];
const COLORES = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan'];   // los de Claude Code
// Agentes integrados de Claude Code (no tienen archivo). Descripción corta para la consola.
const INTEGRADOS = {
  'general-purpose': 'Agente de propósito general de Claude Code: investiga, busca código y hace tareas de varios pasos.',
  Explore: 'Explorador de solo lectura de Claude Code: barre muchos archivos y devuelve la conclusión.',
  Plan: 'Arquitecto de Claude Code: diseña planes de implementación paso a paso.',
  'claude-code-guide': 'Guía de Claude Code: responde sobre Claude Code, el Agent SDK y la API.',
  'statusline-setup': 'Configura la línea de estado de Claude Code.',
  fork: 'Copia de la sesión que trabaja en segundo plano con todo el contexto.',
  'workflow-subagent': 'Subagente que lanzan los workflows de Claude Code.',
};
const ACCESORIOS = ['', 'gafas', 'lupa', 'pluma', 'casco', 'boina', 'auriculares', 'escudo', 'portapapeles', 'corbatin', 'brujula'];
const GRUPOS_HERR = {
  lectura: ['Read', 'Grep', 'Glob'], edicion: ['Write', 'Edit'], terminal: ['Bash', 'PowerShell'], web: ['WebFetch', 'WebSearch'],
};

function propiosDelOs() {
  const s = new Set();
  try { for (const f of fs.readdirSync(path.join(C.PLUGIN_ROOT, 'agents'))) if (f.endsWith('.md')) s.add(f.slice(0, -3)); } catch (_) { /* instalación suelta */ }
  for (const n of (C.leerJson(path.join(C.OS_HOME, 'plugin-version.json'), {}) || {}).agentes || []) s.add(n);
  return s;
}

/** Frontmatter con `clave: valor` y listas YAML con guion (como `tools:` de algunos agentes). */
function leerAgente(ruta) {
  const texto = C.leerTexto(ruta, '') || '';
  const m = texto.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  const fm = {}; let ultima = null;
  for (const l of m[1].split(/\r?\n/)) {
    if (/^\s*#/.test(l) || !l.trim()) continue;
    const item = l.match(/^\s+-\s+(.*)$/);
    if (item && ultima) { fm[ultima] = (Array.isArray(fm[ultima]) ? fm[ultima] : []).concat(item[1].trim()); continue; }
    const k = l.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!k) continue;
    ultima = k[1];
    let v = k[2].trim();
    if (/^\[.*\]$/.test(v)) { try { v = JSON.parse(v); } catch (_) { v = v.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean); } }
    else if (/^".*"$/.test(v)) { try { v = JSON.parse(v); } catch (_) { v = v.slice(1, -1); } }
    else if (/^'.*'$/.test(v)) v = v.slice(1, -1).replace(/''/g, "'");
    fm[ultima] = v;
  }
  const tools = Array.isArray(fm.tools) ? fm.tools : String(fm.tools || '').split(',').map((s) => s.trim()).filter(Boolean);
  const lista = (x) => (Array.isArray(x) ? x : x ? [String(x)] : []).map(String).filter(Boolean);
  return { nombre: fm.name || path.basename(ruta, '.md'), descripcion: String(fm.description || ''), herramientas: tools,
    modelo: fm.model || 'inherit', origen: fm.origen || null, archivo: path.basename(ruta),
    // El bloque fijo de memoria lo pone la consola: no se muestra ni se edita como parte de las instrucciones.
    instrucciones: m[2].replace(/\n*<!-- memoria-os:inicio -->[\s\S]*?<!-- memoria-os:fin -->\n*/g, '\n').trim(),
    memoria: fm.memory || null,
    // Ficha (modelo Grok Bot: trabajo, metas y límites) + identidad. `color` es el campo oficial de Claude Code;
    // el resto son claves propias que Claude Code ignora sin error (doc oficial de subagentes).
    color: COLORES.includes(fm.color) ? fm.color : null, oficio: fm.oficio || '', lema: fm.lema || '',
    objetivo: fm.objetivo || '', meta: fm.meta || '', limites: lista(fm.limites), accesorio: fm.accesorio || '' };
}

/**
 * Skills del Personal OS para ⚙ Config: nombre, qué hace, cuándo usarla y qué no es (partidos de su `description`).
 * Las que tienen ajustes propios los declaran en AJUSTES_SKILL: la consola abre su panel en la ficha.
 * Origen: las carpetas de `<PLUGIN_ROOT>/skills` (instalación como plugin) o la lista `skills` de plugin-version.json
 * (instalación suelta, la escribe sync.py); el SKILL.md se lee del plugin o de ~/.claude/skills/<nombre>.
 */
const AJUSTES_SKILL = { 'paso-a-produccion': { panel: 'paso-produccion', titulo: 'Qué se genera' } };
/**
 * Cómo se muestra cada skill en ⚙ Config (un solo lugar): grupo de uso, nombre en lenguaje normal y qué hace en una
 * línea. El orden de GRUPOS_SKILL y el de cada grupo es el de la lista. Una skill que no está aquí cae en «Otras»,
 * con el nombre armado desde su slug y la primera frase de su descripción.
 */
const GRUPOS_SKILL = ['Diario', 'Requerimientos', 'Equipo', 'Sistema', 'Otras'];
const META_SKILL = {
  'brief-diario': ['Diario', 'Brief del día', 'Cruza tu estado con Jira, Outlook y Teams y arma el brief del día.'],
  'tablero-diario': ['Diario', 'Tablero del día', 'Regenera el tablero visual del día desde tu estado.'],
  retomar: ['Diario', 'Retomar', 'Reconstruye en qué quedó un proyecto o un frente.'],
  checkpoint: ['Diario', 'Checkpoint', 'Deja un tramo de trabajo listo para retomarlo.'],
  'cerrar-tarea': ['Diario', 'Cerrar con evidencia', 'Cierra tareas, compromisos o riesgos solo con evidencia.'],
  reconciliar: ['Diario', 'Reconciliar', 'Contrasta tu estado con las fuentes en vivo.'],
  timesheet: ['Diario', 'Timesheet', 'Arma y valida el registro de horas de la semana.'],
  'consola-neuronal': ['Diario', 'Consola', 'Regenera esta consola desde tus notas.'],
  'paso-a-produccion': ['Requerimientos', 'Paso a producción', 'Arma y verifica el paquete antes de desplegar a producción.'],
  'planear-sprint': ['Requerimientos', 'Planear sprint', 'Planea y estima un requerimiento de punta a punta.'],
  'certificar-funcional': ['Requerimientos', 'Certificar funcional', 'Certifica que un requerimiento funciona antes de cerrarlo.'],
  'revisar-pr': ['Requerimientos', 'Revisar PR', 'Revisa un pull request contra sus criterios de aceptación.'],
  'regresion-guiada': ['Requerimientos', 'Regresión guiada', 'Conduce la regresión de un sistema antes de publicar.'],
  'mapa-criticidad': ['Requerimientos', 'Mapa de criticidad', 'Califica qué tan crítico es cada módulo en cinco ejes.'],
  'informe-desarrollo': ['Requerimientos', 'Informe de desarrollo', 'Explica un sistema ya construido, de punta a punta.'],
  'mesa-nueva': ['Requerimientos', 'Mesa nueva', 'Monta una mesa de trabajo multi-repo desde un requerimiento.'],
  'migrar-ramas': ['Requerimientos', 'Migrar ramas', 'Depura y migra repositorios entre proyectos.'],
  'status-celula': ['Equipo', 'Status de la célula', 'Publica el tablero de planeación del equipo.'],
  personas: ['Equipo', 'Personas', 'Quién sabe de qué y quién está libre en tu equipo.'],
  'worklist-lider': ['Equipo', 'Worklist del líder', 'Publica y mantiene tu lista de trabajo.'],
  redactar: ['Equipo', 'Redactar', 'Escribe en tu voz lo que sale a tu nombre.'],
  'auditar-ux-ui': ['Sistema', 'Auditar UX/UI', 'Audita y rediseña la UX y la UI contra su marca.'],
  'maestro-skills': ['Sistema', 'Maestro de skills', 'Crea, audita y publica skills de Claude Code.'],
  'reglas-organizacion': ['Sistema', 'Reglas de la organización', 'Mantiene las políticas de tu organización y las hace cumplir.'],
};
const ORDEN_SKILL = Object.keys(META_SKILL);
function humanoDeSlug(n) { const t = String(n).replace(/-/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1); }
function primeraFrase(t) { const m = String(t || '').match(/^(.+?[.!?])(\s|$)/); return (m ? m[1] : String(t || '')).replace(/\s—.*$/, '').trim(); }
function metaSkill(n, queHace) {
  const m = META_SKILL[n];
  return m ? { grupo: m[0], titulo: m[1], corto: m[2] } : { grupo: 'Otras', titulo: humanoDeSlug(n), corto: primeraFrase(queHace) };
}
function skillsDelOs() {
  const s = new Set();
  try { for (const d of fs.readdirSync(path.join(C.PLUGIN_ROOT, 'skills'), { withFileTypes: true })) if (d.isDirectory()) s.add(d.name); } catch (_) { /* instalación suelta */ }
  for (const n of (C.leerJson(path.join(C.OS_HOME, 'plugin-version.json'), {}) || {}).skills || []) s.add(n);
  return [...s].filter((n) => /^[a-z0-9][a-z0-9-]{1,60}$/.test(n)).sort();
}
function partirDescripcion(d) {
  const t = String(d || '').replace(/\s+/g, ' ').trim();
  const iU = t.search(/\s(?:Úsal[ao]|Usal[ao]|Use (?:this|it|when|proactively)|Spawned by|Invoked by)\b/i), iN = t.search(/\sNo es (?:para|un|una)\b/);
  const fin = (a, ...bs) => Math.min(...bs.filter((b) => b > a).concat(t.length));
  return { que_hace: t.slice(0, iU > 0 ? iU : (iN > 0 ? iN : t.length)).replace(/\s—\s*$/, '').trim(),
    cuando: iU > 0 ? t.slice(iU, fin(iU, iN)).trim() : '', no_es: iN > 0 ? t.slice(iN, fin(iN, iU)).trim() : '' };
}
function listarSkills() {
  const home = require('os').homedir();
  const lista = [];
  for (const n of skillsDelOs()) {
    // plugin · skill de usuario · skill interna de la instalación suelta (<OS_HOME>/skills/<n>.md, la leen los comandos)
    const ruta = [path.join(C.PLUGIN_ROOT, 'skills', n, 'SKILL.md'), path.join(home, '.claude', 'skills', n, 'SKILL.md'),
      path.join(C.OS_HOME, 'skills', `${n}.md`)].find((r) => fs.existsSync(r));
    const a = ruta ? leerAgente(ruta) : null;
    if (!a) { lista.push(Object.assign({ nombre: n, que_hace: '', cuando: '', no_es: '', error: ruta ? 'frontmatter ilegible' : 'no está instalada', ajustes: AJUSTES_SKILL[n] || null }, metaSkill(n, ''))); continue; }
    const d = partirDescripcion(a.descripcion);
    lista.push(Object.assign({ nombre: a.nombre || n }, d, { ajustes: AJUSTES_SKILL[n] || null }, metaSkill(n, d.que_hace)));
  }
  const pos = (s) => { const i = ORDEN_SKILL.indexOf(s.nombre); return i < 0 ? 999 : i; };
  lista.sort((x, y) => GRUPOS_SKILL.indexOf(x.grupo) - GRUPOS_SKILL.indexOf(y.grupo) || pos(x) - pos(y) || x.titulo.localeCompare(y.titulo));
  return { skills: lista, grupos: GRUPOS_SKILL };
}

function listarAgentes() {
  const propios = propiosDelOs();
  const lista = [];
  let archivos = [];
  try { archivos = fs.readdirSync(DIR_AGENTES).filter((f) => f.endsWith('.md')); } catch (_) { /* sin carpeta */ }
  for (const f of archivos.sort()) {
    const a = leerAgente(path.join(DIR_AGENTES, f));
    if (!a) { lista.push({ nombre: f.slice(0, -3), grupo: 'terceros', candado: true, error: 'frontmatter ilegible' }); continue; }
    const grupo = a.origen === ORIGEN_MIO ? 'mios' : propios.has(a.nombre) ? 'propios' : 'terceros';
    lista.push(Object.assign(a, { grupo, candado: grupo !== 'mios' }));
  }
  // Los integrados de Claude Code no son archivos: se listan los conocidos y los que aparecen en la actividad.
  const act = actividad();
  const tipos = new Set(Object.keys(INTEGRADOS).concat(Object.keys(act.porTipo).filter((t) => /^[A-Za-z][\w-]{1,40}$/.test(t))));
  for (const n of tipos) {
    if (lista.some((a) => a.nombre === n) || propios.has(n)) continue;
    if (!INTEGRADOS[n] && !act.porTipo[n]) continue;
    lista.push({ nombre: n, descripcion: INTEGRADOS[n] || 'Tipo de agente visto en la actividad de tus sesiones (sin archivo en ~/.claude/agents).',
      herramientas: [], modelo: 'inherit', instrucciones: '', grupo: 'integrados', candado: true, oficio: '', lema: '', objetivo: '', meta: '', limites: [], color: null, accesorio: '', memoria: null });
  }
  // Los del plugin que no estén copiados en ~/.claude/agents (instalación como plugin) también se ven.
  for (const n of propios) if (!lista.some((a) => a.nombre === n)) {
    const a = leerAgente(path.join(C.PLUGIN_ROOT, 'agents', `${n}.md`));
    if (a) lista.push(Object.assign(a, { grupo: 'propios', candado: true }));
  }
  // Igual que en las skills: «qué hace» en una línea y «cuándo se usa» aparte, partidos de la descripción.
  for (const a of lista) Object.assign(a, partirDescripcion(a.descripcion));
  return { agentes: lista, grupos_herramientas: GRUPOS_HERR, modelos: MODELOS, colores: COLORES, accesorios: ACCESORIOS.filter(Boolean),
    carpeta: DIR_AGENTES, actividad: actividad() };
}

/**
 * Actividad real por tipo de agente, desde los eventos que escriben los hooks en <estado>/_runtime/agentes-AAAA-MM-DD.jsonl
 * (SubagentStart / SubagentStop por id). De ahí: usos 7 y 30 días, última vez, si corre ahora y las últimas ejecuciones.
 * Lo que los eventos no traen (resultado, tarea) no se inventa. Caché de 10 s.
 */
let cacheAct = { t: 0, datos: null };
function actividad() {
  if (cacheAct.datos && Date.now() - cacheAct.t < 10000) return cacheAct.datos;
  const dir = path.join(STATE || '', '_runtime');
  let archivos = [];
  try { archivos = fs.readdirSync(dir).filter((f) => /^agentes-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort().slice(-30); } catch (_) { /* sin hooks */ }
  const corridas = new Map();
  for (const f of archivos) {
    for (const l of (C.leerTexto(path.join(dir, f), '') || '').split('\n')) {
      if (!l.trim()) continue;
      let ev; try { ev = JSON.parse(l); } catch (_) { continue; }
      if (!ev.id) continue;
      const c = corridas.get(ev.id) || { id: ev.id, tipo: null, inicio: null, fin: null, sesion: ev.sesion || null, tarea: null };
      if (ev.agentType) c.tipo = ev.agentType;
      if (ev.tarea) c.tarea = String(ev.tarea).slice(0, 200);
      if (ev.estado === 'trabajando') { if (!c.inicio || ev.ts < c.inicio) c.inicio = ev.ts; c.fin = null; }
      else if (ev.estado === 'libre') c.fin = ev.ts;
      corridas.set(ev.id, c);
    }
  }
  const ahora = Date.now(), D = 86400000, porTipo = {};
  for (const c of corridas.values()) {
    if (!c.tipo || !c.inicio) continue;
    const t = porTipo[c.tipo] || (porTipo[c.tipo] = { usos7: 0, usos30: 0, ultima: null, corriendo: false, desde: null, ejecuciones: [] });
    const ini = Date.parse(c.inicio);
    if (ahora - ini < 7 * D) t.usos7++;
    if (ahora - ini < 30 * D) t.usos30++;
    const ult = c.fin || c.inicio;
    if (!t.ultima || ult > t.ultima) t.ultima = ult;
    // Corriendo: arrancó y no ha terminado, y no hace más de 3 h (un cierre perdido no lo deja "trabajando" para siempre).
    if (!c.fin && ahora - ini < 3 * 3600000) { t.corriendo = true; t.desde = c.inicio; }
    t.ejecuciones.push({ inicio: c.inicio, fin: c.fin, duracion_s: c.fin ? Math.max(0, Math.round((Date.parse(c.fin) - ini) / 1000)) : null, sesion: c.sesion ? String(c.sesion).slice(0, 8) : null, tarea: c.tarea });
  }
  for (const t of Object.values(porTipo)) t.ejecuciones = t.ejecuciones.sort((a, b) => (a.inicio < b.inicio ? 1 : -1)).slice(0, 10);
  cacheAct = { t: Date.now(), datos: { generado: new Date().toISOString(), dias: archivos.length, porTipo } };
  return cacheAct.datos;
}

// ------------------------------------------------------------------ memoria del agente (conocimiento y experiencia)

const DIR_MEM = path.join(require('os').homedir(), '.claude', 'agent-memory');
const BLOQUE_MEMORIA = `<!-- memoria-os:inicio -->
## Tu memoria: conocimiento y experiencia
Tienes una carpeta de memoria persistente. Su índice \`MEMORY.md\` ya está en tu contexto.
- **Antes de trabajar:** revisa el índice y lee con Read los archivos de \`conocimiento/\` que apliquen a la tarea. Los escribe el usuario: son guías y convenciones que mandan sobre tus preferencias.
- **Al terminar:** si aprendiste algo que te sirva la próxima vez (una corrección del usuario, un error y su causa, una decisión con su porqué, algo que funcionó), guárdalo en \`experiencia/<tema>.md\` (un archivo por tema; amplía el existente antes de crear otro) y agrega o actualiza su línea en la sección «Experiencia» de \`MEMORY.md\`.
- No toques \`conocimiento/\` ni la sección «Conocimiento» del índice: son del usuario. Mantén \`MEMORY.md\` por debajo de 200 líneas.
- Nunca guardes secretos ni datos reales de personas.
<!-- memoria-os:fin -->`;
const RUTA_MEM = /^(MEMORY\.md|(conocimiento|experiencia)\/[a-z0-9][a-z0-9-]{0,60}\.md)$/;

function indiceInicial(nombre) {
  return `# Memoria de ${nombre}\n\n## Conocimiento\n<!-- conocimiento:inicio -->\n<!-- conocimiento:fin -->\n\n## Experiencia\n(El agente agrega aquí una línea por cada archivo de experiencia/.)\n`;
}

/** Reescribe la sección «Conocimiento» del índice con los archivos que hay en conocimiento/ (su título = primera línea #). */
function reindexarConocimiento(nombre) {
  const dir = path.join(DIR_MEM, nombre);
  const ruta = path.join(dir, 'MEMORY.md');
  let idx = C.leerTexto(ruta, null) || indiceInicial(nombre);
  if (!/<!-- conocimiento:inicio -->[\s\S]*?<!-- conocimiento:fin -->/.test(idx)) idx = idx.replace(/^(# .*\n)/, `$1\n## Conocimiento\n<!-- conocimiento:inicio -->\n<!-- conocimiento:fin -->\n`);
  let arch = [];
  try { arch = fs.readdirSync(path.join(dir, 'conocimiento')).filter((f) => f.endsWith('.md')).sort(); } catch (_) { /* vacío */ }
  const lineas = arch.map((f) => {
    const t = (C.leerTexto(path.join(dir, 'conocimiento', f), '') || '').match(/^#\s+(.+)$/m);
    return `- [${t ? t[1].trim() : f.slice(0, -3)}](conocimiento/${f})`;
  });
  idx = idx.replace(/<!-- conocimiento:inicio -->[\s\S]*?<!-- conocimiento:fin -->/, `<!-- conocimiento:inicio -->\n${lineas.join('\n')}${lineas.length ? '\n' : ''}<!-- conocimiento:fin -->`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(ruta, idx, 'utf8');
}

function memoriaDe(nombre) {
  if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(nombre)) return { error: 'nombre inválido' };
  const dir = path.join(DIR_MEM, nombre);
  const archivos = [];
  for (const g of ['conocimiento', 'experiencia']) {
    let fs_ = [];
    try { fs_ = fs.readdirSync(path.join(dir, g)).filter((f) => f.endsWith('.md')); } catch (_) { /* vacío */ }
    for (const f of fs_.sort()) {
      const r = path.join(dir, g, f); const st = fs.statSync(r);
      const t = (C.leerTexto(r, '') || '').match(/^#\s+(.+)$/m);
      archivos.push({ grupo: g, ruta: `${g}/${f}`, titulo: t ? t[1].trim() : f.slice(0, -3), bytes: st.size, modificado: st.mtime.toISOString() });
    }
  }
  const indice = C.leerTexto(path.join(dir, 'MEMORY.md'), null);
  return { carpeta: dir, existe: fs.existsSync(dir), indice, lineas_indice: indice ? indice.split('\n').length : 0, archivos };
}

function leerMemoria(nombre, ruta) {
  if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(nombre) || !RUTA_MEM.test(ruta)) return null;
  return C.leerTexto(path.join(DIR_MEM, nombre, ruta), null);
}

function esMio(nombre) {
  const r = path.join(DIR_AGENTES, `${nombre}.md`);
  const a = fs.existsSync(r) ? leerAgente(r) : null;
  return !!(a && a.origen === ORIGEN_MIO);
}

function guardarConocimiento(b) {
  const nombre = String(b.agente || '');
  if (!esMio(nombre)) return { ok: false, mensaje: 'solo se escribe conocimiento en tus agentes' };
  const slug = String(b.slug || '').trim();
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(slug)) return { ok: false, mensaje: 'el nombre del archivo va en minúsculas, números y guiones' };
  const titulo = String(b.titulo || '').replace(/\s+/g, ' ').trim();
  if (titulo.length < 3 || titulo.length > 90) return { ok: false, mensaje: 'el título va de 3 a 90 caracteres' };
  let contenido = String(b.contenido || '').replace(/\r\n/g, '\n').trim();
  if (contenido.length < 10) return { ok: false, mensaje: 'el contenido está vacío' };
  if (contenido.length > 60000) return { ok: false, mensaje: 'el archivo pasa de 60 KB: pártelo por temas' };
  if (!/^#\s/.test(contenido)) contenido = `# ${titulo}\n\n${contenido}`;
  else contenido = contenido.replace(/^#\s+.*$/m, `# ${titulo}`);
  const dir = path.join(DIR_MEM, nombre, 'conocimiento');
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `${slug}.md`), tmp = dest + '.tmp';
  if (b.original && b.original !== slug) {
    if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(b.original)) return { ok: false, mensaje: 'original inválido' };
    if (fs.existsSync(dest)) return { ok: false, mensaje: `ya existe conocimiento/${slug}.md` };
  } else if (!b.original && fs.existsSync(dest)) return { ok: false, mensaje: `ya existe conocimiento/${slug}.md` };
  fs.writeFileSync(tmp, contenido + '\n', 'utf8'); fs.renameSync(tmp, dest);
  if (b.original && b.original !== slug) moverMemoriaAPapelera(nombre, `conocimiento/${b.original}.md`);
  reindexarConocimiento(nombre);
  if (C.leerTexto(dest, '') !== contenido + '\n') return { ok: false, mensaje: 'se escribió pero no se pudo releer igual' };
  return { ok: true, mensaje: `conocimiento/${slug}.md guardado e indexado en MEMORY.md` };
}

function moverMemoriaAPapelera(nombre, ruta) {
  const desde = path.join(DIR_MEM, nombre, ruta);
  if (!fs.existsSync(desde)) return;
  fs.mkdirSync(PAPELERA, { recursive: true });
  const sello = new Date().toISOString().replace(/[:.]/g, '-');
  fs.renameSync(desde, path.join(PAPELERA, `${nombre}--${ruta.replace('/', '--').slice(0, -3)}.${sello}.md`));
}

function borrarConocimiento(b) {
  const nombre = String(b.agente || ''), slug = String(b.slug || '');
  if (!esMio(nombre)) return { ok: false, mensaje: 'solo se borra conocimiento de tus agentes' };
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(slug)) return { ok: false, mensaje: 'nombre inválido' };
  if (!fs.existsSync(path.join(DIR_MEM, nombre, 'conocimiento', `${slug}.md`))) return { ok: false, mensaje: 'no existe' };
  moverMemoriaAPapelera(nombre, `conocimiento/${slug}.md`);
  reindexarConocimiento(nombre);
  return { ok: true, mensaje: `conocimiento/${slug}.md movido a la papelera` };
}

/** Valida y arma el .md. Devuelve {error} o {nombre, texto}. */
function armarAgente(b) {
  const nombre = String(b.nombre || '').trim();
  if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(nombre)) return { error: 'el nombre va en minúsculas, números y guiones (3 a 40), sin espacios' };
  if (RESERVADOS.has(nombre)) return { error: `«${nombre}» es un nombre reservado de Claude Code` };
  const descripcion = String(b.descripcion || '').replace(/\s+/g, ' ').trim();
  if (descripcion.length < 20) return { error: 'la descripción (cuándo usarlo) necesita al menos 20 caracteres: es lo que Claude lee para decidir llamarlo' };
  if (descripcion.length > 1000) return { error: 'la descripción pasa de 1000 caracteres' };
  const instrucciones = String(b.instrucciones || '').replace(/\r\n/g, '\n').trim();
  if (instrucciones.length < 20) return { error: 'las instrucciones necesitan al menos 20 caracteres' };
  if (/^---\s*$/m.test(instrucciones)) return { error: 'las instrucciones no pueden tener una línea con solo «---» (rompe el frontmatter)' };
  const modelo = MODELOS.includes(b.modelo) ? b.modelo : 'inherit';
  const herr = [];
  for (const g of b.grupos || []) for (const t of GRUPOS_HERR[g] || []) if (!herr.includes(t)) herr.push(t);
  for (const t of String(b.otras || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    if (!/^[A-Za-z][A-Za-z0-9_-]*(\*)?$/.test(t)) return { error: `herramienta con nombre inválido: «${t}»` };
    if (!herr.includes(t)) herr.push(t);
  }
  // Ficha: textos de una línea con su tope; límites, hasta 6 líneas.
  const corto = (v, max, campo) => {
    const s = String(v || '').replace(/\s+/g, ' ').trim();
    if (s.length > max) throw new Error(`${campo} pasa de ${max} caracteres`);
    return s;
  };
  let ficha;
  try {
    ficha = {
      oficio: corto(b.oficio, 40, 'el oficio'), lema: corto(b.lema, 90, 'el lema'),
      objetivo: corto(b.objetivo, 220, 'el objetivo'), meta: corto(b.meta, 220, 'la meta de cierre'),
      limites: (Array.isArray(b.limites) ? b.limites : String(b.limites || '').split('\n')).map((l, i) => corto(l, 140, `el límite ${i + 1}`)).filter(Boolean),
    };
  } catch (e) { return { error: e.message }; }
  if (ficha.limites.length > 6) return { error: 'máximo 6 límites' };
  const color = COLORES.includes(b.color) ? b.color : null;
  const accesorio = ACCESORIOS.includes(b.accesorio) ? b.accesorio : '';

  // Los textos van entre comillas dobles (JSON es YAML válido): así un «: » no rompe nada (bug de la 3.2.1).
  const fm = ['---', `name: ${nombre}`, `description: ${JSON.stringify(descripcion)}`];
  if (herr.length) fm.push(`tools: ${herr.join(', ')}`);
  if (modelo !== 'inherit') fm.push(`model: ${modelo}`);
  if (color) fm.push(`color: ${color}`);
  for (const k of ['oficio', 'lema', 'objetivo', 'meta']) if (ficha[k]) fm.push(`${k}: ${JSON.stringify(ficha[k])}`);
  if (ficha.limites.length) fm.push(`limites: ${JSON.stringify(ficha.limites)}`);
  if (accesorio) fm.push(`accesorio: ${accesorio}`);
  // Memoria nativa de Claude Code (doc de subagentes): `memory: user` → ~/.claude/agent-memory/<nombre>/, con
  // MEMORY.md como índice (sus primeras 200 líneas entran solas) y Read/Write/Edit habilitadas para esa carpeta.
  if (b.memoria) fm.push('memory: user');
  fm.push(`origen: ${ORIGEN_MIO}`, '---', '');
  let cuerpo = instrucciones.replace(/\n*<!-- memoria-os:inicio -->[\s\S]*?<!-- memoria-os:fin -->\n*/g, '\n').trim();
  if (b.memoria) cuerpo += '\n\n' + BLOQUE_MEMORIA;
  return { nombre, texto: fm.join('\n') + cuerpo + '\n' };
}

function guardarAgente(b) {
  const r = armarAgente(b);
  if (r.error) return { ok: false, mensaje: r.error };
  const destino = path.join(DIR_AGENTES, `${r.nombre}.md`);
  const original = b.original ? String(b.original) : null;
  if (original && !/^[a-z0-9][a-z0-9-]{2,39}$/.test(original)) return { ok: false, mensaje: 'original inválido' };
  const existe = fs.existsSync(destino);
  if (existe) {
    const a = leerAgente(destino);
    if (!a || a.origen !== ORIGEN_MIO) return { ok: false, mensaje: `ya existe un agente «${r.nombre}» que no es tuyo: tiene candado` };
    if (original !== r.nombre) return { ok: false, mensaje: `ya tienes un agente llamado «${r.nombre}»` };
  }
  if (original && original !== r.nombre) {
    const viejo = path.join(DIR_AGENTES, `${original}.md`);
    const a = fs.existsSync(viejo) ? leerAgente(viejo) : null;
    if (!a || a.origen !== ORIGEN_MIO) return { ok: false, mensaje: `«${original}» no es tuyo o ya no existe` };
  }
  fs.mkdirSync(DIR_AGENTES, { recursive: true });
  const tmp = destino + '.tmp';
  fs.writeFileSync(tmp, r.texto, 'utf8');
  fs.renameSync(tmp, destino);
  // Se relee lo escrito (CO-029): si no se lee igual, no se da por guardado.
  const leido = leerAgente(destino);
  if (!leido || leido.nombre !== r.nombre || leido.origen !== ORIGEN_MIO) return { ok: false, mensaje: 'se escribió pero no se pudo releer igual: revisa el archivo' };
  if (original && original !== r.nombre) moverAPapelera(original);
  if (b.memoria && !fs.existsSync(path.join(DIR_MEM, r.nombre, 'MEMORY.md'))) reindexarConocimiento(r.nombre);
  // Claude Code vigila ~/.claude/agents y toma el cambio en segundos, sin reiniciar (doc oficial de subagentes).
  return { ok: true, mensaje: `«${r.nombre}» guardado · Claude Code lo toma en unos segundos, sin reiniciar` };
}

function moverAPapelera(nombre) {
  fs.mkdirSync(PAPELERA, { recursive: true });
  const sello = new Date().toISOString().replace(/[:.]/g, '-');
  fs.renameSync(path.join(DIR_AGENTES, `${nombre}.md`), path.join(PAPELERA, `${nombre}.${sello}.md`));
}

function borrarAgente(b) {
  const nombre = String(b.nombre || '');
  if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(nombre)) return { ok: false, mensaje: 'nombre inválido' };
  const ruta = path.join(DIR_AGENTES, `${nombre}.md`);
  const a = fs.existsSync(ruta) ? leerAgente(ruta) : null;
  if (!a) return { ok: false, mensaje: `no existe «${nombre}»` };
  if (a.origen !== ORIGEN_MIO) return { ok: false, mensaje: `«${nombre}» tiene candado: no es tuyo` };
  moverAPapelera(nombre);
  return { ok: true, mensaje: `«${nombre}» movido a la papelera (${PAPELERA.replace(/\\/g, '/')})` };
}

// ------------------------------------------------------------------ terminal: tema de la marca (marca-terminal.js)

/** Corre marca-terminal.js con los argumentos dados y devuelve su salida (el script valida la marca y los colores). */
function marcaTerminal(args, timeout) {
  return new Promise((resolve) => {
    execFile(process.execPath, [path.join(__dirname, 'marca-terminal.js'), ...args], { windowsHide: true, timeout: timeout || 30000, cwd: STATE || C.OS_HOME },
      (e, out, err) => resolve({ ok: !e, out: String(out || ''), err: String(err || '').trim() }));
  });
}

async function terminalEstado() {
  const r = await marcaTerminal(['--estado']);
  if (!r.ok) {
    const sinArchivo = /no existe .*terminal\.json/.test(r.err);
    return { ok: true, existe: false, mensaje: sinArchivo ? 'Todavía no hay marcas configuradas.' : r.err.replace(/^ERROR:\s*/, '').slice(0, 300) };
  }
  return Object.assign({ existe: true }, JSON.parse(r.out.trim().split(/\r?\n/).pop()));
}

/** Guarda los interruptores y la marca activa en terminal.json y aplica. Solo esas tres claves se aceptan. */
async function terminalGuardar(cuerpo) {
  const est = await terminalEstado();
  if (!est.existe) return { ok: false, mensaje: est.mensaje || 'no hay marcas configuradas' };
  const datos = JSON.parse(fs.readFileSync(est.ruta, 'utf8').replace(/^﻿/, ''));
  if ('encendido' in cuerpo) { if (typeof cuerpo.encendido !== 'boolean') return { ok: false, mensaje: 'encendido debe ser sí o no' }; datos.encendido = cuerpo.encendido; }
  if ('restaurar_pestanas' in cuerpo) { if (typeof cuerpo.restaurar_pestanas !== 'boolean') return { ok: false, mensaje: 'restaurar_pestanas debe ser sí o no' }; datos.restaurar_pestanas = cuerpo.restaurar_pestanas; }
  if ('activa' in cuerpo) { if (!Object.prototype.hasOwnProperty.call(datos.marcas || {}, cuerpo.activa)) return { ok: false, mensaje: 'esa marca no existe' }; datos.activa = cuerpo.activa; }
  const antes = fs.readFileSync(est.ruta);
  fs.writeFileSync(est.ruta, JSON.stringify(datos, null, 2) + '\n');
  const r = await marcaTerminal(['--aplicar'], 120000);
  if (!r.ok) { fs.writeFileSync(est.ruta, antes); return { ok: false, mensaje: 'no se aplicó: ' + (r.err.replace(/^ERROR:\s*/, '') || 'error').slice(0, 300) }; }
  const plan = r.out.split(/\r?\n/).filter((l) => l.startsWith('  - ')).map((l) => l.slice(4));
  return Object.assign(await terminalEstado(), { ok: true, plan });
}

const TM_COLORES = ['principal', 'acento', 'acento_vivo', 'claro', 'fondo', 'fondo_suave', 'texto', 'gris', 'gris_suave', 'ok', 'error', 'alerta'];
const TM_POS = ['center', 'top', 'bottom', 'left', 'right', 'topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
const TM_IMG_MAX = 2 * 1024 * 1024;

/** Imagen de una marca (marca de agua o ícono) para la previsualización: solo dentro de la carpeta de marcas. */
async function terminalImagen(marca, tipo) {
  const est = await terminalEstado();
  if (!est.existe || !['agua', 'icono'].includes(tipo)) return null;
  const datos = JSON.parse(fs.readFileSync(est.ruta, 'utf8').replace(/^﻿/, ''));
  const m = (datos.marcas || {})[marca];
  const rel = m && (tipo === 'agua' ? m.marca_agua_imagen : m.icono);
  if (!rel) return null;
  const base = path.dirname(est.ruta);
  const archivo = path.resolve(base, rel);
  if (!archivo.startsWith(base + path.sep) || !/\.png$/i.test(archivo) || !fs.existsSync(archivo)) return null;
  return fs.readFileSync(archivo);
}

/**
 * Crear, editar o quitar una marca. { accion: 'guardar', id?, marca: {nombre, corto, lema, colores,
 * marca_agua_opacidad, marca_agua_posicion}, imagenes?: { agua?: base64 PNG | null, icono?: base64 PNG | null } }
 * o { accion: 'quitar', id }. La marca activa no se quita. Si se edita la activa con el tema prendido, se reaplica.
 */
async function terminalMarca(cuerpo) {
  const est = await terminalEstado();
  if (!est.existe) return { ok: false, mensaje: est.mensaje || 'no hay marcas configuradas' };
  const datos = JSON.parse(fs.readFileSync(est.ruta, 'utf8').replace(/^﻿/, ''));
  datos.marcas = datos.marcas || {};
  const base = path.dirname(est.ruta);
  const dirImg = path.join(base, 'terminal');
  const texto = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);

  if (cuerpo.accion === 'quitar') {
    const id = String(cuerpo.id || '');
    if (!Object.prototype.hasOwnProperty.call(datos.marcas, id)) return { ok: false, mensaje: 'esa marca no existe' };
    if (id === datos.activa) return { ok: false, mensaje: 'es la marca activa: elige otra antes de quitarla' };
    delete datos.marcas[id];
    fs.writeFileSync(est.ruta, JSON.stringify(datos, null, 2) + '\n');
    return Object.assign(await terminalEstado(), { ok: true, mensaje: 'marca quitada' });
  }
  if (cuerpo.accion !== 'guardar') return { ok: false, mensaje: 'acción desconocida' };

  const e = cuerpo.marca || {};
  const nombre = texto(e.nombre, 60);
  if (!nombre) return { ok: false, mensaje: 'la marca necesita un nombre' };
  const colores = {};
  for (const k of TM_COLORES) {
    const v = String((e.colores || {})[k] || '');
    if (!/^#[0-9A-Fa-f]{6}$/.test(v)) return { ok: false, mensaje: `el color «${k}» no es válido (#RRGGBB)` };
    colores[k] = v.toUpperCase();
  }
  const opacidad = Number(e.marca_agua_opacidad);
  if (!(opacidad >= 0 && opacidad <= 1)) return { ok: false, mensaje: 'la opacidad va de 0 a 1' };
  const posicion = TM_POS.includes(e.marca_agua_posicion) ? e.marca_agua_posicion : 'center';

  let id = String(cuerpo.id || '');
  const nueva = !id;
  if (nueva) {
    const raiz = C.sinTildes(nombre).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'marca';
    id = raiz; for (let n = 2; Object.prototype.hasOwnProperty.call(datos.marcas, id); n++) id = `${raiz}-${n}`;
  } else if (!Object.prototype.hasOwnProperty.call(datos.marcas, id)) return { ok: false, mensaje: 'esa marca no existe' };

  const previa = datos.marcas[id] || {};
  const m = Object.assign({}, previa, {
    nombre, corto: texto(e.corto, 24) || nombre, lema: texto(e.lema, 90), colores,
    marca_agua_opacidad: Math.round(opacidad * 100) / 100, marca_agua_posicion: posicion,
  });
  // Imágenes: base64 de un PNG (se verifica la firma), null para quitarla, ausente para dejarla como está.
  for (const [tipo, clave, sufijo] of [['agua', 'marca_agua_imagen', 'marca-agua'], ['icono', 'icono', 'icono']]) {
    const img = (cuerpo.imagenes || {})[tipo];
    if (img === undefined) continue;
    if (img === null) { m[clave] = null; continue; }
    const buf = Buffer.from(String(img).replace(/^data:image\/png;base64,/, ''), 'base64');
    if (buf.length > TM_IMG_MAX) return { ok: false, mensaje: `la imagen (${tipo === 'agua' ? 'marca de agua' : 'ícono'}) pasa de 2 MB` };
    if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) return { ok: false, mensaje: `la imagen (${tipo === 'agua' ? 'marca de agua' : 'ícono'}) debe ser PNG` };
    fs.mkdirSync(dirImg, { recursive: true });
    const nombreArch = `${id}-${sufijo}.png`;
    fs.writeFileSync(path.join(dirImg, nombreArch), buf);
    m[clave] = `terminal/${nombreArch}`;
  }
  datos.marcas[id] = m;
  const antes = fs.readFileSync(est.ruta);
  fs.writeFileSync(est.ruta, JSON.stringify(datos, null, 2) + '\n');
  let plan = null;
  if (id === datos.activa && datos.encendido !== false) {
    const r = await marcaTerminal(['--aplicar'], 120000);
    if (!r.ok) { fs.writeFileSync(est.ruta, antes); return { ok: false, mensaje: 'no se aplicó: ' + (r.err.replace(/^ERROR:\s*/, '') || 'error').slice(0, 300) }; }
    plan = r.out.split(/\r?\n/).filter((l) => l.startsWith('  - ')).map((l) => l.slice(4));
  }
  return Object.assign(await terminalEstado(), { ok: true, id, nueva, plan, mensaje: nueva ? 'marca creada' : 'marca guardada' });
}

// ------------------------------------------------------------------ paso a producción: qué se genera

/**
 * fuentes.yaml del usuario: --fuentes <ruta> (pruebas) > el --config-dir de servidor.consola_args (instalación
 * suelta) > <stateDir>/config. Nunca una ruta fija.
 */
function rutaFuentes() {
  const forzado = C.arg('--fuentes', null);
  if (forzado) return path.resolve(forzado);
  const a = (C.config().servidor || {}).consola_args || [];
  const i = a.indexOf('--config-dir');
  const dir = i > -1 && a[i + 1] ? a[i + 1] : (STATE ? path.join(STATE, 'config') : null);
  return dir ? path.join(path.resolve(dir), 'fuentes.yaml') : null;
}

const sangria = (l) => (l.match(/^[ \t]*/) || [''])[0].length;
const esVacia = (l) => /^\s*(#.*)?$/.test(l);

/**
 * Lee el bloque `paso_produccion:` sin parser YAML (Node puro): entregables (id, nombre, con) y la línea `omitir:`.
 * Acepta entradas en flujo de una línea (`- { id: x, nombre: "…", con: y }`) o en bloque (`- id: x` + claves debajo).
 */
function leerPasoProduccion(texto) {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/);
  const ini = lineas.findIndex((l) => /^paso_produccion:\s*(#.*)?$/.test(l));
  if (ini < 0) return { ini: -1, lineas, entregables: [], omitir: [], lineaOmitir: -1, sangriaBloque: 2 };
  let fin = lineas.length;
  for (let k = ini + 1; k < lineas.length; k++) if (lineas[k] !== '' && /^\S/.test(lineas[k])) { fin = k; break; }
  let sangriaBloque = null, lineaOmitir = -1, omitir = [], iEnt = -1;
  for (let k = ini + 1; k < fin; k++) {
    if (esVacia(lineas[k])) continue;
    if (sangriaBloque === null) sangriaBloque = sangria(lineas[k]);
    if (sangria(lineas[k]) !== sangriaBloque) continue;
    const mo = lineas[k].match(/^\s+omitir:\s*\[(.*)\]\s*(#.*)?$/);
    if (mo) { lineaOmitir = k; omitir = [...mo[1].matchAll(/"([^"]*)"|'([^']*)'|([\w.-]+)/g)].map((x) => x[1] ?? x[2] ?? x[3]).filter(Boolean); }
    if (/^\s+entregables:\s*(#.*)?$/.test(lineas[k])) iEnt = k;
  }
  const entregables = [];
  if (iEnt > -1) {
    const base = sangria(lineas[iEnt]);
    let actual = null;
    for (let k = iEnt + 1; k < fin; k++) {
      const l = lineas[k];
      if (esVacia(l)) continue;
      if (sangria(l) <= base && !/^\s*-/.test(l)) break;              // siguiente clave del bloque (aprobaciones…)
      const md = l.match(/^\s*-\s+(?:\{\s*)?id:\s*["']?([\w.-]+)/);
      if (md) { actual = { id: md[1], texto: l }; entregables.push(actual); }
      else if (actual && /^\s*-/.test(l) && sangria(l) <= base + 2) actual = null;
      else if (actual) actual.texto += '\n' + l;
    }
  }
  const campo = (t, c) => {
    // Un «con:» dentro del texto de otra clave (p. ej. el nombre) no cuenta: se vacían los textos ajenos.
    if (c !== 'nombre') t = t.replace(new RegExp(`(\\b(?!${c}\\b)[\\w-]+:\\s*)"(?:[^"\\\\]|\\\\.)*"`, 'g'), '$1""');
    const m = t.match(new RegExp(`(?:^|[\\s{,])${c}:\\s*(?:"((?:[^"\\\\]|\\\\.)*)"|'([^']*)'|([^,}\\n#]+))`));
    return m ? (m[1] ?? m[2] ?? m[3] ?? '').trim() : null;
  };
  return {
    ini, fin, lineas, lineaOmitir, omitir, sangriaBloque: sangriaBloque ?? 2,
    // `corto` (opcional): la etiqueta breve que muestra la consola; el `nombre` largo queda como detalle
    entregables: entregables.map((e) => ({ id: e.id, nombre: campo(e.texto, 'nombre') || e.id, corto: campo(e.texto, 'corto') || null, con: campo(e.texto, 'con') || null })),
  };
}

function pasoProduccion() {
  const ruta = rutaFuentes();
  if (!ruta || !fs.existsSync(ruta)) return { ruta_existe: false, seccion: false, entregables: [] };
  const p = leerPasoProduccion(fs.readFileSync(ruta, 'utf8'));
  const om = new Set(p.omitir);
  let actualizado = null; try { actualizado = fs.statSync(ruta).mtime.toISOString(); } catch (_) { /* sin fecha */ }
  return {
    ruta_existe: true, seccion: p.ini > -1, actualizado,
    entregables: p.entregables.map((e) => ({ ...e, omitido: om.has(e.id), efectivo_omitido: om.has(e.id) || (!!e.con && om.has(e.con)) })),
  };
}

/** Reescribe SOLO la línea `omitir:` del bloque (o la crea tras `paso_produccion:`). Lista cerrada: ids existentes. */
function guardarPasoProduccion(b) {
  const ruta = rutaFuentes();
  if (!ruta || !fs.existsSync(ruta)) return { ok: false, mensaje: 'no encuentro fuentes.yaml' };
  if (!Array.isArray(b.omitir) || b.omitir.length > 100 || !b.omitir.every((x) => typeof x === 'string')) return { ok: false, mensaje: 'omitir debe ser una lista de ids' };
  const crudo = fs.readFileSync(ruta, 'utf8');
  const p = leerPasoProduccion(crudo);
  if (p.ini < 0) return { ok: false, mensaje: 'fuentes.yaml no tiene la sección paso_produccion' };
  const ids = p.entregables.map((e) => e.id);
  const malos = b.omitir.filter((x) => !ids.includes(x));
  if (malos.length) return { ok: false, mensaje: `entregable desconocido: ${malos.join(', ')}` };
  const lista = ids.filter((x) => b.omitir.includes(x));                 // orden de la configuración, sin duplicados
  const eol = crudo.includes('\r\n') ? '\r\n' : '\n';
  const bom = crudo.startsWith('﻿') ? '﻿' : '';
  const lineas = p.lineas.slice();
  const valor = `omitir: [${lista.map((x) => JSON.stringify(x)).join(', ')}]`;
  if (p.lineaOmitir > -1) {
    const vieja = lineas[p.lineaOmitir];
    const coment = (vieja.match(/\]\s*(#.*)$/) || [])[1];
    lineas[p.lineaOmitir] = vieja.match(/^\s*/)[0] + valor + (coment ? '   ' + coment : '');
  } else {
    lineas.splice(p.ini + 1, 0, ' '.repeat(p.sangriaBloque) + valor + '   # entregables que no se generan (⚙ Config de la consola)');
  }
  const respaldo = ruta + '.antes-omitir';
  if (!fs.existsSync(respaldo)) fs.copyFileSync(ruta, respaldo);
  const tmp = ruta + '.tmp-omitir';
  fs.writeFileSync(tmp, bom + lineas.join(eol), 'utf8');
  fs.renameSync(tmp, ruta);
  return { ok: true, mensaje: lista.length ? `no se generan: ${lista.join(', ')}` : 'se genera todo', omitir: lista };
}

// ------------------------------------------------------------------ permisos · bases de datos (F1)

/**
 * Conexiones de base de datos que Claude usa en las sesiones. Cada conexión es un JSON propio (servidor, usuario,
 * password, catalogos, modo_lectura, modo_escritura y lo que traiga) que leen los wrappers de los proyectos y /bd-test:
 * la consola edita esos mismos archivos sin moverlos ni quitarles campos. El registro `<BD_HOME>/conexiones-bd.json`
 * guarda nombre, motor y etiquetas; si no existe se siembra descubriendo `~/.claude/<carpeta>/bd-*.json`.
 * Los permisos por acción viven en `permisos` del archivo de la conexión y los hacen cumplir el guardia y los wrappers
 * (D-073). Las seis acciones tienen modo (bloqueado · preguntar · automatico); lo corre bd-ejecutar.py y el guardia
 * aplica el modo. Una escritura sin modo guardado vale «bloqueado». La contraseña vive en el almacén de credenciales del
 * sistema (lib/credenciales.py; el JSON solo lleva "password_en": "almacen") y nunca sale por GET ni por logs: solo
 * por POST /revelar con token. Un JSON viejo con `password` en claro se sigue leyendo y pasa al almacén al guardar.
 * Pruebas: --bd-dir <carpeta> (registro y conexiones nuevas) y --bd-descubrir <carpeta> (en vez de ~/.claude).
 */
const BD_HOME = path.resolve(C.arg('--bd-dir', null) || C.OS_HOME);
const BD_DESCUBRIR = path.resolve(C.arg('--bd-descubrir', null) || path.join(require('os').homedir(), '.claude'));
const BD_REGISTRO = path.join(BD_HOME, 'conexiones-bd.json');
const BD_ACCIONES = [
  { id: 'leer', nombre: 'Leer', sql: 'SELECT' }, { id: 'crear', nombre: 'Crear', sql: 'INSERT' },
  { id: 'actualizar', nombre: 'Actualizar', sql: 'UPDATE / MERGE' }, { id: 'borrar', nombre: 'Borrar', sql: 'DELETE / TRUNCATE' },
  { id: 'estructura', nombre: 'Estructura', sql: 'CREATE / ALTER / DROP' }, { id: 'ejecutar', nombre: 'Ejecutar', sql: 'EXEC / procedimientos' },
];
const BDP = require('./lib/bd-permisos.js');
const BD_MODOS = BDP.MODOS;   // las seis acciones (D-073)
const BD_ETIQUETAS = ['produccion', 'staging', 'qa', 'develop', 'test'];
const BD_MOTORES = ['sqlserver', 'postgresql', 'mysql', 'oracle', 'mongodb', 'otro'];
const slug = (s) => /^[a-z0-9][a-z0-9-]{0,40}$/.test(String(s || ''));
const etiquetaValida = (s) => /^[a-z0-9][a-z0-9 _-]{0,29}$/.test(String(s || ''));

/** Lee un JSON conservando su forma de escribirse (BOM y fin de línea). null si no se puede leer. */
function bdLeerArchivo(ruta) {
  let crudo;
  try { crudo = fs.readFileSync(ruta, 'utf8'); } catch (_) { return null; }
  try { return { datos: JSON.parse(crudo.replace(/^﻿/, '')), bom: crudo.startsWith('﻿'), eol: crudo.includes('\r\n') ? '\r\n' : '\n' }; }
  catch (_) { return { datos: null, error: 'JSON ilegible', bom: false, eol: '\n' }; }
}
/** Escritura atómica con respaldo `.antes-consola` la primera vez; respeta BOM y fin de línea del original. */
function bdEscribir(ruta, datos, forma) {
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  if (fs.existsSync(ruta) && !fs.existsSync(ruta + '.antes-consola')) fs.copyFileSync(ruta, ruta + '.antes-consola');
  const f = forma || { bom: false, eol: '\n' };
  const tmp = ruta + '.tmp-consola';
  fs.writeFileSync(tmp, (f.bom ? '﻿' : '') + JSON.stringify(datos, null, 2).replace(/\n/g, f.eol) + f.eol, 'utf8');
  fs.renameSync(tmp, ruta);
}
/** Solo se tocan archivos de conexión: los descubiertos (`<descubrir>/<carpeta>/bd-*.json`) o los nuevos (`<BD_HOME>/conexiones/*.json`). */
function bdRutaPermitida(r) {
  const a = path.resolve(String(r || ''));
  const enDesc = path.dirname(path.dirname(a)) === BD_DESCUBRIR && /^bd-[\w.-]+\.json$/i.test(path.basename(a));
  const enNuevas = path.dirname(a) === path.join(BD_HOME, 'conexiones') && /^[a-z0-9-]+\.json$/.test(path.basename(a));
  return enDesc || enNuevas;
}
function bdDescubrir() {
  const out = [];
  let dirs = [];
  try { dirs = fs.readdirSync(BD_DESCUBRIR, { withFileTypes: true }).filter((d) => d.isDirectory()); } catch (_) { return out; }
  for (const d of dirs) {
    let fs2 = [];
    try { fs2 = fs.readdirSync(path.join(BD_DESCUBRIR, d.name)).filter((f) => /^bd-[\w.-]+\.json$/i.test(f)); } catch (_) { continue; }
    for (const f of fs2) {
      const ruta = path.join(BD_DESCUBRIR, d.name, f);
      const a = bdLeerArchivo(ruta);
      if (a && a.datos && a.datos.servidor) out.push(ruta);
    }
  }
  return out.sort();
}
function bdRegistro() {
  const r = C.leerJson(BD_REGISTRO, null);
  if (r && Array.isArray(r.conexiones)) { r.etiquetas_propias = Array.isArray(r.etiquetas_propias) ? r.etiquetas_propias : []; return r; }
  // Siembra: cada archivo descubierto entra con el nombre de su archivo; las etiquetas las pone el usuario.
  const usados = new Set();
  const conexiones = bdDescubrir().map((ruta) => {
    let id = path.basename(ruta, '.json').toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40);
    while (usados.has(id)) id += '-2';
    usados.add(id);
    return { id, nombre: path.basename(ruta, '.json'), archivo: ruta, motor: 'sqlserver', etiquetas: [] };
  });
  const nuevo = { conexiones, etiquetas_propias: [] };
  bdEscribir(BD_REGISTRO, nuevo);
  return nuevo;
}
/** El permiso efectivo de cada acción (con los de por defecto) y los campos heredados que leen /bd-test y los wrappers. */
// Almacén de credenciales: el secreto viaja por stdin/stdout del helper, nunca en argumentos ni en el entorno.
const CRED = path.join(__dirname, 'lib', 'credenciales.py');
function credencial(accion, cuenta, secreto) {
  const py = process.platform === 'win32' ? 'python' : 'python3';
  const r = require('child_process').spawnSync(py, ['-I', CRED, accion, cuenta], { input: secreto || '', encoding: 'utf8', windowsHide: true, timeout: 15000 });
  if (r.error) return { ok: false, mensaje: 'no se encontró Python para el almacén de credenciales' };
  if (r.status === 4) return { ok: false, noExiste: true, mensaje: 'no hay contraseña guardada en el almacén' };
  if (r.status !== 0) return { ok: false, mensaje: 'el almacén de credenciales no respondió' };
  return { ok: true, valor: r.stdout };
}
const enAlmacen = (d) => d && d.password_en === 'almacen';
function bdPermisos(d) {
  return BDP.permisos(d);   // leer con su modo (o el heredado de /bd-test); escritura sin modo = bloqueado
}
function bdCompatibles(p) {
  // /bd-test solo entiende automatico|supervisado: la escritura es automática solo si las cinco lo son.
  const escAuto = BDP.ESCRITURA.every((a) => p[a] === 'automatico');
  return { modo_lectura: p.leer === 'automatico' ? 'automatico' : 'supervisado', modo_escritura: escAuto ? 'automatico' : 'supervisado' };
}
function bdListar() {
  const reg = bdRegistro();
  const conexiones = reg.conexiones.map((c) => {
    const a = bdPermitidaYLeida(c);
    const d = (a && a.datos) || {};
    let actualizado = null;
    try { actualizado = fs.statSync(c.archivo).mtime.toISOString(); } catch (_) { /* sin archivo */ }
    return { id: c.id, nombre: c.nombre || c.id, motor: c.motor || 'sqlserver', etiquetas: c.etiquetas || [],
      archivo: c.archivo, existe: !!(a && a.datos), error: a ? a.error || null : 'archivo fuera de las carpetas de conexiones',
      servidor: d.servidor || '', usuario: d.usuario || '', catalogos: Array.isArray(d.catalogos) ? d.catalogos : [],
      password_guardada: enAlmacen(d) || (typeof d.password === 'string' && d.password.length > 0),
      password_en_claro: typeof d.password === 'string' && d.password.length > 0, actualizado, permisos: bdPermisos(d) };
  });
  return { conexiones, acciones: BD_ACCIONES, modos: BD_MODOS, motores: BD_MOTORES,
    etiquetas_estandar: BD_ETIQUETAS, etiquetas_propias: reg.etiquetas_propias, registro: BD_REGISTRO };
}
function bdPermitidaYLeida(c) {
  if (!c || !bdRutaPermitida(c.archivo)) return null;
  return bdLeerArchivo(c.archivo) || { datos: null, error: 'no existe el archivo' };
}
function bdGuardar(b) {
  const reg = bdRegistro();
  const nuevo = !b.id || !reg.conexiones.some((c) => c.id === b.id);
  const nombre = String(b.nombre || '').trim();
  if (!nombre || nombre.length > 60) return { ok: false, mensaje: 'el nombre es obligatorio (máx. 60)' };
  const motor = b.motor || 'sqlserver';
  if (!BD_MOTORES.includes(motor)) return { ok: false, mensaje: `motor desconocido: ${motor}` };
  for (const k of ['servidor', 'usuario']) if (b[k] !== undefined && (typeof b[k] !== 'string' || b[k].length > 200)) return { ok: false, mensaje: `${k} inválido` };
  if (b.catalogos !== undefined && (!Array.isArray(b.catalogos) || b.catalogos.length > 50 || !b.catalogos.every((x) => typeof x === 'string' && x.length && x.length <= 128))) return { ok: false, mensaje: 'catalogos debe ser una lista de nombres' };
  const etiquetas = b.etiquetas === undefined ? null : b.etiquetas;
  const validasEtq = new Set([...BD_ETIQUETAS, ...reg.etiquetas_propias]);
  if (etiquetas && (!Array.isArray(etiquetas) || !etiquetas.every((e) => validasEtq.has(e)))) return { ok: false, mensaje: 'etiqueta desconocida: créala primero' };
  if (b.permisos !== undefined) {
    if (!b.permisos || typeof b.permisos !== 'object' || Array.isArray(b.permisos)) return { ok: false, mensaje: 'permisos inválidos' };
    for (const [k, v] of Object.entries(b.permisos)) {
      if (!BD_ACCIONES.some((a) => a.id === k)) return { ok: false, mensaje: `acción desconocida: ${k}` };
      if (!BD_MODOS.includes(v)) return { ok: false, mensaje: `modo desconocido para ${k}: ${v}` };
    }
  }
  if (b.password !== undefined && (typeof b.password !== 'string' || b.password.length > 500)) return { ok: false, mensaje: 'contraseña inválida' };

  let ent;
  if (nuevo) {
    let id = b.id || nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'conexion';
    if (!slug(id)) return { ok: false, mensaje: 'id inválido' };
    while (reg.conexiones.some((c) => c.id === id)) id = (id + '-2').slice(0, 40);
    ent = { id, nombre, archivo: path.join(BD_HOME, 'conexiones', `${id}.json`), motor, etiquetas: etiquetas || [] };
    reg.conexiones.push(ent);
  } else {
    ent = reg.conexiones.find((c) => c.id === b.id);
    if (!bdRutaPermitida(ent.archivo)) return { ok: false, mensaje: 'el archivo de esta conexión está fuera de las carpetas permitidas' };
    Object.assign(ent, { nombre, motor }, etiquetas ? { etiquetas } : {});
  }
  const a = (fs.existsSync(ent.archivo) ? bdLeerArchivo(ent.archivo) : null) || { datos: {}, bom: false, eol: '\n' };
  if (!a.datos) return { ok: false, mensaje: 'el archivo de la conexión no es JSON válido: no lo toco' };
  const d = a.datos;                                                   // campos desconocidos intactos
  if (b.servidor !== undefined) d.servidor = b.servidor;
  if (b.usuario !== undefined) d.usuario = b.usuario;
  if (b.catalogos !== undefined) d.catalogos = b.catalogos;
  // Contraseña nueva, o una vieja en claro: va al almacén y sale del archivo. Vacía = conservar la que hay.
  const nuevaClave = typeof b.password === 'string' && b.password.length ? b.password : (typeof d.password === 'string' && d.password.length ? d.password : null);
  if (nuevaClave !== null) {
    const g = credencial('guardar', ent.id, nuevaClave);
    if (!g.ok) return { ok: false, mensaje: `no se guardó: ${g.mensaje}` };
    delete d.password;
    d.password_en = 'almacen';
  }
  const p = Object.assign(bdPermisos(d), b.permisos || {});
  d.permisos = p;
  Object.assign(d, bdCompatibles(p));
  bdEscribir(ent.archivo, d, a);
  bdEscribir(BD_REGISTRO, reg, bdLeerArchivo(BD_REGISTRO) || undefined);
  return { ok: true, mensaje: nuevo ? 'conexión creada' : 'guardado', id: ent.id };
}
function bdQuitar(b) {
  const reg = bdRegistro();
  const i = reg.conexiones.findIndex((c) => c.id === b.id);
  if (i < 0) return { ok: false, mensaje: 'no existe esa conexión' };
  const c = reg.conexiones[i];
  const pap = path.join(BD_HOME, '_papelera-conexiones');
  fs.mkdirSync(pap, { recursive: true });
  const sello = new Date().toISOString().replace(/[:.]/g, '-');
  if (bdRutaPermitida(c.archivo) && fs.existsSync(c.archivo)) {
    fs.copyFileSync(c.archivo, path.join(pap, `${c.id}-${sello}.json`));
    // Solo las creadas por la consola se borran; las descubiertas (de otras herramientas) se quedan donde están.
    if (path.dirname(path.resolve(c.archivo)) === path.join(BD_HOME, 'conexiones')) {
      fs.unlinkSync(c.archivo);
      credencial('borrar', c.id);   // la conexión desaparece del todo; las descubiertas conservan la suya
    }
  }
  fs.writeFileSync(path.join(pap, `${c.id}-${sello}.registro.json`), JSON.stringify(c, null, 2), 'utf8');
  reg.conexiones.splice(i, 1);
  bdEscribir(BD_REGISTRO, reg, bdLeerArchivo(BD_REGISTRO) || undefined);
  return { ok: true, mensaje: 'quitada del registro (respaldo en la papelera de conexiones)' };
}
function bdRevelar(b) {
  const c = bdRegistro().conexiones.find((x) => x.id === b.id);
  const a = bdPermitidaYLeida(c);
  if (!a || !a.datos) return { ok: false, mensaje: 'no se puede leer esa conexión' };
  if (enAlmacen(a.datos)) {
    const r = credencial('leer', c.id);
    if (!r.ok) return r.noExiste ? { ok: true, password: '' } : { ok: false, mensaje: r.mensaje };
    return { ok: true, password: r.valor };
  }
  return { ok: true, password: typeof a.datos.password === 'string' ? a.datos.password : '' };
}
function bdEtiqueta(b) {
  const e = String(b.etiqueta || '').trim().toLowerCase();
  if (!etiquetaValida(e)) return { ok: false, mensaje: 'etiqueta inválida (minúsculas, números, espacio, - o _; máx. 30)' };
  const reg = bdRegistro();
  if (!BD_ETIQUETAS.includes(e) && !reg.etiquetas_propias.includes(e)) {
    if (reg.etiquetas_propias.length >= 50) return { ok: false, mensaje: 'demasiadas etiquetas propias' };
    reg.etiquetas_propias.push(e);
    bdEscribir(BD_REGISTRO, reg, bdLeerArchivo(BD_REGISTRO) || undefined);
  }
  return { ok: true, etiqueta: e, etiquetas_propias: reg.etiquetas_propias };
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
  'agente-guardar': (b) => guardarAgente(b),
  'agente-borrar': (b) => borrarAgente(b),
  'agente-conocimiento': (b) => guardarConocimiento(b),
  'agente-conocimiento-borrar': (b) => borrarConocimiento(b),
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

/**
 * La app ES la consola (decisión del usuario, 23/11: nada de «app dentro de app»). Al servir consola.html se
 * le inyecta el token y consola-app.js JUSTO DESPUÉS de sus datos y ANTES de su script: así sus pestañas
 * nuevas (Mandos, Config) ya existen cuando la consola engancha las suyas. La plantilla no se toca.
 */
function consolaConApp(html) {
  const inyeccion = `<script>window.OS_TOKEN=${JSON.stringify(TOKEN)};window.OS_VERSION=${JSON.stringify(VERSION)};</script>`
    + '<script src="/plantillas/identidad-agente.js" charset="utf-8"></script>'
    + '<script src="/plantillas/consola-app.js" charset="utf-8"></script>';
  const ancla = /(<script src="_datos\/datos\.js"[^>]*><\/script>)/;
  return ancla.test(html) ? html.replace(ancla, `$1\n${inyeccion}`) : html.replace(/<\/body>/i, `${inyeccion}</body>`);
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
    if (ruta === '/salud') return json(200, { ok: true, version: VERSION, huella: HUELLA, pid: process.pid, desde: INICIO });
    if (ruta === '/' || ruta === '/app') return enviar(302, 'text/plain', 'a la consola', { Location: '/estado/consola.html' + (url.search || '') });
    if (ruta === '/estado/consola.html' && STATE) {
      const r = estatico(STATE, '/consola.html');
      if (r.codigo !== 200) return enviar(404, 'text/plain; charset=utf-8', 'la consola no se ha construido: corre /consola o build-consola.js');
      return enviar(200, MIME['.html'], consolaConApp(r.cuerpo.toString('utf8')));
    }
    if (ruta === '/api/estado') {
      try { return json(200, estado()); } catch (e) { return json(500, { error: String(e && e.message) }); }
    }
    if (ruta === '/api/config/memoria') {
      const n = url.searchParams.get('agente') || '', r = url.searchParams.get('ruta');
      if (r) { const t = leerMemoria(n, r); return t === null ? json(404, { error: 'no existe' }) : json(200, { ruta: r, contenido: t }); }
      const m = memoriaDe(n); return json(m.error ? 400 : 200, m);
    }
    if (ruta === '/api/config/actividad') {
      try { return json(200, actividad()); } catch (e) { return json(500, { error: String(e && e.message) }); }
    }
    if (ruta === '/api/config/agentes') {
      try { return json(200, listarAgentes()); } catch (e) { return json(500, { error: String(e && e.message) }); }
    }
    if (ruta === '/api/config/bd') {
      try { return json(200, bdListar()); } catch (e) { return json(500, { error: String(e && e.message) }); }
    }
    if (ruta === '/api/config/skills') {
      try { return json(200, listarSkills()); } catch (e) { return json(500, { error: String(e && e.message) }); }
    }
    if (ruta === '/api/config/paso-produccion') {
      try { return json(200, pasoProduccion()); } catch (e) { return json(500, { error: String(e && e.message) }); }
    }
    if (ruta === '/api/config/terminal') {
      terminalEstado().then((d) => json(200, d), (e) => json(500, { error: String(e && e.message) }));
      return;
    }
    if (ruta === '/api/config/terminal/imagen') {
      terminalImagen(String(url.searchParams.get('marca') || ''), String(url.searchParams.get('tipo') || ''))
        .then((b) => (b ? enviar(200, 'image/png', b) : enviar(404, 'text/plain', 'sin imagen')), () => enviar(500, 'text/plain', 'error'));
      return;
    }
    if (ruta === '/api/indicadores') {
      indicadores().then((d) => json(200, d), (e) => json(500, { error: String(e && e.message) }));
      return;
    }
    if (ruta.startsWith('/estado/') && STATE) {
      const r = estatico(STATE, ruta.slice('/estado'.length));
      return r.codigo === 200 ? enviar(200, r.tipo, r.cuerpo) : enviar(r.codigo, 'text/plain', String(r.codigo));
    }
    // La oficina 3D (en la carpeta de estado) importa three.js por rutas absolutas /_vendor/...
    if (ruta.startsWith('/_vendor/') && STATE) {
      const r = estatico(STATE, ruta);
      return r.codigo === 200 ? enviar(200, r.tipo, r.cuerpo, { 'Cache-Control': 'max-age=86400' }) : enviar(r.codigo, 'text/plain', String(r.codigo));
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
  // 20 KB por petición; solo guardar una marca de la terminal puede traer sus dos PNG en base64.
  const limite = ruta === '/api/config/terminal/marca' ? 6 * 1024 * 1024 : 20000;
  req.on('data', (d) => { crudo += d; if (crudo.length > limite) req.destroy(); });
  req.on('end', async () => {
    let cuerpo = {};
    try { cuerpo = crudo ? JSON.parse(crudo) : {}; } catch (_) { return json(400, { ok: false, mensaje: 'JSON inválido' }); }

    if (ruta === '/api/log') {
      try { fs.mkdirSync(path.join(STATE, '_runtime'), { recursive: true }); fs.appendFileSync(path.join(STATE, '_runtime', 'app-errores.log'), `${new Date().toISOString()} ${crudo.slice(0, 2000)}\n`); } catch (_) { /* nunca tumbar el servidor por un log */ }
      return enviar(204, 'text/plain', '');
    }
    const mBd = ruta.match(/^\/api\/config\/bd\/(guardar|quitar|revelar|etiqueta)$/);
    if (mBd) {
      // Nada de esto pasa por /api/log ni se escribe en ningún registro: el cuerpo puede traer una contraseña.
      const f = { guardar: bdGuardar, quitar: bdQuitar, revelar: bdRevelar, etiqueta: bdEtiqueta }[mBd[1]];
      try { const r = f(cuerpo || {}); return json(r.ok ? 200 : 400, r); }
      catch (e) { return json(500, { ok: false, mensaje: 'no se pudo completar (' + String(e && e.code || 'error') + ')' }); }
    }
    if (ruta === '/api/config/terminal/marca') {
      try { const r = await terminalMarca(cuerpo || {}); return json(r.ok ? 200 : 400, r); }
      catch (e) { return json(500, { ok: false, mensaje: String(e && e.message).slice(0, 300) }); }
    }
    if (ruta === '/api/config/terminal') {
      try { const r = await terminalGuardar(cuerpo || {}); return json(r.ok ? 200 : 400, r); }
      catch (e) { return json(500, { ok: false, mensaje: String(e && e.message).slice(0, 300) }); }
    }
    if (ruta === '/api/config/paso-produccion') {
      try { const r = guardarPasoProduccion(cuerpo); return json(r.ok ? 200 : 400, r); }
      catch (e) { return json(500, { ok: false, mensaje: String(e && e.message).slice(0, 300) }); }
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

process.on('uncaughtException', (e) => { anotarLog(`ERROR sin atrapar: ${e && e.stack || e}`); process.exit(1); });

servidor.on('error', (e) => {
  anotarLog(e.code === 'EADDRINUSE' ? `puerto ${PUERTO} ocupado por otro programa` : `ERROR al escuchar: ${e.message}`);
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
  anotarLog(`arrancado ${VERSION} en ${url} desde ${__filename}`);
  console.log(`Personal OS ${VERSION} en ${url} · solo 127.0.0.1 · estado: ${STATE || '(sin configurar)'}`);
  if (process.argv.includes('--abrir') && process.platform === 'win32') execFile('cmd', ['/c', 'start', '', url], { windowsHide: true }, () => {});
});
