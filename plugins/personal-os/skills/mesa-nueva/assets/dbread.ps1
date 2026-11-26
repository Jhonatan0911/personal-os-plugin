<#
.SYNOPSIS
  Lector SOLO LECTURA contra la BD de TEST de esta mesa.

.DESCRIPTION
  Lee la cadena de conexion ACTIVA (no comentada con //) del appsettings.json indicado,
  la decodifica de Base64 y ejecuta la consulta con sqlcmd, imponiendo guardas de solo lectura.
  NUNCA imprime la contrasena. Bloquea escrituras/DDL y EXEC (las escrituras van por
  bd-ejecutar.py), exige TOP(N) en SELECT, usa READ UNCOMMITTED y timeouts cortos.

  Permisos (D-072): si el servidor y el catalogo estan registrados en Config > Bases de datos del
  Personal OS (<OS_HOME>/conexiones-bd.json), manda su permiso de Leer: bloqueado = no se consulta;
  me pregunta / automatico = se permite (el guardia de Claude Code pide el OK cuando toca). Si no
  estan registrados, solo se permite un catalogo que contenga 'test' o 'prueba'. Un servidor de
  produccion de las reglas de la organizacion (guardia-empresa.json -> servidores_deny) se bloquea
  siempre: gana la regla mas estricta.

  Regla de uso (politica global del usuario): antes de CADA consulta se muestra el destino con
  -DryRun y se espera OK explicito. Una aprobacion no cubre la siguiente.

.EXAMPLE
  scripts\dbread.ps1 -ConfirmDb <catalogo_test> -Query "SELECT TOP(10) * FROM <tabla>" -DryRun
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$ConfirmDb,
  [Parameter(Mandatory = $true)][string]$Query,
  [string]$AppSettings,
  [string]$ClaveConexion = 'ConexionSQL',
  [switch]$DryRun,
  [switch]$AllowNoTop,
  [switch]$AllowExec,
  [int]$LoginTimeout = 5,
  [int]$QueryTimeout = 30
)

# PS 5.1: $PSScriptRoot puede llegar vacio en los defaults de param(); se resuelve aqui.
if (-not $AppSettings) {
  $dirScript = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
  $AppSettings = Join-Path $dirScript '..\__APPSETTINGS_DEFAULT__'
}

$ErrorActionPreference = 'Stop'

# ---- 1) Leer cadena de conexion ACTIVA (ignorar comentadas //) ----
if (-not (Test-Path $AppSettings)) { throw "No existe appsettings: $AppSettings" }
$activo = $null
foreach ($line in Get-Content $AppSettings) {
  if ($line.TrimStart().StartsWith('//')) { continue }
  if ($line -match ('"' + [regex]::Escape($ClaveConexion) + '"\s*:\s*"([^"]+)"')) { $activo = $Matches[1]; break }
}
if (-not $activo) { throw "No se encontro una '$ClaveConexion' activa en $AppSettings" }
if ($activo -match '(?i)(data source|server)\s*=') { $cs = $activo.Trim() }
else { $cs = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($activo)).Trim() }

function Get-CsPart([string]$conn, [string[]]$keys) {
  foreach ($p in $conn.Split(';')) {
    $kv = $p.Split('=', 2)
    if ($kv.Count -eq 2) {
      $k = $kv[0].Trim().ToLower()
      foreach ($key in $keys) { if ($k -eq $key.ToLower()) { return $kv[1].Trim() } }
    }
  }
  return $null
}
$server  = Get-CsPart $cs @('data source', 'server')
$catalog = Get-CsPart $cs @('initial catalog', 'database')
$user    = Get-CsPart $cs @('user id', 'uid')
$pass    = Get-CsPart $cs @('password', 'pwd')

# ---- 2) Validaciones de DESTINO: reglas de la organizacion y permisos de la consola (D-072) ----
if (-not $catalog) { throw "No se pudo leer el catalogo de la cadena activa." }
function Get-HostPart([string]$s) {
  $h = ([string]$s).Trim().ToLower()
  if ($h.StartsWith('tcp:')) { $h = $h.Substring(4) }
  return ($h -split '[,\\:]')[0].Trim()
}
function Read-JsonFile([string]$ruta) {
  if (-not $ruta -or -not (Test-Path $ruta)) { return $null }
  try { return (Get-Content $ruta -Raw -Encoding UTF8 | ConvertFrom-Json) } catch { return $null }
}
$osHome = if ($env:PERSONAL_OS_HOME) { $env:PERSONAL_OS_HOME } else { Join-Path $HOME '.claude\personal-os' }
$hostDestino = Get-HostPart $server
$conexion = $null; $modoLeer = $null
$registro = Read-JsonFile (Join-Path $osHome 'conexiones-bd.json')
if ($registro) {
  foreach ($c in @($registro.conexiones)) {
    $d = Read-JsonFile $c.archivo
    if (-not $d) { continue }
    if ((Get-HostPart $d.servidor) -ne $hostDestino) { continue }
    if (@($d.catalogos) -notcontains $catalog) { continue }
    $conexion = if ($c.nombre) { $c.nombre } else { $c.id }
    if ($d.permisos -and @('bloqueado', 'preguntar', 'automatico') -contains $d.permisos.leer) { $modoLeer = $d.permisos.leer }
    elseif ($d.modo_lectura -eq 'automatico') { $modoLeer = 'automatico' }
    else { $modoLeer = 'preguntar' }
    break
  }
}
# D-073: una conexion registrada la gobierna la consola; un servidor de produccion sin registrar, la organizacion.
$reglasOrg = Read-JsonFile (Join-Path $osHome 'guardia-empresa.json')
if (-not $conexion -and $reglasOrg) {
  foreach ($h in @($reglasOrg.servidores_deny)) {
    if ($h -and (Get-HostPart $h) -eq $hostDestino) { throw "BLOQUEADO: $hostDestino es un servidor de produccion segun las reglas de la organizacion (no esta registrado en Config > Bases de datos)." }
  }
}
if ($conexion) {
  if ($modoLeer -eq 'bloqueado') { throw "BLOQUEADO: leer en la conexion '$conexion' esta bloqueado en Config > Bases de datos." }
} elseif ($catalog -notmatch '(?i)(test|prueba)') {
  throw "BLOQUEADO: el catalogo '$catalog' no esta registrado en Config > Bases de datos y no contiene 'test' ni 'prueba'."
}
if ($ConfirmDb -ne $catalog) { throw "BLOQUEADO: -ConfirmDb '$ConfirmDb' no coincide con el catalogo activo '$catalog'." }

# ---- 3) Validaciones de la CONSULTA (solo lectura) ----
$forbidden = '(?i)\b(INSERT|UPDATE|DELETE|MERGE|TRUNCATE|DROP|ALTER|CREATE|GRANT|REVOKE|BACKUP|RESTORE|xp_cmdshell|OPENROWSET|OPENQUERY|BULK)\b'
if ($Query -match $forbidden) { throw "BLOQUEADO: dbread solo lee. Para escribir, deja el plan y correlo con bd-ejecutar.py (permiso de la consola, transaccion y rollback)." }
if ($Query -match '(?i)\bSELECT\b[\s\S]*\bINTO\b') { throw "BLOQUEADO: 'SELECT ... INTO' no permitido." }
if ($AllowExec) { throw "BLOQUEADO: -AllowExec ya no existe. Los procedimientos se corren con bd-ejecutar.py (accion Ejecutar de la consola)." }
if ($Query -match '(?i)\bEXEC(UTE)?\b') { throw "BLOQUEADO: dbread no corre EXEC (puede escribir). Para ver un SP usa OBJECT_DEFINITION; para correrlo, bd-ejecutar.py." }
if (($Query -match '(?i)\bSELECT\b') -and ($Query -notmatch '(?i)\bTOP\s*\(') -and -not $AllowNoTop) { throw "BLOQUEADO: todo SELECT debe usar TOP(N). Usa -AllowNoTop solo si el usuario lo pide para esa consulta." }

# ---- 4) Mostrar DESTINO (sin password) ----
Write-Host "==================== dbread (SOLO LECTURA) ===================="
Write-Host ("Servidor : {0}" -f $server)
Write-Host ("Catalogo : {0}" -f $catalog)
Write-Host ("Usuario  : {0}" -f $user)
if ($conexion) { Write-Host ("Permiso  : conexion '{0}' - leer {1}" -f $conexion, $modoLeer) }
else { Write-Host "Permiso  : no registrada en la consola - solo TEST" }
Write-Host ("Aisl.    : READ UNCOMMITTED | login {0}s | query {1}s" -f $LoginTimeout, $QueryTimeout)
Write-Host "--------------------------------------------------------------"
Write-Host $Query
Write-Host "=============================================================="

if ($DryRun) { Write-Host "[DryRun] No se ejecuto nada. Confirma el destino antes de ejecutar."; return }

if (-not (Get-Command sqlcmd -ErrorAction SilentlyContinue)) { throw "sqlcmd no esta instalado o no esta en PATH." }

# ---- 5) Ejecutar con READ UNCOMMITTED; password por variable de entorno (no en cmdline) ----
$batch = "SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;`r`n$Query"
$env:SQLCMDPASSWORD = $pass
try {
  & sqlcmd -S $server -d $catalog -U $user -l $LoginTimeout -t $QueryTimeout -b -y 0 -Q $batch
}
finally {
  Remove-Item Env:\SQLCMDPASSWORD -ErrorAction SilentlyContinue
}
