@echo off
rem Snapshot resources\ into backups\resources-YYYYMMDD-HHMMSS (portable rollback point, no git needed).
setlocal
set "ROOT=%~dp0.."
for /f "usebackq delims=" %%T in (`powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"`) do set "TS=%%T"
robocopy "%ROOT%\resources" "%ROOT%\backups\resources-%TS%" /E /R:1 /W:1 /NFL /NDL /NJH >nul
echo snapshot created: backups\resources-%TS%
