param(
  [Parameter(Mandatory=$true)]
  [string]$CsvPath,

  [int]$DelayMs = 1200,

  [switch]$WhatIf,

  [string]$FromSmtp = ""
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $CsvPath)) { throw "CSV not found: $CsvPath" }

$outDir = Split-Path $CsvPath -Parent
$stamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
$logPath = Join-Path $outDir ("send_log_" + $stamp + ".csv")

"timestamp,subject,to,status,error" | Out-File -FilePath $logPath -Encoding utf8

# Outlook COM (Classic Outlook required)
$outlook = New-Object -ComObject Outlook.Application

function Get-SendAccount {
  param([string]$smtp)
  if (-not $smtp.Trim()) { return $null }
  foreach ($acct in $outlook.Session.Accounts) {
    try {
      if ($acct.SmtpAddress -and ($acct.SmtpAddress.ToLower() -eq $smtp.ToLower())) { return $acct }
    } catch {}
  }
  return $null
}

$sendAccount = Get-SendAccount -smtp $FromSmtp

$rows = Import-Csv $CsvPath
Write-Host "Loaded $($rows.Count) emails from CSV"
Write-Host "Log: $logPath"
Write-Host ("Mode: " + ($(if ($WhatIf) { "WHATIF" } else { "SEND" })))
if ($FromSmtp.Trim()) { Write-Host "From: $FromSmtp" }
Write-Host ""

foreach ($r in $rows) {
  $ts = (Get-Date).ToString("s")
  $status = "UNKNOWN"
  $errMsg = ""

  try {
    $mail = $outlook.CreateItem(0)  # olMailItem
    $mail.To = $r.To
    $mail.Subject = $r.Subject
    $mail.HTMLBody = $r.HtmlBody

    if ($sendAccount) { $mail.SendUsingAccount = $sendAccount }

    if ($WhatIf) {
      $status = "WHATIF_SKIPPED"
      $mail.Save()  # saves to Drafts
    } else {
      $mail.Send()
      $status = "SENT"
    }
  } catch {
    $status = "ERROR"
    $errMsg = ($_.Exception.Message -replace "`r|`n"," ").Trim()
  }

  $subSafe = ($r.Subject -replace '"','''')
  $toSafe = ($r.To -replace '"','''')
  $errSafe = ($errMsg -replace '"','''')
  """$ts"",""$subSafe"",""$toSafe"",""$status"",""$errSafe""" | Add-Content -Path $logPath -Encoding utf8

  Start-Sleep -Milliseconds $DelayMs
}

Write-Host "Done. Log saved to: $logPath"
