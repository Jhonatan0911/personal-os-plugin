# Azure DevOps: lectura del PR y publicación con permiso

## 1. Credencial

`azdo_pr.py` usa, en este orden: `AZDO_PAT` del proceso; en Windows, `AZDO_PAT` de las variables de usuario;
y si no, la credencial que git ya guardó para `dev.azure.com/<organizacion>` (`git credential fill`, sin
mostrar ventanas). Vive solo en memoria: nunca se imprime ni se escribe. Si responde 401/403, la credencial
venció o no tiene lectura de código: pide al líder que clone de nuevo un repo de la organización o renueve
su token. No se pide el token por el chat.

## 2. Llamadas que hace (todas GET, api-version 7.0)

| Para qué | Endpoint |
|---|---|
| PR por id (sin proyecto) | `/{org}/_apis/git/pullrequests/{id}` |
| PR por clave de Jira | `/{org}/{proyecto}/_apis/git/pullrequests?searchCriteria.status=active|all&$top=300` y filtro por rama/título |
| Iteraciones (commits base común, fuente y destino) | `…/repositories/{repo}/pullRequests/{id}/iterations` |
| Archivos cambiados | `…/pullRequests/{id}/iterations/{it}/changes?$compareTo=0` |
| Contenido | `…/repositories/{repo}/blobs/{sha}?$format=octetstream` o `…/items?path=…&versionDescriptor.version={commit}` |
| Stack de la rama destino | `…/items?recursionLevel=Full` + `.csproj` y `package.json` |
| Commits del PR | `…/pullRequests/{id}/commits` |

El diff se arma en memoria con `difflib` entre el commit base común y el de la rama: no se clona, no se hace
checkout y nada del PR llega a ejecutarse. Archivos binarios o de más de 1 MB quedan como «Binary files differ».
Más de 400 archivos: el resto se lista en `archivos_omitidos`.

## 3. Publicar comentarios (solo con OK explícito del líder)

No hay script de publicación a propósito. Si el líder lo pide **expresamente** y aprueba el texto exacto de
cada comentario:
- Comentario en línea: `POST /{org}/{proyecto}/_apis/git/repositories/{repo}/pullRequests/{id}/threads?api-version=7.1`
  con `{"comments": [{"content": "…", "commentType": 1}], "status": "active",
  "threadContext": {"filePath": "/ruta", "rightFileStart": {"line": N, "offset": 1}, "rightFileEnd": {"line": N, "offset": 1}}}`.
- Comentario general: el mismo POST sin `threadContext`.
- Nunca se vota, aprueba, rechaza ni completa el PR. Tras publicar, marca `publicado: true` en la entrada de
  `revisiones_pr` con la fecha.

## 4. Lo que la API no resuelve

- Quién debe aprobar: las políticas de rama (revisores obligatorios, build validation) se leen aparte y
  pueden requerir permisos de administrador del proyecto.
- Muchas issues no tienen PR propio (subtareas que comparten rama): la clave de Jira de la rama es el único enlace.
