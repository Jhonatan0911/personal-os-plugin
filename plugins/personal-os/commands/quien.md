---
description: Quién sabe de qué, quién está libre y qué hacía cada quien (Personal OS · personas)
argument-hint: "[tema | libre | equipo para X | qué hacía X el <día> | persona]"
---

Sigue la skill `personas` del plugin, sección B (RESPONDER).

Usa `node "<raíz del plugin>/scripts/personas-query.js" <comando>`; la raíz del plugin aparece en
el contexto de la sesión, en la línea **"Scripts del plugin:"**. Con el argumento del usuario
(`$ARGUMENTS`), elige el comando:

- una frase sobre un tema ("la facturación", "algo de la pasarela de pagos") → `quien "<frase>"`
- "quién está libre / disponible / con menos carga" → `libre`
- "armemos un equipo para X" / "a quién pongo en X" → `equipo "<frase>"`
- "qué hacía X el lunes / el <fecha>" → `dia <persona> <AAAA-MM-DD>` (convierte primero el día
  relativo en fecha absoluta)
- "cuéntame de X" / "cómo va X" → `persona <nombre>`
- "quién es indispensable / qué pasa si sale X" → `bus`
- sin argumento → `scan` y reporta lo que hay que atender

Entrega la respuesta **con la evidencia al lado**, nombra las contradicciones entre lo declarado y
lo derivado en vez de elegir una, y di "nadie" cuando nadie cubra el frente. La asignación la
decide el usuario: el módulo recomienda.

Si el usuario, en vez de preguntar, **afirma algo sobre una persona**, cambia a la sección A de la
skill y regístralo con `personas-append.js`.
