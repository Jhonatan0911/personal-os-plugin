<#
.SYNOPSIS
  Clona los repos de MESA.json, lista sus ramas para que elijas la base, y crea la rama de trabajo.

.DESCRIPTION
  Trabaja en TRES fases, a proposito: la rama base NUNCA se adivina, la escoge el usuario
  viendo las ramas que existen de verdad en el servidor.

    -Fase clonar   clona cada repo en repos/<carpeta> y normaliza remotes (origin = vivo,
                   legacy = org antigua). Deja cada repo en la rama default del servidor y
                   NO crea ninguna rama. Al terminar lista las ramas de cada repo.
    -Fase ramas    git fetch --prune + listado de ramas remotas por repo (ultimo commit,
                   fecha y autor), para escoger. No modifica nada.
    -Fase rama     con la ramaBase ya escrita en MESA.json por cada repo: checkout de esa
                   base y creacion de la rama de trabajo desde ahi. Falla en voz alta si
                   algun repo no tiene ramaBase elegida.

  El PAT NUNCA se imprime: toda la salida pasa por un enmascarado. Tampoco se escribe en
  ningun archivo distinto de .git/config (que es donde el equipo lo mantiene a proposito).
  Antes de clonar los N repos verifica el PAT con un ls-remote contra el primero, para no
  fallar N veces con un token vencido.

  Nota tecnica: todas las llamadas a git pasan por Invoke-Git(), que baja
  ErrorActionPreference a Continue mientras corre. En Windows PowerShell 5.1 redirigir el
  stderr de un ejecutable nativo (2>&1) con EAP=Stop aborta el script aunque git haya
  terminado bien: git escribe en stderr mensajes normales como "Switched to a new branch".
  La funcion NO puede llamarse Git ni git: PowerShell resuelve los nombres sin distinguir
  mayusculas y las funciones ganan a los ejecutables, asi que '& git' dentro de una funcion
  llamada Git se llama a si misma para siempre. Por eso el nombre Invoke-Git y el '& git.exe'.

.EXAMPLE
  # Via preferida: ejecutalo tu mismo, asi el token no queda en la transcripcion del chat.
  .\scripts\mesa-clonar.ps1 -Fase clonar
  .\scripts\mesa-clonar.ps1 -Fase rama      # despues de elegir las ramas base

.EXAMPLE
  .\scripts\mesa-clonar.ps1 -Fase ramas -Top 40    # ver mas ramas de cada repo
#>
[CmdletBinding()]
param(
  [ValidateSet('clonar','ramas','rama')]
  [string]$Fase = 'clonar',
  [string]$Manifiesto = "$PSScriptRoot\..\MESA.json",
  [string]$Pat,
  [int]$Top = 25,
  [string[]]$Repos,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $Manifiesto)) { throw "No existe el manifiesto: $Manifiesto" }
$mesa = Get-Content $Manifiesto -Raw -Encoding UTF8 | ConvertFrom-Json
$raiz = Split-Path (Resolve-Path $Manifiesto) -Parent
$reposDir = Join-Path $raiz 'repos'
$lista = if ($Repos) { $mesa.repos | Where-Object { $Repos -contains $_.carpeta } } else { $mesa.repos }
if (-not $lista) { throw "Ningun repo coincide con -Repos." }

Write-Host "=================== mesa-clonar ($Fase) ===================" -ForegroundColor Cyan
Write-Host ("Mesa          : {0}" -f $mesa.mesa)
Write-Host ("Rama trabajo  : {0}" -f $mesa.ramaTrabajo)
Write-Host ("Repos         : {0}" -f @($lista).Count)
Write-Host "-----------------------------------------------------------"

function Mask([string]$texto) {
  if (-not $texto) { return $texto }
  $t = $texto
  if ($Pat) { $t = $t.Replace($Pat, '<PAT>') }
  return ($t -replace '://[^@/\s]+@', '://<PAT>@')
}
function Url($org, $proyecto, $repo) {
  $tok = if ($Pat) { [uri]::EscapeDataString($Pat) } else { '<PAT>' }
  return "https://${tok}@dev.azure.com/$org/$proyecto/_git/$repo"
}
function Invoke-Git([string[]]$Argumentos) {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $salida = & git.exe @Argumentos 2>&1 | ForEach-Object { Mask ([string]$_) }
    return [pscustomobject]@{ Ok = ($LASTEXITCODE -eq 0); Codigo = $LASTEXITCODE; Salida = $salida }
  }
  finally { $ErrorActionPreference = $prev }
}
function Ramas([string]$dir) {
  # refname completo (no :short): con :short, origin/HEAD se abrevia a "origin" y se cuela como rama.
  $fmt = '%(refname)|%(committerdate:short)|%(authorname)|%(objectname:short)|%(contents:subject)'
  $res = Invoke-Git @('-C', $dir, 'for-each-ref', '--sort=-committerdate', "--format=$fmt", 'refs/remotes/origin')
  $res.Salida | Where-Object { $_ -and $_ -notmatch '^refs/remotes/origin/HEAD\|' } | ForEach-Object {
    $p = $_ -split '\|', 5
    [pscustomobject]@{
      Rama   = $p[0] -replace '^refs/remotes/origin/', ''
      Fecha  = $p[1]
      Autor  = $p[2]
      Commit = $p[3]
      Asunto = if ($p[4].Length -gt 60) { $p[4].Substring(0,57) + '...' } else { $p[4] }
    }
  }
}
function MostrarRamas($r, [string]$dir) {
  $todas = @(Ramas $dir)
  $def = (Invoke-Git @('-C', $dir, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD')).Salida -replace '^origin/', ''
  Write-Host ""
  Write-Host ("### {0} - {1} rama(s) en el servidor{2}" -f $r.carpeta, $todas.Count,
              $(if ($def) { " | default: $def" } else { '' })) -ForegroundColor Yellow
  $todas | Select-Object -First $Top | Format-Table -AutoSize
  if ($todas.Count -gt $Top) { Write-Host ("  ... y {0} mas (usa -Top {1})" -f ($todas.Count - $Top), $todas.Count) }
}
function EsRepo([string]$dir) { return (Test-Path (Join-Path $dir '.git')) }

# ============================ FASE: ramas ============================
if ($Fase -eq 'ramas') {
  foreach ($r in $lista) {
    $d = Join-Path $reposDir $r.carpeta
    if (-not (EsRepo $d)) { Write-Host ("### {0}: sin clonar" -f $r.carpeta) -ForegroundColor Red; continue }
    Invoke-Git @('-C', $d, 'fetch', '--prune', '--quiet') | Out-Null
    MostrarRamas $r $d
  }
  Write-Host ""
  Write-Host "Elige la rama BASE de cada repo y escribela en MESA.json (campo ramaBase)." -ForegroundColor Cyan
  Write-Host "Luego: .\scripts\mesa-clonar.ps1 -Fase rama"
  return
}

# ============================ FASE: clonar ============================
if ($Fase -eq 'clonar') {
  if (-not $DryRun) {
    if (-not $Pat) { $Pat = $env:AZDO_PAT }
    if (-not $Pat) {
      $sec = Read-Host -Prompt 'PAT de Azure DevOps (no se muestra ni se guarda)' -AsSecureString
      $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
      try { $Pat = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
      finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    }
    if (-not $Pat) { throw "Sin PAT no se puede clonar." }

    $p = @($lista)[0]
    Write-Host ("Verificando PAT contra {0}/{1} ..." -f $p.proyecto, $p.repo) -NoNewline
    $probe = Invoke-Git @('ls-remote', '--heads', (Url $p.org $p.proyecto $p.repo))
    if (-not $probe.Ok) {
      Write-Host " FALLO" -ForegroundColor Red
      $probe.Salida | ForEach-Object { Write-Host "  $_" }
      throw "El PAT no autentica (o el repo no existe). No se clono nada."
    }
    Write-Host " OK" -ForegroundColor Green
  }

  if (-not (Test-Path $reposDir) -and -not $DryRun) { New-Item -ItemType Directory $reposDir | Out-Null }

  $resumen = @()
  foreach ($r in $lista) {
    $destino = Join-Path $reposDir $r.carpeta
    $urlViva = Url $r.org $r.proyecto $r.repo
    Write-Host ""
    Write-Host ("### {0}  ->  {1}/{2}" -f $r.carpeta, $r.proyecto, $r.repo) -ForegroundColor Yellow

    if ($DryRun) {
      Write-Host ("  [DryRun] git clone {0} {1}" -f (Mask $urlViva), $destino)
      $resumen += [pscustomobject]@{ Repo = $r.carpeta; Estado = '[DryRun]'; Default = '-' }
      continue
    }

    if (EsRepo $destino) {
      Write-Host "  ya existe: no se re-clona, solo se revisan remotes."
    }
    else {
      # Sin --branch: se queda en la rama default del servidor. La BASE la elige el usuario despues.
      Write-Host "  clonando..."
      $cl = Invoke-Git @('clone', $urlViva, $destino)
      if (-not $cl.Ok) {
        $cl.Salida | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
        $resumen += [pscustomobject]@{ Repo = $r.carpeta; Estado = 'FALLO clone'; Default = '-' }
        continue
      }
    }

    # ---- origin = vivo ----
    $actual = (Invoke-Git @('-C', $destino, 'remote', 'get-url', 'origin')).Salida
    if ($actual -ne $urlViva) { Invoke-Git @('-C', $destino, 'remote', 'set-url', 'origin', $urlViva) | Out-Null }

    # ---- legacy = org antigua (si el manifiesto la declara) ----
    if ($r.legacy) {
      $urlLegacy = Url $r.legacy.org $r.legacy.proyecto $r.legacy.repo
      $tiene = (Invoke-Git @('-C', $destino, 'remote')).Salida -contains 'legacy'
      $accion = if ($tiene) { 'set-url' } else { 'add' }
      Invoke-Git @('-C', $destino, 'remote', $accion, 'legacy', $urlLegacy) | Out-Null
      Write-Host "  remotes: origin = vivo | legacy = org antigua"
    } else {
      Write-Host "  remotes: origin = vivo (sin legacy)"
    }

    Invoke-Git @('-C', $destino, 'fetch', '--prune', '--quiet') | Out-Null
    $def = (Invoke-Git @('-C', $destino, 'rev-parse', '--abbrev-ref', 'HEAD')).Salida
    $n = @(Ramas $destino).Count
    Write-Host ("  OK - en la rama default '{0}' | {1} rama(s) en el servidor" -f $def, $n) -ForegroundColor Green
    $resumen += [pscustomobject]@{ Repo = $r.carpeta; Estado = 'clonado'; Default = $def }
  }

  Write-Host ""
  Write-Host "=================== ramas disponibles ===================" -ForegroundColor Cyan
  foreach ($r in $lista) {
    $d = Join-Path $reposDir $r.carpeta
    if (EsRepo $d) { MostrarRamas $r $d }
  }

  Write-Host ""
  $resumen | Format-Table -AutoSize
  Write-Host "NINGUNA rama de trabajo fue creada todavia." -ForegroundColor Yellow
  Write-Host "Elige la rama BASE de cada repo, escribela en MESA.json (campo ramaBase) y corre:"
  Write-Host "  .\scripts\mesa-clonar.ps1 -Fase rama"
  return
}

# ============================ FASE: rama ============================
$rama = $mesa.ramaTrabajo
if (-not $rama) { throw "El manifiesto no declara ramaTrabajo." }

$sinBase = @($lista | Where-Object { -not $_.ramaBase })
if ($sinBase.Count -gt 0) {
  Write-Host "BLOQUEADO: estos repos no tienen ramaBase elegida en MESA.json:" -ForegroundColor Red
  $sinBase | ForEach-Object { Write-Host ("  - {0}" -f $_.carpeta) }
  Write-Host "Corre '-Fase ramas' para ver las opciones y escribe la elegida en cada repo."
  throw "Falta elegir la rama base. La rama de trabajo NUNCA se crea de una base adivinada."
}

$resumen = @()
foreach ($r in $lista) {
  $d = Join-Path $reposDir $r.carpeta
  Write-Host ""
  Write-Host ("### {0} - base: {1}" -f $r.carpeta, $r.ramaBase) -ForegroundColor Yellow
  if (-not (EsRepo $d)) {
    Write-Host "  sin clonar" -ForegroundColor Red
    $resumen += [pscustomobject]@{ Repo=$r.carpeta; Base=$r.ramaBase; Rama='-'; Estado='sin clonar' }
    continue
  }

  Invoke-Git @('-C', $d, 'fetch', '--prune', '--quiet') | Out-Null
  $remotas = @(Ramas $d)

  # La base tiene que EXISTIR en el servidor. Si no, se para: no se inventa un punto de partida.
  if (@($remotas | Where-Object { $_.Rama -eq $r.ramaBase }).Count -eq 0) {
    Write-Host ("  la rama base '{0}' no existe en origin. Revisa MESA.json." -f $r.ramaBase) -ForegroundColor Red
    $resumen += [pscustomobject]@{ Repo=$r.carpeta; Base=$r.ramaBase; Rama='-'; Estado='base inexistente' }
    continue
  }

  if ($DryRun) {
    Write-Host ("  [DryRun] checkout {0} y crear {1} desde ahi" -f $r.ramaBase, $rama)
    $resumen += [pscustomobject]@{ Repo=$r.carpeta; Base=$r.ramaBase; Rama=$rama; Estado='[DryRun]' }
    continue
  }

  # Trabajar directamente sobre la base, sin rama nueva.
  if ($rama -eq $r.ramaBase) {
    Invoke-Git @('-C', $d, 'checkout', $r.ramaBase) | Out-Null
    $head = (Invoke-Git @('-C', $d, 'rev-parse', '--short', 'HEAD')).Salida
    Write-Host ("  se trabaja directo sobre '{0}' @ {1}" -f $r.ramaBase, $head) -ForegroundColor Green
    $resumen += [pscustomobject]@{ Repo=$r.carpeta; Base=$r.ramaBase; Rama=$r.ramaBase; Estado="directo $head" }
    continue
  }

  # Trampa: si existe un ref '<prefijo>/<mesa>' a secas, git rechaza crear '<prefijo>/<mesa>/qa'.
  $partes = $rama -split '/'
  if ($partes.Count -gt 1) {
    $padre = ($partes[0..($partes.Count - 2)]) -join '/'
    if (@($remotas | Where-Object { $_.Rama -eq $padre }).Count -gt 0) {
      Write-Host ("  COLISION: existe el ref '{0}' a secas; git no admite crear '{1}'." -f $padre, $rama) -ForegroundColor Red
      Write-Host  "  Renombra el viejo a '$padre-legacy' (mismo commit) y vuelve a correr esta fase."
      $resumen += [pscustomobject]@{ Repo=$r.carpeta; Base=$r.ramaBase; Rama='-'; Estado='COLISION de ref' }
      continue
    }
  }

  $co = Invoke-Git @('-C', $d, 'checkout', $r.ramaBase)
  if (-not $co.Ok) { Invoke-Git @('-C', $d, 'checkout', '-t', "origin/$($r.ramaBase)") | Out-Null }

  if ((Invoke-Git @('-C', $d, 'branch', '--list', $rama)).Salida) {
    Write-Host ("  la rama '{0}' ya existe en local: solo checkout (no se recrea)." -f $rama)
    Invoke-Git @('-C', $d, 'checkout', $rama) | Out-Null
  } else {
    $nueva = Invoke-Git @('-C', $d, 'checkout', '-b', $rama)
    if (-not $nueva.Ok) {
      $nueva.Salida | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
      $resumen += [pscustomobject]@{ Repo=$r.carpeta; Base=$r.ramaBase; Rama='-'; Estado='FALLO checkout -b' }
      continue
    }
  }

  $ramaFinal = (Invoke-Git @('-C', $d, 'rev-parse', '--abbrev-ref', 'HEAD')).Salida
  $head = (Invoke-Git @('-C', $d, 'rev-parse', '--short', 'HEAD')).Salida
  Write-Host ("  {0} @ {1}  (desde {2})" -f $ramaFinal, $head, $r.ramaBase) -ForegroundColor Green
  $resumen += [pscustomobject]@{ Repo=$r.carpeta; Base=$r.ramaBase; Rama=$ramaFinal; Estado="OK $head" }
}

Write-Host ""
Write-Host "=================== resumen ===================" -ForegroundColor Cyan
$resumen | Format-Table -AutoSize
Write-Host "Siguiente: .\scripts\mesa-status.ps1"
Write-Host ""
Write-Host "Empuja la rama de trabajo el mismo dia que la creas:" -ForegroundColor Yellow
Write-Host ("  git -C repos\<repo> push -u origin {0}" -f $mesa.ramaTrabajo)
Write-Host "RECORDATORIO: los appsettings/environment recien clonados NO apuntan a TEST." -ForegroundColor Yellow
Write-Host "Re-apuntalos a mano antes de levantar nada. Esos sucios permanentes no se commitean."
