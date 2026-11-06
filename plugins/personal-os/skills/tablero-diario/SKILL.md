---
name: tablero-diario
description: Regenera el tablero visual HTML del día (estado/tablero.html) desde el estado reconciliado del Personal OS. Úsala al cerrar el brief o cuando el usuario pida "/tablero" o "muéstrame el tablero".
---

# Skill: tablero-diario

Genera o regenera el tablero visual del día en `<stateDir>/tablero.html`: una vista de lectura rápida
sobre el estado reconciliado. Es una VISTA, no la fuente de verdad (esa sigue siendo `<stateDir>`).

## Cuándo se ejecuta
- Al final del `brief-diario` (último paso): se regenera junto con `tablero.md`.
- A demanda con el comando `/tablero`.
- No se dispara solo sin sesión: se arma al abrir el día o cuando lo pidas.

## Arquitectura del archivo
- **Un solo `.html` autónomo** en `<stateDir>/tablero.html`. Sin CDNs ni dependencias; se abre con doble clic.
- **Guiado por datos:** todo el contenido vive en arrays JS al inicio del `<script>`. Regenerar = actualizar
  esos arrays; **no toques el CSS ni las funciones de render** salvo que cambie el diseño.
- **CSS claro/oscuro** (`prefers-color-scheme`) y adaptable (grid → 1 columna en móvil).
- **Fechas dinámicas:** `daysTo(fecha)` calcula días contra el `new Date()` real, así el contador y los
  «vencido / en N d» siguen vivos aunque abras el archivo otro día. Las fechas se guardan como `AAAA-MM-DD`.
- **Local, nunca publicado:** contiene datos operativos de clientes e incidencias internas. NO uses la
  herramienta Artifact ni lo subas a ningún servicio. Solo archivo local.

## Modelo de datos (arrays del `<script>`)
Mantén estos nombres y campos; el render depende de ellos:
- `DEADLINE_1`: fecha `AAAA-MM-DD` de la entrega #1 (alimenta el contador de la cabecera).
- `ayer[]`: `{t (qué se hizo ayer), note (evidencia o detalle opcional)}`. Columna **Ayer** de la tarjeta de
  standup. Solo cosas hechas y con evidencia del día anterior.
- `hoy[]`: `{t (compromiso del día), note (opcional)}`. Columna **Hoy**: versión corta y accionable de la
  propuesta del día, pensada para leerla en la daily.
- `riesgos[]`: `{id, tk (ticket), n (nivel 3/2/1, 0 = delegado), est (etiqueta), t (título), d (descripción),
  mit (mitigación)}`. Sale de las notas abiertas de `riesgos/`. **Los puntos de un alcance sin issue, sin
  responsable o sin fecha entran aquí como nivel 3**, y los alcances con CRÍTICOS del vigía también.
- `bloqueos[]`: `{tk, t, por}` (lo pausado y su causa; los insumos de terceros, con desde cuándo y a quién).
- `vencidos[]`: `{tk, f (fecha), tag}` (se ordenan solos por urgencia; incluye hitos de alcances).
- `compromisos[]`: `{tk, t, est, note}`. Sale de las notas abiertas de `compromisos/` y de los alcances activos.
- `agenda[]`: `{h (hora en la zona del usuario), t}` (reuniones de hoy, traídas de Outlook en solo lectura).
- `timeline[]`: `{d (día), wd (día de la semana abreviado), t, p}` (actividad reciente).
- `propuesta[]`: textos (disponibilidad o plan del día).
- `semana[]`: `{b (cifra), s (etiqueta)}` (indicadores de la semana).

Los indicadores de la cabecera se calculan solos desde estos arrays (días a la #1, riesgos críticos,
vencidos, compromisos).

## Pasos para regenerar
1. Asegura el estado reconciliado: si no hubo `brief-diario` hoy, córrelo primero.
2. Lee `<stateDir>/tablero.md`, las notas abiertas de `riesgos/`, `compromisos/` y `alcances/` (con su
   último cruce: `verificado_el` y contadores) y los `proyectos/*.md` activos.
3. Trae la **agenda de hoy** de Outlook (solo lectura) y conviértela a la zona horaria del usuario
   (`owner.zona_horaria` de `config/fuentes.yaml`) para `agenda[]`.
4. Edita los arrays de `tablero.html` para que reflejen 1:1 lo que dice `tablero.md`. Deja CSS y JS intactos.
5. Verifica coherencia: cada riesgo, vencido o compromiso del `.md` debe existir en el `.html` y viceversa.
6. **Abre el tablero** para lectura inmediata: Windows `Start-Process "<stateDir>/tablero.html"`; macOS
   `open`; Linux `xdg-open`. Es un archivo local: abrir no es publicar.

## Reglas
- El `.html` NUNCA contradice al `.md`. Si difieren, gana el `.md` (que a su vez se reconcilió con las fuentes).
- No inventes datos: si una fuente no respondió, no la pintes.
- Un riesgo delegado (nivel 0) se muestra en gris, sin acción del usuario.
- Un alcance que no se cruzó hoy no se pinta «en verde»: se pinta como «sin vigilancia hoy».
- Regla de origen: «regenerar el tablero al cerrar el brief» vive en el núcleo (`CORE.md`); aquí solo el CÓMO.
