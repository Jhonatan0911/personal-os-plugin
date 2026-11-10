# Generalizar una skill (que le sirva a otro líder)

Meta: la misma skill funciona para cualquiera que instale el plugin, con **sus** datos, y para el
autor original sigue funcionando igual.

## 1. Inventario de lo personal

Corre el auditor con la lista de términos del autor (nombre, usuario de Windows, cédula, dominio de
correo, clientes, compañeros, prefijos de Jira, carpetas):
`python -I "${CLAUDE_SKILL_DIR}/scripts/auditar_skills.py" <skill> --personal <terminos.json>`
Clasifica cada hallazgo:

| Tipo | Ejemplo | Destino |
|---|---|---|
| Identidad | nombre, cédula, cargo | configuración del usuario (`config.json` del Personal OS) |
| Rutas | `C:\Users\<usuario>\<carpeta sincronizada>\…` | configuración (`rutas.*`), con valor por defecto relativo al estado |
| Equipo | nombres de compañeros, correos | `estado/personas/` (ya es la fuente del equipo) |
| Organización | categorías del timesheet, destinatarios, jornada | configuración de la organización (`config/organizacion.json` o equivalente) |
| Clientes y proyectos | nombres de clientes, prefijos de Jira | configuración (`clientes`, `jira.proyectos`) |
| Marca | colores, logo | `config/marca/` |
| Reglas que nacieron de un incidente | "el 21/08 gerencia reclamó…" | la regla queda; la anécdota sale (o va a una nota de decisión) |

## 2. Cómo lee la skill su configuración

- Un paso al inicio: "Lee `<raíz del estado>/config/<archivo>.json`". La raíz la resuelve el Personal
  OS (variable o `config.json` del plugin); nunca se escribe en duro.
- **Si falta un valor**, la skill lo pregunta una vez en el modal y lo guarda en la configuración:
  la segunda vez ya no pregunta.
- Valores por defecto razonables para lo que no es identidad (jornada 8 h, carpeta `timesheet/`).
- Los scripts reciben la configuración por argumento o la leen del mismo archivo; no traen
  constantes personales.

## 3. Lo que NO se generaliza

- El método y las reglas de calidad (son el valor de la skill).
- Lo que solo existe en una organización y no tiene equivalente: se deja como **perfil** opcional
  (`perfiles/<organizacion>.json`) que el usuario activa, en vez de borrarlo.
- Skills puramente personales (hobbies, estudio de video): quedan fuera del plugin de trabajo; si
  se publican, van en su propio plugin.

## 4. Cierre

1. Auditor con la lista de términos: 0 datos personales.
2. Prueba con la configuración real del autor: mismo resultado que antes.
3. Prueba con una configuración vacía: la skill pregunta lo que falta y no se rompe.
4. La plantilla de la configuración nueva va a `plantillas/` del plugin, y `os-setup` la crea.
