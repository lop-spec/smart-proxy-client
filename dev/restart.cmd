@echo off
rem Restart only the v35 instance (kills exe matching this folder), then relaunch.
setlocal
set "ROOT=%~dp0.."
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "(Get-Process smart-proxy-client-win_x64 -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*smart-proxy-client-v35*' }).Id"`) do taskkill /PID %%P /T /F >nul 2>&1
timeout /t 1 /nobreak >nul
start "" wscript.exe "%ROOT%\smart-proxy-launcher.vbs"
echo v35 restarted.
