# Títulos de «qué hace hoy» (Ocupación de hoy)

Cada tarjeta de «Ocupación de hoy» nombra los globales en que la persona trabaja hoy. El nombre de Jira del macro
casi nunca sirve («Dashboard general de integraciones de Viva 1A (validador de derechos y facturación electrónica)»):
es largo y no dice qué se hace hoy. Este título lo escribe quien corre la skill, en cada corrida, con este procedimiento.

## 1. De dónde sale el contexto

`status-celula-hoy.js --datos <datos.json> --inventario <inventario.json>` lista, por persona y global:
el macro, las historias de donde cuelgan las tareas de hoy, el tipo de cada issue, las tareas (con «vencida») y
una pista si el grupo parece una reunión o un seguimiento (la tarea de hoy es el propio macro, o su tipo es Reuniones
o Seguimiento). **Lee las historias y las tareas, no solo el macro**: el título sale de lo que dicen ellas.

## 2. Cómo se escribe

**Fórmula: tipo de trabajo + sobre qué.** 3 a 6 palabras, en español claro, entendible por alguien que no conoce el proyecto.

| Tipo de trabajo (elige el que de verdad es) | Cuándo |
|---|---|
| Desarrollo de… · Dashboard de… · Integración de… · Pantalla de… · API de… | construye algo nuevo |
| Correcciones de… · Ajustes a… · Error al… / Error en… | arregla lo que ya existe o lo que dejó una revisión |
| Revisión técnica de… · Revisión de… | revisa el trabajo de otro (típico del líder) |
| Pruebas de… · Regresión de… · Certificación de… | prueba o certifica |
| Carga de… · Parametrización de… · Migración de… | datos o configuración |
| Definir… · Plan de… · Documentar… | decide, planea o documenta |
| Reunión de… · Seguimiento de… | el grupo es una reunión o el seguimiento de un macro (la tarea de hoy es el propio macro, o el calendario tiene la reunión) |

Reglas:
- **No cambies el sentido al recortar.** Si construye el dashboard del validador, es «Dashboard del validador de
  derechos», no «Validador de derechos». Si integra con Compensar, es «Integración de pruebas rápidas con
  Compensar», no «Pruebas rápidas Compensar».
- **Nombra lo de hoy, no el paraguas.** Bajo el refactor de la HC, Mateo hace «Correcciones del doble RIPS» y
  Zharick «Escalas del M5 y correcciones», aunque las dos cuelguen de «Refactorización de HC EverHIS».
- **Sin siglas sueltas ni jerga interna**: «HC» y «RIPS» se entienden en la célula; «S04», «M5» solo si van con
  qué son («Escalas del M5»). Nada de claves de Jira, GLPI ni nombres de rama.
- **Sin el nombre del cliente** salvo que distinga (con varios clientes en la misma persona) ni el nombre del macro completo.
- **Una reunión se dice reunión.** Si la persona hoy solo tiene el macro (por ejemplo el líder con «Control de
  agendamiento nacional» y una reunión de ese tema en el calendario), es «Reunión de agendamiento nacional».
- Además del título por persona (`"<carril>|<CLAVE-GLOBAL>"`), escribe uno **genérico por global**
  (`"<CLAVE-GLOBAL>"`), con la misma fórmula, para quien no tenga el suyo.

## 3. Ejemplos (corrida del 19/11/2026)

| Persona · global | ❌ Mal | ✅ Bien | Por qué |
|---|---|---|---|
| Mateo · EV-1744 | Validador de derechos | Dashboard del validador de derechos | lo que construye es el dashboard |
| Mateo · VIVACO-2518 | Pruebas rápidas Compensar | Integración de pruebas rápidas con Compensar | falta el tipo de trabajo |
| Mateo · EV-1190 | Refactorización de HC EverHIS | Correcciones del doble RIPS | sus tareas de hoy son las correcciones de la revisión |
| Jhonatan · EV-1190 | Revisión doble RIPS | Revisión técnica del doble RIPS | una palabra más y se entiende |
| Jhonatan · VIVACO-2332 | Agendamiento nacional | Reunión de agendamiento nacional | hoy es la reunión de seguimiento |
| Grace · VIVACO-1829 | Plantillas SMS y CUPS | Carga de SMS y CUPS de lista de espera | dice qué hace y de qué |
| Grace · VIVACO-2518 | Pruebas con Compensar | Pruebas de la integración con Compensar | qué se prueba |
| Arnaldo · VIVACO-1660 | Traslado particulares | Empalme de particulares con Abraham | dice qué es |

## 4. Antes de subir

`status-celula-hoy.js … --validar` revisa cada título: que todos los grupos tengan el suyo, que tenga 3 a 7
palabras, que empiece por un tipo de trabajo de la tabla (o lo marca para que lo mires), que no sea igual al nombre
del macro ni tenga claves de Jira o siglas sueltas. Sale con 1 si algo falla: se corrige y se vuelve a correr.
Después, **léelo como lo leería alguien de fuera**: si hay que explicarlo, no sirve.
