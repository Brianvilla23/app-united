@echo off
echo ============================================
echo  Conectar con GitHub (solo se hace UNA vez)
echo ============================================
echo.
echo Se va a abrir GitHub en tu navegador.
echo 1. Copia el codigo que aparece aca abajo
echo 2. Pegalo en la pagina que se abre
echo 3. Autoriza con tu cuenta (Brianvilla23)
echo.
gh auth login --hostname github.com --git-protocol https --web
echo.
echo Listo! Ahora avisale a Claude que ya te conectaste.
pause
