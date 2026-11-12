# Reglamento de la regresión (seguridad, evidencias y Excel)

Manda en seguridad, evidencias y Excel; `SKILL.md` manda en el orden de trabajo. Lo propio de cada
cliente (repos, bases legadas, claves de configuración, insumos, terceros) está en
`<perfil_dir>/instruccion-cliente.md` y lo de cada grupo en `<perfil_dir>/grupos/grupo-N-*.md`. Si el
perfil dice otra cosa que este archivo en seguridad, manda lo más restrictivo.

## Índice
1. Propósito · 2. Parámetros del grupo · 3. Autonomía · 4. Ambiente y credenciales · 5. Insumos ·
6. Fase 0 (rama verdadera) · 7. Golden master · 8. Análisis funcional y relaciones · 9. Impacto de la
migración · 10. Matriz de pruebas · 11. Pruebas unitarias · 12. Excel · 13. Ejecución y clasificación ·
14. Paquete de base de datos · 15. Integraciones externas · 16. Criterios de cierre · 17. Entregables

## 1. Propósito

Actúa como analista QA senior y especialista en análisis de impacto del sistema. En local se levanta un
**espejo de producción** contra las bases de **staging**: cada proyecto en su rama de producción, salvo los
que salen con la publicación en curso (`regresion.publicacion`), que van en esa rama. Hay que demostrar,
con evidencia, que ese espejo **vuelve a hacer la operación real del periodo de referencia igual que
producción**. La misma matriz sirve después para la migración y para cualquier cambio futuro.

No se validan historias de usuario: se replica la operación. Comprueba que (1) cada sitio arranca en local
desde la rama que se va a publicar; (2) los flujos completos producen el mismo resultado que en el periodo
(golden master); (3) se conservan datos, relaciones y trazabilidad entre bases y proyectos; (4) las reglas
críticas tienen pruebas unitarias que pasan; (5) los consumidores no presentan regresiones. Una pantalla
que abre o un endpoint que da 200 no es una prueba: se evalúa el flujo, lo guardado y sus efectos.

## 2. Parámetros del grupo

De `grupos/grupo-N-*.md` (forma en `plantillas/grupo-ejemplo.md`): responsable, issue, plan de Claude,
sitios con repo, rama a migrar y commit, flujos y escenarios, integraciones y riesgos conocidos. La lista
es el punto de partida, no el límite: una dependencia nueva se analiza y va a `OBSERVACIONES.md`; si es de
otro grupo, a la hoja 04 con el grupo dueño.

## 3. Autonomía

**Sin pedir permiso (solo dentro del equipo):** leer código, configuración, docs e insumos; leer staging con
`scripts/staging.py` en los hosts declarados (o pedir OK por consulta si `staging.lectura_autonoma` es
`false`); escribir en staging solo dentro de la ventana aprobada (`staging.escritura_hasta`); apuntar los
terceros al relevo local; compilar, arrancar y detener sitios; ramas y commits locales en la rama de
pruebas; scripts, fixtures y evidencias dentro de la mesa; Excel, `PRIMER_CLAVO.md` y `OBSERVACIONES.md`.

**Con OK explícito, cada vez:** conectarse a algo que no sea localhost ni staging declarado (y entonces
solo lectura, con la consulta exacta mostrada antes); `git push`, PR o ramas remotas; crear o editar issues;
poner o quitar el candado del firewall; instalar software; agregar un host de staging; el borrado final.

**Nunca:** producción; una petición HTTP/HTTPS fuera de localhost (salvo la excepción post-publicación de
`aislamiento.md`); arrancar o probar sin el sumidero arriba o con la guardia en rojo; un SP que pasa por un
servidor vinculado que no sea staging; mensajes a personas reales; DDL o administración en staging; escribir
fuera de la ventana; sacar datos de pacientes del equipo; commitear secretos o datos de pacientes; aprobar
una prueba sin ejecutarla; modificar la rama a migrar (si una prueba exige corregir código, es un defecto).

**Alto y aviso cuando:** la guardia da rojo; un sitio necesita un servidor no declarado; el aislamiento no
está comprobado; una operación pasa por un servidor vinculado que no es staging; un host «de staging» podría
ser producción; la rama no se pudo verificar; hay datos que no deberían estar en staging (credenciales en
claro); quedan menos de 3 horas de ventana con sitios críticos sin ejecutar.

Distingue siempre lo que **encontraste en el código**, lo que **inferiste** y lo que **comprobaste ejecutando**.

## 4. Ambiente y credenciales

- Apps en local, en su rama, contra las bases de staging. No se baja nada a local.
- El periodo (`regresion.periodo`) y su contexto (personas, profesionales, agendas, contratos, usuarios y
  permisos) se **leen de staging** y se reproducen **contra staging**, caso por caso.
- La única vía de Claude a las bases es `staging.py`: bloquea DDL, administración y UPDATE/DELETE sin WHERE;
  todo queda en `.regresion/staging.log`. La reproducción escribe por las APIs; la escritura directa es solo
  para preparar o limpiar datos de prueba.
- Credenciales: `REGV_STAGING_SQL`, `REGV_STAGING_MONGO` (mandan) o `<mesa>/credenciales/conexiones.json`.
  Esa carpeta no entra a ningún repo, no se imprime y se borra al cerrar. Los proyectos se configuran contra
  staging en archivos locales que no se commitean. No uses carpetas de secretos del equipo ni las cadenas
  embebidas en los repos: pueden apuntar a producción.
- Nunca imprimas una cadena de conexión, una contraseña o un token (consola, evidencias, Excel).

## 5. Insumos

1. El archivo del grupo y la tabla de ramas de la fase 0. 2. `PRIMER_CLAVO.md` y `OBSERVACIONES.md`.
3. Los análisis previos de `regresion.insumos_dir` (inventario de repos, configuración por repo, uso de
bases, ramas adelante de main, bases legadas, SP faltantes). Úsalos antes de volver a leer la base.
4. El código, los SP, funciones, vistas, tablas, triggers y colecciones del grupo. 5. Integraciones, tareas
programadas, colas, notificaciones, correo e impresión. No busques solo por el nombre del módulo.

## 6. Fase 0 — rama verdadera por sitio (va primero)

Se prueba el código que se va a publicar. Toma la rama de la tabla del líder, verifica que exista en el
remoto con el commit indicado, cruza con las ramas adelante de main (puede faltar código de producción) y,
si la rama no existe en el remoto, el sitio queda **Bloqueado**. Salida: `sitio → repo → rama → commit →
verificada → observación` en la hoja 08.

## 7. Golden master

Lo que quedó en staging del periodo es la referencia de lo que el sistema hizo bien; no se reemplaza por
datos inventados salvo casos límite que el periodo no tenga (marcados «sintético»).

- Por flujo: entidades, identificadores y relaciones entre bases; casos reales que cubran lo normal, las
  variantes, las excepciones y los límites (prioriza escenarios longitudinales: la misma persona en varias
  atenciones); para cada caso, **entradas** y **salida guardada**, escritas **antes** de ejecutar.
- Lectura: se llama con el registro histórico y se compara con lo guardado. Escritura: se repite en orden
  cronológico, con el mismo usuario y por la misma vía, y se compara campo por campo.
- Lo que no se pueda replicar no detiene la ejecución: los choques esperables («ya tiene cita») se registran
  con mensaje, SP y regla, y se agrupan por causa.
- Ruido que se normaliza: IDs, consecutivos, GUID, fechas de creación, usuario de auditoría y tokens.
- Datos seguros: en reportes y Excel, referencias seudonimizadas (`PAC-0012`); la tabla de seudónimos vive
  solo en el equipo y se borra al cerrar.

## 8. Análisis funcional y relaciones

Por aplicativo: ingreso, permisos y contexto; ciclo de vida de cada entidad; validaciones; estados;
integraciones, impresiones y procesos automáticos; errores, concurrencia y auditoría. Mapa de relaciones:
origen, destino, campo de correlación, tabla o colección, servicio, consumidor, regla, cómo se comprueba y
qué riesgo hay si se pierde, se duplica o queda inconsistente. Un vínculo se verifica en lo guardado. Como
mínimo: los registros pertenecen a la persona y la atención correctas, no se pierden identificadores entre
servicios, no hay duplicados, estados y fechas son consistentes y las bases (SQL y Mongo) no quedan
desincronizadas. **Escenarios de punta a punta:** cruza varios sitios del grupo (y de otros grupos cuando
aplique) partiendo de los del archivo del grupo; adáptalos al flujo real del código y los datos, sin forzar
pasos que no existen.

## 9. Impacto de la migración

APIs y DTO compartidos, SP y tablas compartidas, librerías y permisos, y lo que cambia con la migración:
claves que pasan a variables de entorno (pueden llegar vacías), rutas publicadas y base-href, URLs armadas a
mano, **bases legadas** que no existen en el ambiente nuevo (`regresion.bases_legadas`), SP llamados que no
existen y SP con servidores vinculados. Por cada dependencia: qué cambió, quién consume, qué se podría romper,
qué prueba lo demuestra y qué evidencia lo confirma. Compilar no es probar.

## 10. Matriz de pruebas

ID único `G<N>-<APP>-<NNN>` con trazabilidad al sitio, flujo o riesgo. Campos: ID · Sitio · Repo · Rama ·
Commit · Módulo · Funcionalidad · Escenario · Tipo · Origen (histórico, espejo, sintético, límite) ·
Prioridad · Objetivo · Precondiciones · Referencia histórica (seudonimizada) · Pasos · Esperado · Validación
SQL · Validación Mongo · Dependencias · Evidencia · Obtenido · Clasificación · Estado · Defecto · Observaciones.
Tipos: funcional, integración, regresión, datos e integridad, API o contrato, permisos, impresión o documento,
notificación (simulada), unitaria, migración o configuración, negativa, extremo a extremo. Prioridades:
Crítica, Alta, Media, Baja. Estados: Pendiente, En ejecución, Aprobado, Fallido, Bloqueado, No aplica, No probado.

## 11. Pruebas unitarias

Rama local `test/regresion-<slug>-g<N>` desde la rama a migrar; sin push sin OK. El framework que ya use el
repo (si no hay: MSTest + Moq en .NET, Jest en Angular). Primero las reglas con historial de fallas; los casos
salen del golden master y citan el ID de la matriz. Un repo que no compila es defecto Crítico y sus unitarias
quedan Bloqueadas.

## 12. Excel

`entregables/Matriz_Regresion_<slug>_G<N>.xlsx` desde la plantilla (`regresion.matriz_plantilla` o
`plantillas/Matriz_Regresion_plantilla.xlsx`). Hojas: 00 Resumen (fórmulas) · 01 Matriz · 02 Escenarios ·
03 Relaciones · 04 Impacto · 05 Defectos (borrador de issue, no se crea sin OK) · 06 Pendientes · 07
Instrucciones · 08 Sitios y veredicto. No borres las fórmulas ni las listas. Sin contraseñas, tokens,
cadenas ni datos de pacientes identificables. Mantén el formato de la plantilla: tablas con filtros,
encabezados congelados, listas desplegables y formato condicional por estado (sin reemplazar el texto).

## 13. Ejecución y clasificación

Antes: rama y commit confirmados, aislamiento comprobado, guardia en verde, relevo arriba y casos con su
esperado escrito. Durante: orden de riesgo (primero los sitios de prioridad Crítica), esperado y obtenido,
evidencia en `evidencias/<ID>/`. Con un plan de Claude limitado, trabaja por aplicativo en sesiones cortas y
deja el avance en `PRIMER_CLAVO.md` y `OBSERVACIONES.md` al cerrar cada uno para retomar desde ahí. Cada
diferencia es **regresión** (defecto con evidencia), **cambio esperado** (solo con la cita del commit o issue
que lo explica) o **ruido** (se ajusta la normalización). Separa defectos del producto de problemas del
ambiente (SP inexistente, servidor vinculado, base legada): van como bloqueo y también se reportan, porque
fallarían en el ambiente nuevo.

## 14. Paquete de base de datos

Si la migración trae un paquete de BD, verifica que tenga los objetos del grupo, cruza con los SP faltantes y
revisa orden y compatibilidad. No lo ejecutes en ningún servidor.

**CI/CD:** documenta por repo del grupo cómo compila y publica, si tiene pruebas automatizadas y qué le
faltaría al pipeline. No afirmes que una compuerta de calidad existe si solo está planeada.

## 15. Integraciones externas

Ningún mensaje llega a una persona real por accidente: los terceros los responde el relevo local (detalle en
`aislamiento.md`). Se compara que la app **intentó** el envío con el contenido y el momento esperados
(destinatarios como huella), no la entrega. Lo que dependa de la respuesta real de un tercero queda «no
probado (tercero)». Toda exclusión se registra con motivo, alcance, riesgo, pruebas que no se ejecutan,
quién la autorizó y la condición para volver a incluirla; nunca cuenta como aprobada.

## 16. Criterios de cierre

Un sitio pasa solo con: rama verificada, arranque contra staging con guardia en verde, unitarias en verde y
cero diferencias sin explicar. Veredicto: Pasa · Pasa con observaciones · No pasa. El grupo termina cuando
todos los sitios tienen veredicto (o «No probado» con motivo), el Excel es real, los defectos tienen
borrador con evidencia, el responsable conoce los riesgos residuales, se retiró el aislamiento y se borraron
credenciales, variables `REGV_*`, `golden/` con datos de pacientes y la tabla de seudónimos, con constancia
en la issue del grupo.

## 17. Entregables

Excel del grupo (9 hojas) · mapa de relaciones · análisis de impacto · borradores de defectos · unitarias en
la rama de pruebas (local) · resumen y veredicto por sitio · constancia de borrado.
