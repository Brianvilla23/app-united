@echo off
cd /d "%~dp0"
echo Iniciando App United (Avisos)...
echo Abri en el PC:      http://localhost:5173
echo Abri en el celular: revisa la linea "Network" de abajo (mismo WiFi)
echo.
call npm run dev -- --host
pause
