# 🧭 Personal OS — Plugin para Claude Code

> Tu **jefe de gabinete** dentro de la terminal. Protege tu ejecución —riesgos, compromisos y
> prioridades— cruzando **Jira, Outlook y Teams** cada mañana.

No es un chat: es una red de seguridad operativa que corre sola al abrir sesión.

```
> /plugin marketplace add Jhonatan0911/personal-os-plugin
> /plugin install personal-os@everest-personal-os
> brief
```

---

## Qué hace

| | |
|---|---|
| **Brief** | Resumen ejecutivo del día, reconciliado en vivo con tus fuentes. |
| **Ledger** | Registro de riesgos, compromisos y decisiones con IDs estables. |
| **Tablero** | Vista visual del día en HTML, generada desde tu estado. |
| **Toggle** | Enciéndelo o pásalo a pausa en todas tus sesiones cuando quieras. |

---

## Por qué importa

Todos derivamos bajo presión. El OS no te juzga: nombra la señal y te devuelve al foco.

| Tu tendencia | Personal OS |
|---|---|
| Llevas la mañana puliendo un detalle que ya cumple. Se siente productivo. | *«Eso ya cumple el objetivo. Tu #1 vence en 6 días y hoy no avanzó — el costo de seguir puliendo es real.»* |
| Entra un correo con «URGENTE» y lo tomas de inmediato. | *«Esa incidencia ya tiene dueño y no es tu punto. Toca la ventana de tu entrega — quédate en lo #1.»* |
| Le prometes una fecha al cliente sobre la marcha. | *«Estimaste para 2 personas y vas con 1. Valida el esfuerzo antes de aceptar — y avisa hoy, no el día de la entrega.»* |
| Confías en que lo vas a recordar. No lo anotas. | *«Un compromiso lleva 11 días esperando. Está en el ledger, no en tu memoria — comunícalo antes de que sea problema.»* |

---

## Un brief de verdad

Esto es lo que ves al escribir `brief` por la mañana *(ejemplo con datos ficticios)*:

```text
> brief

# re-poniendo el estado — martes 12 ago · semana 9/13

⬤ PRIORIDAD #1
  PROY-142 · Portal de pagos — vence en 5 días (17/ago)
  estimado 2 devs, ejecutando con 1 · riesgo R-03

⚠ RIESGOS ABIERTOS (3)
  crítico  PROY-142  alcance ampliado sin ajustar la fecha
           → acordar mínimo de salida + reporte diario
  medio    API-88    dependencia externa sin confirmar
  bajo     DOC-12    documentación pendiente hace 2 semanas

⏰ VENCIDO / VENCE HOY
  INT-30 vencido hace 4 días · PROY-142 vence en 5 días

📨 COMPROMISOS ESPERANDO RESPUESTA (2)
  C-01 certificación del cliente — 11 días sin respuesta
  C-04 definición de alcance — bloquea la fase 3

Mi recomendación para hoy:
  1. comunica hoy el riesgo de fecha de PROY-142 (5 min, preventivo)
  2. bloque real en el #1 — nada compite con él
  3. no absorbas INT-30: ya tiene dueño
```

📄 Ese mismo brief regenera un **tablero visual en HTML** (`/tablero`): lo abres con doble clic o lo compartes. Vive local — nunca se publica.

---

## Instalar y arrancar

Cinco pasos. Los dos primeros son la instalación; el resto, tu puesta a punto.

1. **Registra el marketplace** — le dice a Claude Code *dónde* viven los plugins (no instala nada todavía):
   ```
   /plugin marketplace add Jhonatan0911/personal-os-plugin
   ```
2. **Instala el plugin** — formato `plugin@marketplace`:
   ```
   /plugin install personal-os@everest-personal-os
   ```
3. **Configura tu instancia** — crea tu carpeta de estado **privada y vacía**:
   ```
   /os-setup
   ```
4. **Conecta tus fuentes** — activa en Claude Code los MCP de **Atlassian** (Jira) y **Microsoft 365** (Outlook/Teams).
   > ⚠️ Sin estos MCP conectados el OS funciona, pero **el brief no puede leer** Jira, Outlook ni Teams.
5. **Arranca el día**:
   ```
   brief
   ```

---

## Comandos

| Comando | Qué hace |
|---|---|
| `brief` | Brief operativo del día |
| `/tablero` | Regenera el tablero visual HTML |
| `/os-setup` | Configuración inicial (una sola vez) |
| `/os-on` | Reactiva el OS en todas tus sesiones |
| `/os-off` | Pausa el OS (con doble confirmación) |

---

## Actualizar

**Como usuario** — traer la última versión cuando el autor publica una mejora:
```
/plugin marketplace update
/plugin install personal-os@everest-personal-os
```
Reinicia la sesión para cargar los cambios.

**Como autor** — publicar una mejora:
1. Edita el archivo en su carpeta (`commands/`, `skills/`…).
2. Sube el número de `version` en `plugin.json`.
3. `git commit -am "..."`
4. `git push` — y tus usuarios corren *marketplace update*.

---

## 🔒 Tu estado es tuyo

El plugin **solo reparte comportamiento** (núcleo, skills, comandos, hook de activación).
Tu carpeta `estado/` con datos reales es **privada y local** — nunca se comparte ni se sube.
Cada usuario siembra el suyo desde su propio Jira/PITS con `/os-setup`.

## Estructura del repo

```
personal-os-plugin/
├── .claude-plugin/marketplace.json   ← lista de plugins (marketplace: everest-personal-os)
└── plugins/personal-os/              ← el plugin
    ├── .claude-plugin/plugin.json
    ├── hooks/hooks.json              ← SessionStart → carga el OS si está activo
    ├── scripts/session-init.js       ← loader (lee ~/.claude/personal-os/state.flag)
    ├── commands/                     ← /os-on /os-off /os-setup /brief /tablero
    ├── skills/                       ← brief-diario, cerrar-tarea, reconciliar, tablero-diario
    ├── CORE.md / preamble.md         ← comportamiento
    └── README.md
```
