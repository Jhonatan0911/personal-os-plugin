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
               + 'que se abrió.'
             : amb === 'laboral'
               ? 'Sesión laboral: aplican las reglas de la empresa y los vigías completos.'
               : 'Sesión central (mezcla de ámbitos): vigías completos; al hablar de un tema, aplica la frontera '
                 + 'laboral/personal del núcleo.');
    }
  } catch (e) { /* sin ámbito: comportamiento de siempre */ }

  // Lecciones que el sueño semanal propuso para la corteza y esperan la aprobación del usuario.
  try {
    const dirCo = (cfg.conocimiento || {}).dir;
    const prop = dirCo ? path.join(dirCo, '_propuestas') : null;
    const n = prop && fs.existsSync(prop) ? fs.readdirSync(prop).filter((f) => /^CO-\d+.*\.md$/i.test(f)).length : 0;
    if (n) {
      const val = C.leerTexto(path.join(prop, '_validacion.txt'), '') || '';
      out += `\n\n🧠 **Corteza: ${n} lección(es) propuesta(s) por el sueño semanal** esperan aprobación en \`${prop.replace(/\\/g, '/')}\``
           + (val.startsWith('FALLA') ? ' (⚠️ alguna no pasó la validación: corregirla antes de presentarla)' : '')
           + '. Mencionarlo en una línea al final de la primera respuesta; se revisan cuando el usuario diga «revisemos las propuestas» (CORE §7-quater).';
    }
  } catch (e) { /* sin propuestas: nada */ }

  // Testigo del servidor de la consola (D-065, CO-070): si el usuario lo declaró activo y no corre, se dice.
  try {
    if ((cfg.servidor || {}).activo === true) {
      let vivo = false;
      const marca = C.leerJson(path.join(C.OS_HOME, '_servidor.json'), null);
      if (marca && marca.pid) { try { process.kill(marca.pid, 0); vivo = true; } catch (_) { vivo = false; } }
      if (!vivo) {
        out += `\n\n⚠️ **El servidor de la consola no está corriendo** (declarado activo en config.json → servidor). `
             + `Comprobar con \`node "${C.SCRIPTS_DIR.replace(/\\/g, '/')}/os-servidor.js" --salud\` y avisarlo en la primera línea.`;
      }
    }
  } catch (e) { /* sin servidor declarado: nada */ }

  // Núcleo de reglas de la organización (reglas-organizacion/build.py con salida.nucleo apuntando a
  // <os-home>/nucleo-empresa.md): solo en sesiones de la empresa. El hook guardia sigue en todas.
  try {
    const nucleo = C.leerTexto(path.join(C.OS_HOME, 'nucleo-empresa.md'), null);
    if (nucleo && !C.sesionPersonal()) out += `\n\n${nucleo.replace(/^<!--[\s\S]*?-->\s*/, '').trim()}\n`;
  } catch (e) { /* sin núcleo: nada */ }

  process.stdout.write(out);
} catch (e) { /* nunca romper el arranque */ }
process.exit(0);
