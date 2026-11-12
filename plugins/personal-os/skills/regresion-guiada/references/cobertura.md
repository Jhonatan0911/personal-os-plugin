# Fase 9-bis · Certificación de cobertura por inventario

Compuerta antes del cierre. No se certifica «a ojo»: por cada repo se arma un inventario desde el código y se
cruza con lo probado. Nació de un caso real: casi se omite una función del menú del shell (cambio de sede por
usuario) porque no se inventariaron sus pantallas.

1. **Inventariar desde el código** (un agente por repo, en paralelo):
   - Frontend: todas las **rutas** (`*routing*.ts`, `app.routes.ts`), componentes, acciones
     `(click)`/`(change)` y botones, y los **diálogos** (incluido el shell: sede, contraseña, perfil, consultorio).
   - Backend: todos los **controladores y endpoints** (verbos, rutas y versiones) y los **SP** que invoca.
2. **Cruzar cada ítem con la evidencia**: **probado** (archivo, caso o captura), **no probado** o **fuera de
   alcance** (con la razón: decisión del responsable, dependencia no bajada, módulo remoto, mensajería…).
   Nada queda sin marca.
3. Lo **no probado y alcanzable** se prueba o se declara como hueco con su motivo.
4. Sale una hoja de cobertura por sitio (hoja 02 de la matriz) y un `evidencias/cobertura/<repo>.md`. El
   veredicto por sitio (hoja 08) solo es «Pasa» con la cobertura completa (probado o justificado).
5. Lo que el inventario revele y no estuviera documentado se agrega a `conocimiento/<repo>/`.
6. **Agente barredor final** (paso fijo): un agente por proyecto que, sin confiar en lo ya marcado, vuelve a
   recorrer el repo y busca funciones que no estaban en el inventario, rutas o endpoints alcanzables sin
   evidencia y veredictos que no cuadran con la evidencia. Lo que encuentre se prueba o se declara hueco. Si un
   sitio queda bajo, explica por qué (pantallas administrativas que el periodo no usó, módulos remotos, APIs no
   bajadas), para que nadie lea el porcentaje como «no se probó».

**Cómo se reporta.** En dos niveles: (a) lo que la operación del periodo ejecutó = 100 % (lo que la regresión
tenía que cubrir); (b) lo alcanzable total, que puede ser menor y siempre va con la razón de cada hueco. Un
53 % de lo alcanzable con los núcleos al 100 % es una regresión completa, pero hay que decirlo así.
