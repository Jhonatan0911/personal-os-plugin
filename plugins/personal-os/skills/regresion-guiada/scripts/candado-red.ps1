<#
.SYNOPSIS
  Candado de red de la regresión guiada (opcional, el más hermético):
  ninguna petición sale del equipo salvo a localhost; lo único externo permitido son las
  conexiones de BASE DE DATOS a los hosts de staging, por sus puertos.

.DESCRIPTION
  Crea reglas de SALIDA de tipo BLOQUEO en el Firewall de Windows (grupo "RegresionGuiada") para los
  procesos de la regresión:
    - dotnet.exe, iisexpress.exe (x64 y x86)
    - <mesa>\kit\bin\node-regresion.exe (copia de node solo para la regresión: relevo, fronts, scripts)
    - cada .exe compilado dentro de <mesa>\repos (apphost de .NET, Chromium de PuppeteerSharp, etc.)
    - los que se agreguen en <mesa>\kit\candado.json -> "programas"
  Regla 1 por proceso: bloquea toda IPv4 salvo 127.0.0.0/8 y los hosts de staging; bloquea toda IPv6 salvo ::1.
  Regla 2 por proceso: hacia los hosts de staging, bloquea todos los puertos TCP salvo staging_puertos, y todo UDP.
  Las reglas de bloqueo ganan a cualquier regla de permiso.

  Hay que volver a correrlo DESPUÉS de compilar los repos (para incluir los .exe nuevos).
  No toca node.exe del sistema (lo usan hooks y otras herramientas): la regresión usa node-regresion.exe.

.PARAMETER Mesa      Carpeta de la mesa (por defecto, la variable REGRESION_MESA o la carpeta actual).
.PARAMETER Quitar    Borra todas las reglas del grupo RegresionGuiada (cierre de la regresión).
.PARAMETER Verificar Solo comprueba: reglas activas, perfiles del firewall y una prueba real de salida.

.EXAMPLE
  # PowerShell como administrador:
  powershell -ExecutionPolicy Bypass -File candado-red.ps1 -Mesa C:\...\<mesa>
#>
param([string]$Mesa = $(if ($env:REGRESION_MESA) { $env:REGRESION_MESA } else { (Get-Location).Path }),
      [switch]$Quitar, [switch]$Verificar)
$ErrorActionPreference = 'Stop'
$Grupo = 'RegresionGuiada'

function Es-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }

function IpANum([string]$ip) { $b = ([Net.IPAddress]::Parse($ip)).GetAddressBytes(); [uint32](([uint32]$b[0] -shl 24) -bor ([uint32]$b[1] -shl 16) -bor ([uint32]$b[2] -shl 8) -bor [uint32]$b[3]) }
function NumAIp([uint32]$n) { '{0}.{1}.{2}.{3}' -f (($n -shr 24) -band 255), (($n -shr 16) -band 255), (($n -shr 8) -band 255), ($n -band 255) }

# Complemento de los rangos excluidos dentro de 0.0.0.1 - 255.255.255.255
function Complemento-IPv4($excluidos) {
  $rangos = $excluidos | Sort-Object { $_[0] }
  $out = @(); [double]$desde = 1
  foreach ($r in $rangos) {
    if ([double]$r[0] -gt $desde) { $out += ('{0}-{1}' -f (NumAIp ([uint32]$desde)), (NumAIp ([uint32]([double]$r[0] - 1)))) }
    if ([double]$r[1] + 1 -gt $desde) { $desde = [double]$r[1] + 1 }
  }
  if ($desde -le [double][uint32]::MaxValue) { $out += ('{0}-255.255.255.255' -f (NumAIp ([uint32]$desde))) }
  $out
}
function Complemento-Puertos($puertos) {
  $p = $puertos | ForEach-Object { [int]$_ } | Sort-Object -Unique; $out = @(); $desde = 1
  foreach ($x in $p) { if ($x -gt $desde) { $out += ('{0}-{1}' -f $desde, ($x - 1)) }; $desde = $x + 1 }
  if ($desde -le 65535) { $out += ('{0}-65535' -f $desde) }
  $out
}

function Leer-Staging {
  $f = Join-Path $Mesa 'kit\hosts-permitidos.json'
  if (-not (Test-Path $f)) { throw "No existe $f" }
  $j = Get-Content $f -Raw -Encoding UTF8 | ConvertFrom-Json
  $ips = @()
  foreach ($h in @($j.staging)) {
    if (-not $h) { continue }
    try { $ips += [Net.Dns]::GetHostAddresses([string]$h) | Where-Object { $_.AddressFamily -eq 'InterNetwork' } | ForEach-Object { $_.IPAddressToString } }
    catch { throw "No resuelve el host de staging '$h'" }
  }
  $puertos = @($j.staging_puertos); if (-not $puertos -or -not $puertos[0]) { $puertos = @(1433, 27017) }
  [pscustomobject]@{ Ips = @($ips | Sort-Object -Unique); Puertos = $puertos }
}

function Programas {
  $lista = New-Object System.Collections.Generic.List[string]
  foreach ($p in @("$env:ProgramFiles\dotnet\dotnet.exe", "$env:ProgramFiles\IIS Express\iisexpress.exe", "${env:ProgramFiles(x86)}\IIS Express\iisexpress.exe")) { if (Test-Path $p) { $lista.Add($p) } }
  $nodeReg = Join-Path $Mesa 'kit\bin\node-regresion.exe'
  if (-not (Test-Path $nodeReg)) {
    $nodeSis = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
    if ($nodeSis) { New-Item -ItemType Directory -Force (Split-Path $nodeReg) | Out-Null; Copy-Item $nodeSis $nodeReg }
  }
  if (Test-Path $nodeReg) { $lista.Add($nodeReg) }
  $repos = Join-Path $Mesa 'repos'
  if (Test-Path $repos) { Get-ChildItem $repos -Recurse -Filter *.exe -File -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch '\\(node_modules|\.git)\\' } | ForEach-Object { $lista.Add($_.FullName) } }
  $extra = Join-Path $Mesa 'kit\candado.json'
  if (Test-Path $extra) { foreach ($p in @((Get-Content $extra -Raw -Encoding UTF8 | ConvertFrom-Json).programas)) { if ($p -and (Test-Path $p)) { $lista.Add($p) } } }
  $lista | Sort-Object -Unique
}

function Probar-Salida($staging) {
  $nodeReg = Join-Path $Mesa 'kit\bin\node-regresion.exe'
  if (-not (Test-Path $nodeReg)) { return 'SIN PRUEBA: falta kit\bin\node-regresion.exe' }
  $js = @'
const net=require('net');const [,,ip,puerto]=process.argv;
function tcp(h,p){return new Promise(r=>{const s=net.connect({host:h,port:+p});const t=setTimeout(()=>{s.destroy();r('timeout')},6000);s.on('connect',()=>{clearTimeout(t);s.end();r('abre')});s.on('error',e=>{clearTimeout(t);r(e.code||'error')})})}
(async()=>{const ext=await tcp('1.1.1.1',443);const ms=await tcp('13.107.42.14',443);const st=ip?await tcp(ip,puerto):'sin staging';console.log(JSON.stringify({internet_1111:ext,internet_ms:ms,staging:st}))})();
'@
  $tmp = Join-Path $env:TEMP 'rv_prueba_salida.js'; Set-Content $tmp $js -Encoding UTF8
  $ip = if ($staging.Ips.Count) { $staging.Ips[0] } else { '' }
  $r = & $nodeReg $tmp $ip $staging.Puertos[0] | ConvertFrom-Json
  $ok = ($r.internet_1111 -ne 'abre') -and ($r.internet_ms -ne 'abre')
  "internet bloqueado: $(if ($ok) {'SÍ'} else {'NO'}) (1.1.1.1:443 = $($r.internet_1111), Microsoft:443 = $($r.internet_ms)); staging $ip`:$($staging.Puertos[0]) = $($r.staging)"
  if (-not $ok) { Write-Warning 'EL CANDADO NO ESTÁ BLOQUEANDO. No arranques nada: revisa perfiles del firewall, políticas de dominio (reglas locales ignoradas) o el EDR.' }
}

# ---------------- Acciones ----------------
if ($Quitar) {
  if (-not (Es-Admin)) { throw 'Corre esto como administrador.' }
  $n = @(Get-NetFirewallRule -Group $Grupo -ErrorAction SilentlyContinue).Count
  Remove-NetFirewallRule -Group $Grupo -ErrorAction SilentlyContinue
  "Candado retirado: $n reglas del grupo $Grupo borradas ($(Get-Date -Format 'dd/MM/yyyy HH:mm'))."
  exit 0
}

$staging = Leer-Staging
if ($Verificar) {
  $reglas = @(Get-NetFirewallRule -Group $Grupo -ErrorAction SilentlyContinue | Where-Object { $_.Enabled -eq 'True' })
  "Reglas activas del grupo ${Grupo}: $($reglas.Count)"
  Get-NetFirewallProfile | ForEach-Object { "Perfil $($_.Name): habilitado=$($_.Enabled) reglas_locales=$($_.AllowLocalFirewallRules)" }
  Probar-Salida $staging
  exit 0
}

if (-not (Es-Admin)) { throw 'Corre esto en PowerShell como administrador (crea reglas de firewall).' }
if (-not $staging.Ips.Count) { throw 'kit\hosts-permitidos.json no tiene hosts en "staging". Sin eso el candado bloquearía también las bases.' }

$excluidos = @(, @((IpANum '127.0.0.0'), (IpANum '127.255.255.255')))
foreach ($ip in $staging.Ips) { $n = IpANum $ip; $excluidos += , @($n, $n) }
$fuera4 = Complemento-IPv4 $excluidos
$fuera6 = @('::2-ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff')   # todo IPv6 salvo ::1 (y ::)
$puertosNo = Complemento-Puertos $staging.Puertos

Remove-NetFirewallRule -Group $Grupo -ErrorAction SilentlyContinue
$progs = @(Programas); $i = 0
foreach ($p in $progs) {
  $i++; $base = "RegresionGuiada-{0:D2}-{1}" -f $i, [IO.Path]::GetFileNameWithoutExtension($p)
  New-NetFirewallRule -Group $Grupo -DisplayName "$base-fuera" -Direction Outbound -Action Block -Program $p -RemoteAddress ($fuera4 + $fuera6) -Profile Any -Description 'Regresión guiada: solo localhost y BD de staging' | Out-Null
  New-NetFirewallRule -Group $Grupo -DisplayName "$base-staging-tcp" -Direction Outbound -Action Block -Program $p -RemoteAddress $staging.Ips -Protocol TCP -RemotePort $puertosNo -Profile Any | Out-Null
  New-NetFirewallRule -Group $Grupo -DisplayName "$base-staging-udp" -Direction Outbound -Action Block -Program $p -RemoteAddress $staging.Ips -Protocol UDP -Profile Any | Out-Null
}
"Candado puesto ($(Get-Date -Format 'dd/MM/yyyy HH:mm')): $($progs.Count) programas, $(3 * $progs.Count) reglas de bloqueo."
"Staging permitido: $($staging.Ips -join ', ') puertos $($staging.Puertos -join ', ')"
$progs | ForEach-Object { "  - $_" }
Get-NetFirewallProfile | ForEach-Object { "Perfil $($_.Name): habilitado=$($_.Enabled) reglas_locales=$($_.AllowLocalFirewallRules)" }
Probar-Salida $staging
