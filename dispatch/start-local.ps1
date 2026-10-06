$ErrorActionPreference = 'Stop'
$taskNodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($taskNodeCommand) {
    $taskNode = $taskNodeCommand.Source
} else {
    $taskNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    if (-not (Test-Path -LiteralPath $taskNode)) { throw 'Node.js 24 or newer is required.' }
}
$taskConfig = Join-Path $PSScriptRoot '.env'
if (-not (Test-Path -LiteralPath $taskConfig)) {
    $taskPassword = & $taskNode -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
    $taskSigningSecret = & $taskNode -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    $taskTemplate = Get-Content -LiteralPath (Join-Path $PSScriptRoot '.env.example') -Raw
    $taskTemplate = $taskTemplate.Replace('ADMIN_PASSWORD=', 'ADMIN_PASSWORD=' + $taskPassword.Trim()).Replace('UNSUBSCRIBE_SECRET=', 'UNSUBSCRIBE_SECRET=' + $taskSigningSecret.Trim())
    [System.IO.File]::WriteAllText($taskConfig, $taskTemplate, [System.Text.UTF8Encoding]::new($false))
}
Write-Host 'Local preview: http://localhost:3080'
Write-Host "The login password is the ADMIN_PASSWORD value in $taskConfig."
Push-Location $PSScriptRoot
try { & $taskNode --env-file-if-exists=.env server.mjs } finally { Pop-Location }
