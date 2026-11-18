@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js. Instalalo desde https://nodejs.org/
  pause
  exit /b 1
)
node server.js
pause
