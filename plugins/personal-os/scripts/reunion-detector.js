#!/usr/bin/env node
/*
 * Personal OS — hook UserPromptSubmit: toda reunión laboral cuelga de una issue.
 *
 * Se activa solo si config.json → timesheet.reunionesExigenIssueDesde tiene fecha y hoy ya llegó.
 * Si el prompt menciona una reunión ("estaba en una reunión", "tuve una llamada con…", "la daily",
 * "el comité"), inyecta en contexto el recordatorio de resolver su issue ANTES de registrar el
 * tramo. Es un hook y no una skill a propósito: una skill solo corre si el modelo decide usarla, y
 * esta regla tiene que saltar siempre que aparezca la palabra.
 *
 * No consulta el gestor de issues (un hook no tiene el MCP): solo le pone enfrente al modelo el
 * orden y, si está configurada, la consulta para encontrar la issue de reuniones del periodo:
 *   timesheet.reunionIssueRecurrente  texto (o JQL) para la issue de reuniones del periodo; {hoy} = fecha
 *   timesheet.reunionIssueNueva       dónde y cómo se crea una issue de reunión nueva
 *   timesheet.claveSinIssue           la marca "sin issue" que usa la bitácora (SIN-ISSUE por defecto)
 *
 * Regla de oro, igual que prompt-logger: pase lo que pase, nunca romper el prompt (exit 0).
 */
'use strict';

/* Palabras que delatan una reunión. Se mira solo el inicio del prompt: un texto pegado largo
 * (un acta, un correo) habla de reuniones sin que el usuario esté declarando haber estado en una. */
const RE_REUNION = /\b(reuni[oó]n(es)?|llamadas?|dailys?|comit[eé]s?|planning|refinamiento|retro(spectiva)?|capacitaci[oó]n|mesa de trabajo|sesi[oó]n con|me reun[ií]|nos reunimos|estuve con|videollamada|meet|teams con)\b/i;

try {
  const C = require('./lib/comun.js');
  if (!C.activo()) process.exit(0);
  const ts = C.config().timesheet || {};
  const desde = ts.reunionesExigenIssueDesde;
  const hoy = C.hoyISO();
  if (!desde || hoy < desde) process.exit(0);

  const data = C.leerStdin();
  const prompt = (data.prompt != null ? data.prompt : (data.user_prompt != null ? data.user_prompt : '')).toString();
  const cabeza = prompt.replace(/<pasted_content[\s\S]*?<\/pasted_content[^>]*>/gi, ' ').slice(0, 1500);
  if (!RE_REUNION.test(cabeza)) process.exit(0);

  const sinIssue = String(ts.claveSinIssue || 'SIN-ISSUE').toUpperCase();
  const recurrente = ts.reunionIssueRecurrente
    ? String(ts.reunionIssueRecurrente).split('{hoy}').join(hoy)
    : 'la issue de reuniones recurrentes del periodo';
  const nueva = ts.reunionIssueNueva ? String(ts.reunionIssueNueva) : 'una issue de reunión nueva';

  process.stdout.write(
    `📅 REUNIÓN MENCIONADA: si es laboral, toda reunión lleva su issue, sin ${sinIssue}. ` +
    'Antes de registrar el tramo, resuélvela en este orden: ' +
    '(1) la issue del proyecto que se trató; ' +
    `(2) si es ceremonia recurrente, ${recurrente}; ` +
    `(3) si es puntual, propón ${nueva} (resumen "<asunto> · dd/mm", persona asignada, ` +
    'inicio = vencimiento = el día, cliente, estimación = la duración agendada en el calendario) y créala solo con su OK. ' +
    'Si es personal o solo se está hablando de reuniones en general, ignora este aviso.\n'
  );
} catch (e) { /* nunca romper el prompt */ }
process.exit(0);
