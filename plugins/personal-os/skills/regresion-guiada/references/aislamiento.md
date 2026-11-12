# Aislamiento de red, terceros y tráfico en vivo

Léelo en las fases 5 y 6, y antes de la pasada post-publicación. Objetivo: que una URL que quedó sin
cambiar nunca mande un POST a producción ni un mensaje a una persona real.

## Índice
1. Regla dura · 2. Proxy-sumidero · 3. Agente revisor de apuntamientos · 4. Firewall (opcional) ·
5. Relevo local de terceros · 6. Mirilla de tráfico · 7. Servidores vinculados · 8. Post-publicación
contra staging desplegado · 9. Pruebas con mensajes reales al contacto de quien prueba

## 1. Regla dura

Ninguna petición sale del equipo salvo a localhost y las conexiones de **base de datos** a los hosts de
staging confirmados en el modal (`kit/hosts-permitidos.json → staging`, puertos `staging_puertos`). Si un
host podría ser producción: alto. Si el aislamiento, el apuntamiento o un servidor vinculado quedan en duda:
alto, se avisa y no se arranca nada.

## 2. Proxy-sumidero (el candado por defecto)

`node "${CLAUDE_SKILL_DIR}/scripts/sumidero-proxy.js"` escucha en `127.0.0.1:4809` (`SUMIDERO_PUERTO`). A
cada app, script y a Playwright se les pone `HTTP_PROXY`/`HTTPS_PROXY=http://127.0.0.1:4809`: deja pasar
localhost y lo de `staging_web`/`estaticos_web`; a todo lo demás responde 502/403 y lo registra en
`evidencias/relevo/sumidero-proxy.jsonl`. **Prueba de salida obligatoria** antes de seguir: una llamada a un
tercero tiene que volver 502/403 y quedar registrada.

**Límite conocido:** intercepta a nivel de aplicación, no de sistema operativo. Atrapa a los procesos que
respetan las variables de proxy (.NET, Node y el Chromium de Playwright lo hacen). Por eso se refuerza con
el agente revisor (§3) y, si se puede, con el firewall (§4). Los paquetes (`dotnet restore`, `npm ci`) se
bajan **sin** el proxy (o con `NO_PROXY`), antes de arrancar.

## 3. Agente revisor de apuntamientos (refuerzo real)

Antes y durante la corrida, un agente revisa repo por repo que las cadenas de conexión y los `appsettings`
apunten a **staging y no a producción**, que no queden URLs de terceros ni de servidores desplegados en el
código que se ejecuta, y deja constancia en `evidencias/guardia/`. Complementa a
`node "${CLAUDE_SKILL_DIR}/scripts/guardia.js"` (con `REGRESION_MESA`): rojo si una configuración de `repos/`
(también en Base64) tiene una URL fuera de localhost, si un host de staging aparece en algo que no sea una
cadena de BD, o si el aislamiento no está puesto. Lista además las URLs escritas en el código: no se
corrigen; las detiene el sumidero y la operación queda «no probada (tercero)». En rojo no se sigue.

## 4. Firewall de Windows (opcional, el más hermético)

Para quien pueda correr como administrador:
`powershell -ExecutionPolicy Bypass -File "${CLAUDE_SKILL_DIR}/scripts/candado-red.ps1" -Mesa <mesa>`
(`-Verificar` para comprobar, `-Quitar` al cerrar). Bloquea toda salida de `dotnet.exe`, IIS Express,
`kit/bin/node-regresion.exe` y cada `.exe` compilado en `repos/`, salvo 127.0.0.1 y los puertos de BD de
staging (reglas `RegresionGuiada-*`). Se vuelve a correr después de cada compilación y su prueba debe decir
«internet bloqueado: SÍ». **Díselo antes al responsable:** mientras esté puesto, cualquier proyecto .NET del
equipo solo llega a localhost y `dotnet restore`/NuGet no funciona; navegador, Teams, Git, Python y el
`node.exe` del sistema siguen normales. Poner o quitar el firewall siempre pide OK.

## 5. Relevo local de terceros

Copia `plantillas/relevos.json` a `kit/relevos.json` y corre `"${CLAUDE_SKILL_DIR}/scripts/relevo.js"` en
segundo plano (con `kit/bin/node-regresion.exe` si se usa el firewall). Cada app apunta sus terceros
(WhatsApp, SMS, correo API o SMTP, short-link, validadores, videollamada…) a `127.0.0.1:<puerto>` del relevo
(4801-4806, SMTP 2525). El relevo **no reenvía nunca**: registra en `evidencias/relevo/<servicio>.jsonl` qué
quiso enviar la app (destinatarios como huella) y responde lo configurado. Los validadores responden 503, como
si el tercero no respondiera: lo que dependa de su respuesta real queda «no probado (tercero)» y no se compara
contra el periodo. Si su configuración trae un `destino` fuera de localhost, no arranca.

## 6. Mirilla de tráfico (panel «Tráfico en vivo» de la página)

Copia `plantillas/mirilla.json` a `kit/mirilla.json` con el mapa de puertos de la fase 6: cada API escucha en
su puerto **interno** (`destino` = público + 10000) y quien la llama apunta al **público** (`escucha`), donde
está la mirilla; las cadenas de BD locales apuntan a `127.0.0.1:<escucha>` (14330 SQL, 27018 Mongo) y la
mirilla las lleva a staging, sin tocar Encrypt/TLS. Corre `"${CLAUDE_SKILL_DIR}/scripts/mirilla.js"` antes de
las apps; si su configuración trae un destino HTTP fuera de 127.0.0.1 o una base fuera de
`hosts-permitidos.json`, no arranca. Los scripts de reproducción mandan `X-Regresion-Caso: <id>`. Cuerpos,
cookies y cabeceras no se registran; números de 6+ dígitos y correos se enmascaran.

## 7. Servidores vinculados de SQL

Antes de cualquier escritura se lee `sys.servers` en staging (solo lectura). Un SP que escribe o lee por un
servidor vinculado que no sea staging **no se invoca**: la operación queda «bloqueada (servidor vinculado)».

## 8. Post-publicación contra staging desplegado

La pasada posterior a la publicación no es local: se hace con Playwright contra las páginas de staging ya
desplegadas (`regresion.staging_web`). Es la **única excepción** a «solo localhost»:

1. El navegador sale **solo** a los hosts de `staging_web` (confirmados en el modal como staging) y a
   `estaticos_web` (fuentes, íconos, estilos). El sumidero los reenvía en túnel y sigue bloqueando el resto.
   `kit/sitios.json → "modo": "staging"` con la URL de cada front.
2. No hay apps locales, ni relevo, ni mirilla, ni atajo de login: se entra por el **login real** con
   **usuarios de prueba por rol** (`credenciales/usuarios-prueba.json`, nunca se imprimen) con los mismos
   permisos que el usuario original. Si un rol no tiene usuario de prueba: alto y se pide en el modal.
   Si el primer ingreso obliga a cambiar la clave, `pw_base.primer_ingreso` la cambia por una aleatoria y
   la guarda en ese archivo: avísalo, porque cambia la clave de ese usuario de prueba en staging.
3. **Riesgo que el sumidero no cubre:** las APIs desplegadas llaman a terceros **desde el servidor**. Si
   staging tiene contactos reales, antes de la primera escritura el responsable confirma en el modal que la
   mensajería de staging está apagada o apunta a un destino de prueba; si no se sabe, los casos que disparan
   mensajes quedan «no probado (tercero)», salvo lo de §9.
4. Se escribe por pantalla dentro de la ventana vigente; la comparación con el periodo se lee con `staging.py`.
5. Con `conocimiento/` y `golden/` de la corrida base, se hace solo la fase 7 por pantalla (y 8, 9 y 9-bis
   sobre lo nuevo). No se repiten las fases 1-6 ni se revierte la publicación.

## 9. Pruebas con mensajes reales al contacto de quien prueba

Solo si el perfil lo activa (`regresion.contacto_de_prueba: true`) y para los flujos que disparan mensajes a
la persona atendida. Por cada persona con la que se va a operar, por pantalla: (a) abrirla; (b) **actualizar
datos**: anotar en archivo (no en consola) el contacto original y reemplazarlo por el de
`credenciales/contacto-pruebas.json` (lo llena cada quien con **su propio** contacto; nunca va en la skill ni
en un repo); guardar, recargar y verificar; (c) ejecutar la operación y su reverso (p. ej. asignar y cancelar):
los mensajes llegan a quien prueba, que confirma en la matriz qué recibió y con qué texto; (d) **restaurar**
los datos originales y verificar. Si la actualización falla, no se opera con esa persona.
