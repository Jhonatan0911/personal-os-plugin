# Mantener los scripts de `assets/`

Léelo solo si vas a tocar `mesa-clonar.ps1`, `mesa-status.ps1`, `dbread.ps1` o `mongoread.*`.

Están probados contra un repo de juguete (clonado por `file://`, tres ramas): listado de ramas,
bloqueo por `ramaBase` sin elegir, base inexistente, trabajo directo sobre la base y colisión de refs.
Tres reglas que ya costaron un bug cada una:

1. **ASCII puro en los `.ps1`.** Windows PowerShell 5.1 lee los scripts sin BOM como ANSI: una `—`
   o una `í` dentro de una cadena la parte y el archivo deja de parsear. Los `.md` sí van en UTF-8.
2. **Ninguna función se puede llamar `Git`.** PowerShell resuelve nombres sin distinguir mayúsculas
   y las funciones ganan a los ejecutables: `& git` dentro de una función `Git` se llama a sí misma
   para siempre (cuelgue, no error). De ahí `Invoke-Git` y `& git.exe`.
3. Toda llamada a git va por `Invoke-Git`, que baja `ErrorActionPreference` a `Continue`: con `Stop`,
   redirigir el stderr de un nativo (`2>&1`) aborta el script aunque git haya terminado bien —
   `Switched to a new branch` se escribe en stderr.

Verificar tras editar:
`[System.Management.Automation.Language.Parser]::ParseFile($ruta,[ref]$null,[ref]$e)`.

## Placeholders que sustituye la skill al copiar

| Archivo | Placeholder | Se reemplaza por |
|---|---|---|
| `dbread.ps1` | `__APPSETTINGS_DEFAULT__` | ruta relativa a la raíz del `appsettings.json` con la cadena SQL (ej. `repos\<Backend>\<Proyecto>\appsettings.json`) |
| `mongoread.py` | `__APPSETTINGS_DEFAULT_MONGO__` | ídem para la cadena Mongo (ej. `repos/<Api>/Api/appsettings.json`) |

Si la clave de la cadena SQL no se llama `ConexionSQL`, ajustar el default de `-ClaveConexion`.
