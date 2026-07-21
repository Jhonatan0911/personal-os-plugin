#!/usr/bin/env node
/*
 * Personal OS — hook SessionStart (versión plugin, cross-platform).
 * El CONTENIDO (preamble/CORE) viaja con el plugin (CLAUDE_PLUGIN_ROOT).
 * El ESTADO del usuario (bandera + config) vive en ~/.claude/personal-os/, ruta estable
 * conocida también por los comandos /os-on /os-off /os-setup, así el toggle no depende de
 * variables de entorno dentro de los comandos.
 * Regla de oro: si algo falla, no romper el arranque de sesión (salir con 0, sin ruido).
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const root = process.env.CLAUDE_PLUGIN_ROOT || __dirname;
const home = path.join(os.homedir(), '.claude', 'personal-os');

function readFlag() {
  try { return fs.readFileSync(path.join(home, 'state.flag'), 'utf8').trim().toLowerCase(); }
  catch (e) { return 'active'; } // instalación nueva → activo por defecto
}

try {
  if (readFlag() !== 'active') process.exit(0);
  let out = fs.readFileSync(path.join(root, 'preamble.md'), 'utf8');
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(home, 'config.json'), 'utf8'));
    if (cfg && cfg.stateDir) {
      out += `\n\n**Ruta del estado (fuente de verdad):** \`${cfg.stateDir}\`\n`
           + `Cuando el usuario abra trabajo operativo o pida "brief", lee ahí tablero.md / riesgos.md / compromisos.md antes de responder.`;
    } else {
      out += `\n\n⚠️ Aún no hay carpeta de estado configurada. Sugiere al usuario correr **/os-setup**.`;
    }
  } catch (e) {
    out += `\n\n⚠️ Primera vez: sugiere al usuario correr **/os-setup** para configurar su carpeta de estado.`;
  }
  process.stdout.write(out);
} catch (e) { /* nunca romper el arranque */ }
process.exit(0);
