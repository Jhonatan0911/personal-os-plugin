---
name: personas
description: Módulo de personas del Personal OS — registra lo que el usuario dice de la gente de su equipo (quién sabe de qué, en qué frente está, qué pasó) y responde quién sabe de un tema, quién está libre, qué hacía alguien un día dado y qué frentes dependen de una sola persona. Úsala cuando el usuario afirme algo sobre una persona de su equipo ("Ana lleva la facturación", "le pasé el bug a Luis", "Persona 1 sale del equipo") o pregunte "¿quién sabe de…?", "¿quién está libre?", "armemos un equipo para…", "¿qué hacía X el lunes?", "¿quién es indispensable?".
---

# Skill — personas (módulo de equipo del Personal OS)

Este skill hace dos cosas distintas y **la mayor parte del tiempo se dispara sin que nadie lo
invoque**: escuchar lo que el usuario dice de su gente y registrarlo, y responder cuando pregunta.

**Cómo se invocan los scripts.** Todos viven en la carpeta `scripts/` del plugin. La raíz del
plugin aparece en el contexto de la sesión, en la línea **"Scripts del plugin:"** que inyecta el
hook de arranque; en los comandos de abajo, reemplaza `<raíz del plugin>` por esa ruta. Los
scripts leen la carpeta de estado de `~/.claude/personal-os/config.json` (`stateDir`); si no
existe, piden correr `/os-setup`.

**Dónde viven los datos** (en `<stateDir>/personas/`):

| Archivo | Qué es |
|---|---|
| `<slug>.md` | Una ficha por persona: frontmatter con identidades, frentes fechados y carga; cuerpo con "Cómo trabaja" e "Historial". |
| `_dominios.md` | Diccionario de frentes y sus alias. Sin un frente declarado aquí, no se puede asignar. |
| `_identidades.yaml` | *(opcional)* Lista `personas:` con `slug`, `nombre`, `git: [correos]` y `correo`; la usa `personas-doa.js` para atribuir commits. |
| `_ejemplo.md` | Ficha ficticia de referencia con el formato completo y la guía de campos. Los scripts ignoran todo archivo que empiece por `_`. |

---

## A · REGISTRAR — siempre activo, no hace falta que lo pidan

**Cuando el usuario diga algo sobre una persona de su equipo, se registra. No se espera a que lo
pida.** Para eso existe el módulo: una ficha por persona que va acumulando, con fecha y fuente,
lo que el usuario cuenta.

### Qué se registra

| Lo que dice | Qué se escribe |
|---|---|
| *"Ana siempre lleva la facturación"* | hecho de frente, `nivel: dueno`, fuente `declarado` |
| *"le asigné el bug de la pasarela a Luis"* | hecho en el historial + frente si es nuevo |
| *"Persona 1 no ha arrancado PROY-142"* | hecho en el historial, con la fecha |
| *"Persona 2 sale del equipo hoy"* | **cierra** el frente con `hasta:`, no lo borra |
| *"Luis está bloqueado esperándome"* | hecho en el historial: es carga real que Jira no ve |

### Cómo

```bash
node "<raíz del plugin>/scripts/personas-append.js" <persona> \
  --hecho "qué pasó" \
  [--frente <alias>] [--nivel dueno|trabaja|toco|aprende] \
  [--evidencia "qué lo sostiene"] [--fuente declarado|jira|git|mixto] \
  [--cierra] [--corrige] [--desde AAAA-MM-DD] [--crear] [--dry-run]
```

- `--crear` crea la ficha la primera vez que se habla de alguien.
- `--cierra` cierra el hecho vigente de ese frente (la persona deja el frente).
- `--corrige` reemplaza un hecho mal fechado en vez de cerrarlo (evita intervalos invertidos).

El script **rechaza** y no escribe si: el frente no está en `_dominios.md`, hay un nivel sin
evidencia, el nombre es ambiguo, o el texto toca un tema que la política de datos de personas
prohíbe (salud, vida privada, creencias, política, orientación sexual, credenciales). **Esos
rechazos se obedecen, no se rodean con `--forzar`.** `--forzar --motivo "…"` existe solo para
casos realmente indispensables y deja la marca en la ficha.

### Reglas al escribir

1. **Todo juicio va con su hecho, su fecha y su fuente.** "Es lento" no se escribe. "PROY-305
   lleva 14 días sin tocarse (Jira, 15/03)" sí.
2. **Se escribe el hecho laboral, no la causa personal**: "no entregó el 12/03", no por qué.
3. **Nunca se copia la bitácora.** Se enlaza el día.
4. **Un hecho que reemplaza a otro lo cierra con fecha.** El script ya lo hace solo.
5. **Si el usuario usa una palabra que el diccionario no tiene**, se agrega como alias en
   `_dominios.md` — y se le dice que se agregó. Esa es la pieza que hace que el módulo lo entienda.
   Un frente **nuevo** se declara solo con su visto bueno.

---

## B · RESPONDER

```bash
node "<raíz del plugin>/scripts/personas-query.js" quien "<frase tal como la dijo>"
node "<raíz del plugin>/scripts/personas-query.js" libre
node "<raíz del plugin>/scripts/personas-query.js" equipo "<frase>"
node "<raíz del plugin>/scripts/personas-query.js" dia <persona> <AAAA-MM-DD>
node "<raíz del plugin>/scripts/personas-query.js" persona <nombre>
node "<raíz del plugin>/scripts/personas-query.js" bus
node "<raíz del plugin>/scripts/personas-query.js" scan
```

(`--json` para salida estructurada.)

### Cómo se entrega la respuesta

- **Con la evidencia al lado, siempre.** Nunca "el mejor es X" a secas: *"X, porque tiene estas
  issues de ese frente desde tal fecha"*.
- **Si lo declarado choca con lo derivado, se dicen los dos** y se nombra la contradicción (por
  ejemplo: alguien declarado dueño de un frente cuyo inventario en Jira es de otro frente).
- **Si nadie cubre el frente, se dice "nadie"** y se propone decidirlo. No se ofrece al menos malo
  como si fuera el indicado.
- **"Menos issues" no es "más libre".** Es frecuente que buena parte de los casos no tengan fecha
  ni estimación: el inventario mide registro, no carga.
- **La asignación la decide el usuario.** El módulo recomienda.

### Para "¿qué hacía X el lunes?"

Primero convierte el día relativo en fecha absoluta. `dia` cruza tres cosas: el historial de la
ficha, la bitácora de ese día (`<stateDir>/bitacora/AAAA-MM-DD.md`) y **los frentes que esa
persona tenía vigentes ENTONCES** (no los de hoy). Si la ficha empezó después de esa fecha, el
comando lo avisa: *no hay memoria* es distinto de *no hacía nada*, y confundirlos es afirmar algo
falso sobre una persona real.

---

## C · MANTENIMIENTO

### Cruce con Jira (lo hace el asistente, no el script)

Los scripts son deterministas y offline: no llaman a Jira. **El cruce lo hace el asistente** con
el conector de Jira en SOLO LECTURA (los datos de conexión están en
`<stateDir>/config/fuentes.yaml`), y escribe en cada ficha:

```yaml
derivado_el: AAAA-MM-DD
issues_abiertas: N
issues_vencidas: N
ultimo_movimiento_jira: AAAA-MM-DD
conflictos: ["..."]
```

Frecuencia sugerida: junto con el brief diario. Una ficha con `derivado_el` viejo responde con
datos caducos y `scan` lo señala.

### Ownership de código

```bash
node "<raíz del plugin>/scripts/personas-doa.js" --repo <un clon local> [--escribir]
node "<raíz del plugin>/scripts/personas-doa.js" --repos <carpeta de clones> [--escribir]
```

Bajo demanda, sobre clones locales (`git` debe estar en el PATH). Requiere el mapeo de autores en
`_identidades.yaml`; lo que no esté mapeado se reporta como "sin mapear" y no se atribuye a nadie.
Con `--escribir` deja `personas/_bus-factor.md` y una caché en `personas/_cache/`.

### Higiene semanal

Correr `scan` y atender: identidades sin verificar, fichas nunca cruzadas con Jira, niveles
decaídos (más de 90 días sin evidencia), conflictos abiertos y frentes huérfanos.

---

## Lo que este módulo NO hace

- **No asigna.** Recomienda con evidencia; decide el usuario.
- **No evalúa desempeño.** Es un mapa de conocimiento y carga, no un insumo de calificación. Nada
  de las fichas sale hacia afuera (correos, informes, terceros) sin que el usuario lo decida.
- **No reemplaza hablar con la gente.** Que una ficha diga `dueno` no significa que esa persona
  esté disponible, ni de acuerdo, ni enterada.
