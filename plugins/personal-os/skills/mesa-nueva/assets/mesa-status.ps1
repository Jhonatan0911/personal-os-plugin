<#
.SYNOPSIS
  Estado git de los N repos de la mesa, en una tabla. Insumo de docs/INVENTARIO-REPOS.md.

.DESCRIPTION
  Lee MESA.json y por cada repo reporta rama, HEAD, ahead/behind vs upstream, archivos sucios
  y si origin apunta al repo VIVO declarado en el manifiesto. NUNCA imprime URLs con token:
  compara contra <org>/<proyecto>/_git/<repo> y muestra solo el veredicto.

  Nota tecnica: las llamadas a git pasan por Invoke-Git(), que baja ErrorActionPreference a
  Continue. En Windows PowerShell 5.1, redirigir el stderr de un nativo con EAP=Stop aborta el
  script aunque el comando haya ido bien (y aqui hay comandos que fallan a proposito, como
  consultar el upstream de una rama que no lo tiene). El nombre no puede ser Git: las funciones
  ganan a los ejecutables y '& git' se llamaria a si misma (de ahi tambien el '& git.exe').

.EXAMPLE
  .\scripts\mesa-status.ps1
  .\scripts\mesa-status.ps1 -Sucios     # ademas lista los archivos sucios de cada repo
#>
[CmdletBinding()]
param(
  [string]$Manifiesto = "$PSScriptRoot\..\MESA.json",
  [switch]$Sucios
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $Manifiesto)) { throw "No existe el manifiesto: $Manifiesto" }
$mesa = Get-Content $Manifiesto -Raw -Encoding UTF8 | ConvertFrom-Json
$raiz = Split-Path (Resolve-Path $Manifiesto) -Parent

function Invoke-Git([string[]]$Argumentos) {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $salida = & git.exe @Argumentos 2>&1 | ForEach-Object { ([string]$_) -replace '://[^@/\s]+@', '://<PAT>@' }
    return [pscustomobject]@{ Ok = ($LASTEXITCODE -eq 0); Salida = $salida }
  }
  finally { $ErrorActionPreference = $prev }
}

Write-Host ("=== {0} - rama de trabajo: {1} ===" -f $mesa.mesa, $mesa.ramaTrabajo) -ForegroundColor Cyan

$filas = @()
foreach ($r in $mesa.repos) {
  $d = Join-Path $raiz "repos\$($r.carpeta)"
  if (-not (Test-Path (Join-Path $d '.git'))) {
    $filas += [pscustomobject]@{ Repo=$r.carpeta; Rama='(sin clonar)'; Base='-'; HEAD='-'; Upstream='-'; Sucios='-'; Origin='-' }
    continue
  }

  $rama  = (Invoke-Git @('-C', $d, 'rev-parse', '--abbrev-ref', 'HEAD')).Salida
  $head  = (Invoke-Git @('-C', $d, 'rev-parse', '--short', 'HEAD')).Salida
  $dirty = @((Invoke-Git @('-C', $d, 'status', '--porcelain')).Salida | Where-Object { $_ })

  $up = Invoke-Git @('-C', $d, 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}')
  if (-not $up.Ok -or -not $up.Salida) { $estadoUp = 'solo local' }
  else {
    $c = ((Invoke-Git @('-C', $d, 'rev-list', '--left-right', '--count', "$($up.Salida)...HEAD")).Salida -split '\s+')
    $behind = [int]$c[0]; $ahead = [int]$c[1]
    $estadoUp = if ($ahead -eq 0 -and $behind -eq 0) { 'al dia' }
                elseif ($behind -eq 0) { "+$ahead sin pushear" }
                elseif ($ahead -eq 0) { "-$behind atras" }
                else { "+$ahead/-$behind divergida" }
  }

  $urlOrigin = (Invoke-Git @('-C', $d, 'remote', 'get-url', 'origin')).Salida
  $esperado = "$($r.org)/$($r.proyecto)/_git/$($r.repo)"
  $okOrigin = if ($urlOrigin -and ([string]$urlOrigin).EndsWith($esperado)) { 'vivo OK' } else { 'REVISAR' }

  $filas += [pscustomobject]@{
    Repo     = $r.carpeta
    Rama     = $rama
    Base     = if ($r.ramaBase) { $r.ramaBase } else { '(sin elegir)' }
    HEAD     = $head
    Upstream = $estadoUp
    Sucios   = $dirty.Count
    Origin   = $okOrigin
  }

  if ($Sucios -and $dirty.Count -gt 0) {
    Write-Host ""
    Write-Host ("--- sucios en {0} ({1}) ---" -f $r.carpeta, $dirty.Count) -ForegroundColor Yellow
    $dirty | ForEach-Object { Write-Host "  $_" }
  }
}

Write-Host ""
$filas | Format-Table -AutoSize

$revisar = @($filas | Where-Object { $_.Origin -eq 'REVISAR' })
if ($revisar.Count -gt 0) {
  Write-Host ""
  Write-Host "AVISO: origin no coincide con el repo vivo del manifiesto en:" -ForegroundColor Red
  $revisar | ForEach-Object { Write-Host ("  - {0}" -f $_.Repo) }
  Write-Host "Un 'git push origin' aqui puede subir el trabajo al repo equivocado. Verificalo antes."
}

$sinPush = @($filas | Where-Object { $_.Upstream -like '*sin pushear*' -or $_.Upstream -eq 'solo local' })
if ($sinPush.Count -gt 0) {
  Write-Host ""
  Write-Host "Trabajo que solo existe en este disco:" -ForegroundColor Yellow
  $sinPush | ForEach-Object { Write-Host ("  - {0}: {1}" -f $_.Repo, $_.Upstream) }
}
