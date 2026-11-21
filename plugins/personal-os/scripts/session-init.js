#!/usr/bin/env node
/*
 * Personal OS — hook SessionStart (versión plugin, multiplataforma). Sucesor de loader.js: en una
 * instalación suelta (~/.claude/personal-os/) lee preamble.md y CORE.md de esa misma carpeta.
 *
 * Inyecta como contexto de la sesión:
 *   · el preámbulo (persona + protocolo) que viaja con el plugin;
 *   · la ruta del estado del usuario (fuente de verdad) y la raíz de los scripts del plugin;
 *   · el nivel de exigencia vigente (el dial) con su tono.
 * Si la bandera dice `paused`, no inyecta nada. Sin bandera (instalación nueva) = activo.
 * Regla de oro: si algo falla, no romper el arranque de la sesión (salir con 0, sin ruido).
 */
'use strict';
const fs = require('fs');
const path = require('path');

try {
  const C = require('./lib/comun.js');
  if (!C.activo()) process.exit(0);

  let out = C.leerTexto(path.join(C.PLUGIN_ROOT, 'preamble.md'), null);
  if (out === null) process.exit(0);   // sin preámbulo no hay nada que inyectar
  const raiz = C.PLUGIN_ROOT.replace(/\\/g, '/');
  const scripts = C.SCRIPTS_DIR.replace(/\\/g, '/');
  out += `\n\n**Scripts del Personal OS:** \`${scripts}\` — se invocan como \`node "${scripts}/<script>.js"\`. `
       + `Núcleo completo: \`${raiz}/CORE.md\`.`;

  const cfg = C.config();
  const estado = C.stateDir();
  if (estado && fs.existsSync(estado)) {
    out += `\n\n**Ruta del estado (fuente de verdad):** \`${estado.replace(/\\/g, '/')}\`\n`
         + 'Cuando el usuario abra trabajo operativo o pida "brief", lee ahí `tablero.md` y las notas de '
         + '`riesgos/`, `compromisos/` y `alcances/` antes de responder.';
    if (cfg.owner && cfg.owner !== 'Tu Nombre') out += `\nUsuario: **${cfg.owner}**.`;
    if (cfg.zonaHoraria) out += ` Zona horaria: \`${cfg.zonaHoraria}\`.`;
  } else if (estado) {
    out += `\n\n⚠️ La carpeta de estado configurada (\`${estado}\`) no existe. Sugiere al usuario correr **/os-setup**.`;
  } else {
    out += '\n\n⚠️ Primera vez: aún no hay carpeta de estado. Sugiere al usuario correr **/os-setup**.';
  }

  // Dial de exigencia: se inyecta SIEMPRE. Si el usuario lo bajó a `fácil`, insistir igual sería
  // ignorar su decisión; si lo subió a `cuartel`, ser blando sería incumplir lo que pidió.
  try {
    const ex = require('./exigencia.js').leer();
    out += `\n\n**Nivel de exigencia: \`${ex.etiqueta}\`** (se cambia con \`/exigencia\`, con `
         + `\`exigencia.js --set <nivel>\` o editando \`exigencia.json\`).`
         + (ex.aviso ? ` ⚠️ ${ex.aviso}; se usa el nivel por defecto.` : '') + `\n${ex.tono}\n`;
    if (ex.nivel === 'cuartel') {
      out += '\n> En `cuartel` el vigía manda: sus CRÍTICOS se atienden antes que la petición que '
           + 'traiga el usuario, y posponerlos requiere que él lo diga explícitamente.\n';
    }
  } catch (e) { /* sin dial: comportamiento por defecto */ }

  // Ámbito de la sesión (config → ambitos, por la carpeta donde se abrió). En una personal, lo de la
  // empresa (correo, reglas, compromisos con clientes, timesheet, identidad corporativa) no se exige;
  // el conocimiento técnico propio (reglas de conocimiento) sí aplica igual en los dos lados.
  try {
    const amb = C.ambitoSesion();
    if (cfg.ambitos) {
      out += `\n\n**Ámbito de esta sesión: \`${amb}\`.** `
           + (C.sesionPersonal(amb)
             ? 'Sesión personal: no se exige nada de la empresa (barrido de correo, reglas de la organización, '
               + 'compromisos con clientes, línea de timesheet, identidad corporativa) ni se pone antes del tema '
               + 'que se abrió. Las buenas prácticas técnicas propias (reglas de conocimiento) sí aplican.'
             : amb === 'laboral'
               ? 'Sesión laboral: aplican las reglas de la empresa y los vigías completos.'
               : 'Sesión central (mezcla de ámbitos): vigías completos; al hablar de un tema, aplica la frontera '
                 + 'laboral/personal del núcleo.');
    }
  } catch (e) { /* sin ámbito: comportamiento de siempre */ }

  process.stdout.write(out);
} catch (e) { /* nunca romper el arranque */ }
process.exit(0);
