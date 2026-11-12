# Pasada por pantalla (Playwright) y capturas

Léelo al llegar al paso 7 de la fase 7 y en la fase 10 (capturas a docs). La reproducción por API valida
las operaciones de negocio pero **no** prueba el front: la pasada por pantalla es obligatoria.

## 1. Mapa de pantallas antes de escribir un script

Un agente por front lee el código (`*.component.html`/`.ts`, formularios reactivos, servicios) y escribe
`conocimiento/<repo>/PANTALLAS.md`. Por cada pantalla que usa la operación del periodo: ruta, orden de
llenado y una fila por campo con **selector** (`formcontrolname`, `id`, texto del botón), **tipo de control**
(multiselect, `select`, `p-dropdown`, timepicker, input, checkbox), si es obligatorio, **qué columna de
`golden/<flujo>.jsonl` lo llena** (o el valor fijo y por qué), de qué API se llena el combo, qué diálogos salen
(SweetAlert, modales) y qué selectores tienen **datos de persona** (van a la máscara). También cómo entra el
mismo usuario sin su clave: atajo local `localStorage REGV_LOGIN` (cambio local sin commit en el front) o
token emitido por el servicio de autenticación (`regresion.auth`). Cada fila con `archivo:línea`.

Incluye el shell (cambio de sede, perfil, consultorio, cambio de contraseña): es lo que más se olvida.

## 2. Scripts

1. Si Playwright no está, instalarlo (`pip install playwright` + `playwright install chromium`) pide OK. Sin
   Playwright la fase 7 no se da por terminada.
2. Copia `plantillas/playwright/pw_base.py` y `plantillas/playwright/plantilla_pantalla.py` a
   `<mesa>/.regresion/` y llena la plantilla con `PANTALLAS.md` + `golden/`. `pw_base` ya resuelve: proxy al
   sumidero, modo visible, login como el usuario, combos, horas, SweetAlert, capturas enmascaradas y registro.
3. Pregunta en el modal si el responsable quiere **ver el Chromium** (`REGV_VISIBLE=1`, `REGV_SLOWMO=300-500`)
   o en segundo plano. Primero un caso con `--solo 1` para ajustar; luego todos.
4. El campo de clave del login no admite pegar: se **teclea** (`tipear`), nunca `fill`.
5. Cada paso deja `{pantalla, accion, usuario, resultado, mensaje}` en `ejecucion/pantallas.jsonl`.

**Compuerta:** sin `ejecucion/pantallas.jsonl` con al menos una entrada por pantalla del inventario (o su
motivo de exclusión) no se pasa a la fase 8.

## 3. Capturas

- Se toman en cada paso (`full_page=True`) y **siempre enmascaradas**: `mask=[...]` con los localizadores de
  nombres, documentos, teléfonos, correos, direcciones e historias. Van a
  `evidencias/capturas/<repo>/<flujo>-<caso>-<paso>.png` y se anotan en `ejecucion/capturas.jsonl`
  (`{archivo, repo, pantalla, caso, paso, enmascarada: true, revisada: false}`).
- Si una pantalla no se puede enmascarar con fiabilidad, la captura queda **solo como evidencia local**
  (`enmascarada: false`) y nunca sale a docs, a la página ni a Jira.
- Fase 10: un agente revisa a ojo cada captura enmascarada (lee la imagen) y marca `revisada: true` solo si
  no se lee ningún dato de persona; si se lee alguno, la baja a evidencia local. Las revisadas se copian a la
  guía funcional de `docs/` (rama de docs, convención del repo; push y PR con OK), se enlazan en la matriz
  (hoja 01) y cuentan como evidencia «captura» en la fase 9-bis.
