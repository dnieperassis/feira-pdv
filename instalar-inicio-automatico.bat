@echo off
title Instalar Inicialização Automática - Feira PDV
color 0B

echo ============================================
echo  Instalando inicio automatico - Feira PDV
echo ============================================
echo.

:: Pasta do projeto
set PROJETO=%~dp0
set PROJETO=%PROJETO:~0,-1%

:: Pasta de startup do Windows (inicia com o Windows para todos os usuários)
set STARTUP=%ProgramData%\Microsoft\Windows\Start Menu\Programs\Startup

:: Cria o arquivo VBScript (inicia sem janela preta no fundo)
set VBS="%STARTUP%\FeiraPDV.vbs"

echo Set objShell = CreateObject("WScript.Shell") > %VBS%
echo objShell.Run "cmd /c cd /d ""%PROJETO%"" && npm start", 1, False >> %VBS%

echo.
echo [OK] Atalho criado em:
echo      %STARTUP%\FeiraPDV.vbs
echo.
echo O servidor iniciara automaticamente quando o Windows ligar.
echo.
echo Para REMOVER o inicio automatico, delete o arquivo:
echo      %STARTUP%\FeiraPDV.vbs
echo.
pause
