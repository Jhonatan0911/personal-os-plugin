<#
.SYNOPSIS
  Wrapper fino de scripts/mongoread.py (lector SOLO LECTURA de Mongo TEST).
  Reenvia todos los argumentos al script Python. Ver reglas en el CLAUDE.md raiz.

.EXAMPLE
  scripts\mongoread.ps1 --ConfirmDb <bd_test> --Collection <coleccion> --Filter '{"_id":{"$oid":"<id>"}}' --Project '{"Estado":1}' --Limit 5 --DryRun
#>
$py = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $py) { throw "python no esta instalado o no esta en PATH (se requiere python + pymongo)." }
& $py (Join-Path $PSScriptRoot 'mongoread.py') @args
