# 🧭 Personal OS — Plugin para Claude Code

> Tu **jefe de gabinete** dentro de la terminal. Protege tu ejecución —compromisos, riesgos,
> prioridades y horas— cruzando **Jira, Outlook y Teams**, y vigilando lo que prometiste **punto por punto**.

No es un chat: es una red de seguridad operativa que corre sola al abrir sesión y en cada mensaje.

```
> /plugin marketplace add Jhonatan0911/personal-os-plugin
> /plugin install personal-os@everest-personal-os
> /os-setup
> brief
```

**Versión 2.0.0** · [Novedades](CHANGELOG.md)

---

## Qué hace

| | |
|---|---|
| **Vigía de compromisos** | Cada compromiso con fecha es una nota con su fuente viva; se cruza contra Jira **punto por punto, por clave** y avisa lo que va a fallar antes del día de la entrega. |
| **Hitos en cada prompt** | Lo que vence hoy o mañana con el cliente aparece en cada mensaje y va primero en las recomendaciones del día. |
| **Búsqueda sin "no existe"** | Antes de afirmar que algo no está escrito, barre todas las fuentes. Un hook lo verifica. |
| **Brief y tablero** | Resumen ejecutivo del día reconciliado con tus fuentes, y su vista HTML local. |
| **Estado en notas-objeto** | Una nota por riesgo, compromiso, decisión, alcance y persona, con frontmatter YAML. |
| **Bitácora y timesheet** | Cada prompt queda registrado con su hora; cada tramo laboral, en una línea `TS` colgada de una issue. |
| **Equipo y planeación** | Quién sabe de qué y quién está libre, status de la célula con Gantt y planeación de sprint con revisor adversarial. |
| **Memoria por proyecto** | `checkpoint` y `retomar` con `HANDOFF.md`, también en raíces con varios frentes a la vez. |
| **Dial de exigencia** | De `fácil` a `cuartel`: cada nivel cambia números verificables del vigía y el tono. |

---

## Por qué importa

Un alcance de 10 puntos se descubrió roto **el día de la entrega**: cuatro puntos sin responsable,
uno sin ticket, cinco "hechos" que en Jira seguían sin empezar. Todas las señales estaban escritas,
sueltas. Nadie hizo la pregunta *«¿qué prometimos y dónde está cada punto?»*. El vigía la hace solo,
todos los días hábiles:

```text
## ⚠️ VIGÍA DE COMPROMISOS — 2026-12-04

Alcances vigilados: 1 activos de 1. Críticos: 2 · Alertas: 1. Exigencia: estricto.

### 🔴 CRÍTICO — esto incumple una promesa con fecha
- A-001 · Cliente A · Ajustes del módulo de reportes — hasta 2 de 10 puntos SIN DUEÑO REAL
  sin issue: 1 · sin responsable: 2 · sin fecha: 2
  → Cada punto necesita issue, responsable y fecha.
- A-001 · Cliente A · Ajustes del módulo de reportes — HITO CON EL CLIENTE HOY: publicar en pruebas los puntos 1-4

### 🟡 Alerta
- A-001 · Cliente A — 1 punto esperando un insumo de un tercero
  → Decir desde cuándo se pidió y a quién, y perseguirlo hoy.
```

Reglas que aplica: punto sin issue, responsable o fecha = **riesgo nivel 3 desde el día uno** · el
`status` de Jira es la evidencia, no el comentario · los estados que parecen cerrados sin estarlo
(«Redefinido») se listan aparte · un bloqueo de un tercero que nadie persigue es un incumplimiento propio.

| Tu tendencia | Personal OS |
|---|---|
| Llevas la mañana puliendo un detalle que ya cumple. | *«Eso ya cumple. Tu #1 vence en 6 días y hoy no avanzó — el costo de seguir puliendo es real.»* |
| Le prometes una fecha al cliente sobre la marcha. | *«Estimaste para 2 personas y vas con 1. Valida el esfuerzo antes de aceptar — y avisa hoy.»* |
| Dices «eso no está escrito en ningún lado». | *«Lo busqué en estado, documentos, skills y memoria: está en el acta del 02/12.»* |
| Arrancas a trabajar sin issue. | *«Sin issue no se arranca: te dejo el borrador de PROY-150 para que lo confirmes.»* |

---

## Un brief de verdad *(datos ficticios)*

```text
> brief

⚠️ VIGÍA — A-001 · Cliente A: 2 puntos sin dueño · hito HOY (publicar puntos 1-4)

⬤ PRIORIDAD #1
  PROY-142 · Portal de pagos — vence en 5 días hábiles
  estimado para 2 devs, ejecutando con 1 · riesgo R-003

⚠ RIESGOS ABIERTOS (2)
  nivel 3  A-001     punto 2 sin issue      → crear la issue hoy y asignarla
  nivel 2  PROY-88   dependencia externa sin confirmar desde el 25/11

📨 COMPROMISOS (1)
  C-004 · estimación del módulo de pagos para Cliente B — vence mañana

Mi recomendación para hoy:
  1. publicar en pruebas los puntos 1-4 de A-001 (hito con el cliente)
  2. crear y asignar la issue del punto 2 de A-001
  3. avisar hoy el riesgo de fecha de PROY-142
```

---

## Instalar y arrancar

1. **Registra el marketplace:**
   ```
   /plugin marketplace add Jhonatan0911/personal-os-plugin
   ```
2. **Instala el plugin** (formato `plugin@marketplace`):
   ```
   /plugin install personal-os@everest-personal-os
   ```
   Reinicia Claude Code para que carguen los hooks.
3. **Configura tu instancia** — siembra tu carpeta de estado **privada y vacía**, tu zona horaria,
   los festivos de tu país y la plantilla de integraciones:
   ```
   /os-setup
   ```
4. **Completa tu configuración:** los `<placeholders>` de `estado/config/fuentes.yaml` (cloudId,
   accountId, proyectos de Jira, equipo) y, si usarás el timesheet, tus categorías, clientes y jornada
   en `~/.claude/personal-os/config.json`.
5. **Conecta tus fuentes** — los MCP de **Atlassian** (Jira) y **Microsoft 365** (Outlook/Teams).
   > Sin ellos el OS funciona (vigía, bitácora, notas, búsqueda), pero el brief no puede leer Jira, Outlook ni Teams.
6. **Arranca el día:** `brief`

Requisitos: Claude Code y Node.js en el `PATH` (los hooks llaman a `node`). Python solo para el
timesheet, la planeación de sprint y los recordatorios de Windows.

---

## Comandos

| Comando | Qué hace |
|---|---|
| `brief` · `/brief` | Brief operativo del día (abre con el vigía) |
| `/vigia` | Corre el vigía y cruza los alcances punto por punto |
| `/buscar <término>` | Busca en todas las fuentes antes de afirmar una ausencia |
| `/tablero` | Regenera el tablero visual HTML del día |
| `/consola` | Regenera la consola neuronal (vista HTML local del estado) |
| `/quien` | Quién sabe de qué, quién está libre, qué hacía cada quien |
| `/status-celula` | Tablero del equipo con cronograma de ocupación (Gantt) |
| `/timesheet` | Arma el timesheet desde las líneas `TS` y lo exporta; con un perfil de organización, en el libro semanal de la plantilla corporativa y con horas extra por corte (nunca lo envía) |
| `/exigencia` | Ve o cambia el dial: fácil · normal · estricto · cuartel |
| `/os-setup` | Configuración inicial (idempotente: nunca pisa nada) |
| `/os-on` · `/os-off` | Reactiva / pausa el OS en todas tus sesiones (pausa con doble confirmación) |

Skills que se activan por lo que pides: `brief-diario`, `planear-sprint` («planeemos el sprint de…»),
`checkpoint` / `retomar` («guarda el avance», «en qué quedamos»), `personas`, `status-celula`,
`timesheet`, `consola-neuronal`, `tablero-diario`, `cerrar-tarea`, `reconciliar`.
Agentes: `brief-jira`, `brief-outlook`, `brief-teams` (solo lectura), `redactor-correos` (redacta,
nunca envía) y `revisor-estimacion` (revisor adversarial de los planes de sprint).

---

## Cómo funciona

| Hook | Script | Qué hace |
|---|---|---|
| `SessionStart` | `session-init.js` | Inyecta el preámbulo, la ruta de tu estado y el nivel de exigencia (si el OS está activo). |
| `SessionStart` | `alcances-scan.js` | Deja el bloque `⚠️ VIGÍA DE COMPROMISOS`. |
| `UserPromptSubmit` | `prompt-logger.js` | Registra tu prompt con su hora en `bitacora/AAAA-MM-DD.md`. |
| `UserPromptSubmit` | `alcances-scan.js --hitos` | Recuerda los hitos de hoy, mañana o vencidos (no imprime nada si no hay). |
| `Stop` | `verificar-ausencia.js` | Bloquea una vez la respuesta que afirma «no está escrito» sin haber corrido `os-buscar.js`. |

Una línea `TS` por tramo laboral, validada al escribir contra tu configuración:
```text
- **TS:** 08:00-09:30 | PROY-142 | Desarrollo | Cliente A | est=2h | Ajuste del filtro de reportes | commit abc123
```
Sin issue no se arranca; `SIN-ISSUE` solo vale donde tú lo permitas; jamás se rellenan horas.

---

## Actualizar

```
/plugin marketplace update
/plugin install personal-os@everest-personal-os
```
Reinicia la sesión. Si vienes de la 1.x, corre `/os-setup` otra vez: completa tu configuración y
siembra las carpetas nuevas sin tocar lo que ya tienes. Detalle en el [CHANGELOG](CHANGELOG.md).

---

## 🔒 Tu estado es tuyo

El plugin **solo reparte comportamiento** (núcleo, skills, comandos, hooks, plantillas vacías). Tu
carpeta de estado y `~/.claude/personal-os/` son **privadas y locales**: nunca viajan con el plugin.
El `.gitignore` que siembra `/os-setup` deja fuera personas, bitácora, datos generados y vistas HTML.
Leer Jira/Outlook/Teams es libre; **toda escritura o envío se confirma antes**.

## Estructura del repo

```
personal-os-plugin/
├── .claude-plugin/marketplace.json   ← marketplace: everest-personal-os
├── index.html                        ← landing (GitHub Pages)
├── CHANGELOG.md
└── plugins/personal-os/
    ├── .claude-plugin/plugin.json
    ├── hooks/hooks.json              ← SessionStart · UserPromptSubmit · Stop
    ├── scripts/                      ← session-init, alcances-scan, prompt-logger, bitacora-*,
    │                                   os-buscar, verificar-ausencia, exigencia, os-setup,
    │                                   personas-*, build-consola, status-celula, handoff, reminders/
    ├── commands/                     ← /os-setup /os-on /os-off /brief /tablero /vigia /buscar
    │                                   /exigencia /consola /quien /status-celula /timesheet
    ├── skills/                       ← brief-diario, planear-sprint, timesheet, checkpoint, retomar…
    ├── agents/                       ← brief-jira, brief-outlook, brief-teams, redactor-correos,
    │                                   revisor-estimacion
    ├── plantillas/                   ← estado vacío, config.json, consola
    └── CORE.md / preamble.md         ← comportamiento
```

Licencia MIT · Autor: Jhonatan Piña
