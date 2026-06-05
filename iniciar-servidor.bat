@echo off
title Feira PDV - Servidor
color 0A

echo ============================================
echo        FEIRA PDV - Servidor Local
echo ============================================
echo.

:: Vai para a pasta do projeto
cd /d "%~dp0"

:: Verifica se Node.js está instalado
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Node.js nao encontrado!
    echo Instale em: https://nodejs.org
    pause
    exit /b 1
)

:: Exibe IP da maquina para os garcons
echo IP desta maquina (garcons devem acessar este IP):
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set IP=%%a
    echo    http:%%a:3000
)
echo.

:: Verifica se o build existe
if not exist ".next" (
    echo Primeiro uso - fazendo build (aguarde ~2 minutos)...
    call npm run build
    if %errorlevel% neq 0 (
        echo [ERRO] Falha no build!
        pause
        exit /b 1
    )
)

echo ============================================
echo  Servidor iniciado! Acesse no celular:
echo  http://%IP: =%:3000
echo ============================================
echo.
echo Pressione CTRL+C para parar o servidor
echo.

:: Inicia o servidor
npm start
