# Personal OS (plugin) - Recordatorio de cierre (tarea programada 17:00 L-V).
# Notificacion simple (sin Claude): recordar dejar el comentario de avances del entregable #1.
$ErrorActionPreference = 'Continue'
try {
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  $ni = New-Object System.Windows.Forms.NotifyIcon
  $ni.Icon = [System.Drawing.SystemIcons]::Warning
  $ni.BalloonTipTitle = 'Personal OS - Cierre del dia'
  $ni.BalloonTipText  = 'Dejaste el comentario de avances de tu entregable #1? (reporte diario). Revisa pendientes para manana.'
  $ni.Visible = $true
  $ni.ShowBalloonTip(20000)
  Start-Sleep -Seconds 12
  $ni.Dispose()
} catch {}
