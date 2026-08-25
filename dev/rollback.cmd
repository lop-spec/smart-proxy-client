@echo off
rem Roll resources\ back to the newest snapshot under backups\ then restart.
setlocal
set "ROOT=%~dp0.."
set "LATEST="
for /f "delims=" %%D in ('dir /b /ad /o-n "%ROOT%\backups\resources-*" 2^>nul') do if not defined LATEST set "LATEST=%%D"
if not defined LATEST (
  echo no snapshot found under backups\ - run snapshot.cmd first.
  exit /b 1
)
echo rolling back to %LATEST% ...
robocopy "%ROOT%\backups\%LATEST%" "%ROOT%\resources" /MIR /R:1 /W:1 /NFL /NDL /NJH >nul
call "%~dp0restart.cmd"
