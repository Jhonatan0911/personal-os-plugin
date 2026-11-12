<#
.SYNOPSIS
  Lector SOLO LECTURA contra la BD de TEST de esta mesa.

.DESCRIPTION
  Lee la cadena de conexion ACTIVA (no comentada con //) del appsettings.json indicado,
  la decodifica de Base64 y ejecuta la consulta con sqlcmd, imponiendo guardas de solo lectura.
  NUNCA imprime la contrasena. Bloquea escrituras/DDL, exige TOP(N) en SELECT, bloquea EXEC,
  usa READ UNCOMMITTED y timeouts cortos. Ver las "Reglas de acceso a la base de datos" en el CLAUDE.md.

  Regla de uso (politica global del usuario): antes de CADA consulta se muestra el destino con
  -DryRun y se espera OK explicito. Una aprobacion no cubre la siguiente.

.EXAMPLE
  scripts\dbread.ps1 -ConfirmDb <catalogo_test> -Query "SELECT TOP(10) * FROM <tabla>" -DryRun
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$ConfirmDb,
  [Parameter(Mandatory = $true)][string]$Query,
  [string]$AppSettings = "$PSScriptRoot\..\__APPSETTINGS_DEFAULT__",
  [string]$ClaveConexion = 'ConexionSQL',
  [switch]$DryRun,
  [switch]$AllowNoTop,
  [switch]$AllowExec,
  [int]$LoginTimeout = 5,
  [int]$QueryTimeout = 30
)

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

# ---- 2) Validaciones de DESTINO ----
if (-not $catalog) { throw "No se pudo leer el catalogo de la cadena activa." }
if ($catalog -notmatch '(?i)(test|prueba)') { throw "BLOQUEADO: el catalogo activo '$catalog' no contiene 'test' ni 'prueba'. Solo se permite TEST." }
if ($ConfirmDb -ne $catalog) { throw "BLOQUEADO: -ConfirmDb '$ConfirmDb' no coincide con el catalogo activo '$catalog'." }

# ---- 3) Validaciones de la CONSULTA (solo lectura) ----
$forbidden = '(?i)\b(INSERT|UPDATE|DELETE|MERGE|TRUNCATE|DROP|ALTER|CREATE|GRANT|REVOKE|BACKUP|RESTORE|xp_cmdshell|OPENROWSET|OPENQUERY|BULK)\b'
if ($Query -match $forbidden) { throw "BLOQUEADO: la consulta contiene una operacion de escritura/DDL no permitida (solo lectura)." }
if ($Query -match '(?i)\bSELECT\b[\s\S]*\bINTO\b') { throw "BLOQUEADO: 'SELECT ... INTO' no permitido." }
if (($Query -match '(?i)\bEXEC(UTE)?\b') -and -not $AllowExec) { throw "BLOQUEADO: EXEC deshabilitado. Para ver un SP usa OBJECT_DEFINITION; EXEC solo con -AllowExec y permiso explicito." }
if (($Query -match '(?i)\bSELECT\b') -and ($Query -notmatch '(?i)\bTOP\s*\(') -and -not $AllowNoTop) { throw "BLOQUEADO: todo SELECT debe usar TOP(N). Usa -AllowNoTop solo si el usuario lo pide para esa consulta." }

# ---- 4) Mostrar DESTINO (sin password) ----
Write-Host "==================== dbread (SOLO LECTURA) ===================="
Write-Host ("Servidor : {0}" -f $server)
Write-Host ("Catalogo : {0}" -f $catalog)
Write-Host ("Usuario  : {0}" -f $user)
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
