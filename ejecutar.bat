@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
title ASESORÍAS LORENS - Lanzador del sistema
color 0B

set "MODE=run"
set "FORCE_INSTALL=0"
set "APP_PORT=3000"
set "PORT_PID="
set "PORT_NAME="
set "EXITCODE=0"

call :parse_args %*
if /i "%MODE%"=="help"    goto :show_help
if /i "%MODE%"=="invalid" goto :end_error

echo =========================================================================
echo    ASESORÍAS LORENS - SISTEMA DE INSPECCIÓN Y LIQUIDACIÓN DE SINIESTROS
echo =========================================================================
echo.

:: ---------------------------------------------------------------------------
:: 1. Requisitos previos
:: ---------------------------------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
    color 0C
    echo [ERROR] Node.js no está instalado o no está en el PATH del sistema.
    echo         Descárguelo desde https://nodejs.org/ ^(versión LTS^) e intente de nuevo.
    goto :end_error
)
for /f "delims=" %%V in ('node --version 2^>nul') do set "NODE_VERSION=%%V"
echo [OK] Node.js detectado: %NODE_VERSION%

where npm >nul 2>nul
if errorlevel 1 (
    color 0C
    echo [ERROR] npm no está disponible en el PATH. Reinstale Node.js incluyendo npm.
    goto :end_error
)

:: ---------------------------------------------------------------------------
:: 2. Configuración .env y puerto de escucha
:: ---------------------------------------------------------------------------
if not exist ".env" (
    if exist ".env.example" (
        copy /y ".env.example" ".env" >nul
        echo [OK] Se generó .env a partir de .env.example.
    ) else (
        color 0E
        echo [AVISO] No existe .env ni .env.example: se usarán los valores por defecto.
        color 0B
    )
)

for /f "usebackq tokens=1,2 delims== " %%A in (`findstr /b /i "PORT=" ".env" 2^>nul`) do set "APP_PORT=%%B"
if not defined APP_PORT set "APP_PORT=3000"
echo [OK] Puerto de escucha: %APP_PORT%

:: ---------------------------------------------------------------------------
:: 3. Dependencias
:: ---------------------------------------------------------------------------
if "%FORCE_INSTALL%"=="1" goto :install_deps
if exist "node_modules\express\package.json" goto :deps_ready

:install_deps
echo.
echo [INFO] Instalando dependencias (puede tardar unos minutos la primera vez)...
echo.
call npm install --no-fund --no-audit
if errorlevel 1 (
    color 0C
    echo.
    echo [ERROR] Falló la instalación de dependencias con npm.
    echo         Verifique su conexión a Internet y los permisos sobre la carpeta.
    goto :end_error
)
echo.
echo [OK] Dependencias instaladas.
:deps_ready

:: ---------------------------------------------------------------------------
:: 4. Modo carga de datos (/seed)
:: ---------------------------------------------------------------------------
if /i "%MODE%"=="seed" goto :run_seed

:: ---------------------------------------------------------------------------
:: 5. Verificar que el puerto esté libre
:: ---------------------------------------------------------------------------
for /f %%P in ('powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort %APP_PORT% -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess" 2^>nul') do set "PORT_PID=%%P"

if not defined PORT_PID goto :port_free
for /f "tokens=1" %%N in ('tasklist /fi "PID eq !PORT_PID!" /nh 2^>nul') do set "PORT_NAME=%%N"

echo.
echo [AVISO] El puerto %APP_PORT% ya está en uso por el PID !PORT_PID! (!PORT_NAME!).

set "PORT_CMD="
for /f "usebackq delims=" %%C in (`powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId = !PORT_PID!').CommandLine" 2^>nul`) do set "PORT_CMD=%%C"

set "PORT_IS_APP=0"
if /i "!PORT_NAME!"=="node.exe" (
    echo !PORT_CMD! | findstr /i /c:"server.js" >nul && set "PORT_IS_APP=1"
)
if "!PORT_IS_APP!"=="0" (
    color 0C
    echo [ERROR] El proceso que ocupa el puerto %APP_PORT% no es este servidor.
    echo         Ciérrelo manualmente o cambie el valor PORT en el archivo .env.
    goto :end_error
)
choice /c SN /n /m "  ¿Detener esa instancia y arrancar una nueva? [S/N] "
if errorlevel 2 goto :end_cancelled
taskkill /pid !PORT_PID! /t /f >nul 2>nul

set "WAIT=0"
:wait_port
set "STILL="
for /f %%P in ('powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort %APP_PORT% -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess" 2^>nul') do set "STILL=%%P"
if not defined STILL goto :port_released
set /a WAIT+=1
if !WAIT! geq 10 (
    color 0E
    echo [AVISO] El puerto %APP_PORT% sigue ocupado; se intentará arrancar de todos modos.
    color 0B
    goto :port_released
)
timeout /t 1 >nul
goto :wait_port
:port_released
echo [OK] Instancia anterior detenida y puerto %APP_PORT% liberado.
:port_free

:: ---------------------------------------------------------------------------
:: 6. Abrir el navegador cuando el servidor responda
:: ---------------------------------------------------------------------------
echo.
echo =========================================================================
echo    Servidor:  http://localhost:%APP_PORT%
echo    Modo:      %MODE%
echo    Detener:   Ctrl + C en esta ventana
echo =========================================================================
echo.

start "" /b powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i -lt 60;$i++){ try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:%APP_PORT%/api/health' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { Start-Process 'http://localhost:%APP_PORT%'; break } } catch {} ; Start-Sleep -Milliseconds 500 }"

:: ---------------------------------------------------------------------------
:: 7. Arrancar el servidor en primer plano
:: ---------------------------------------------------------------------------
if /i "%MODE%"=="dev" (
    if exist "node_modules\.bin\nodemon.cmd" (
        call "node_modules\.bin\nodemon.cmd" server.js
    ) else (
        call npx --yes nodemon server.js
    )
) else (
    node server.js
)
set "EXITCODE=%errorlevel%"

echo.
if not "%EXITCODE%"=="0" (
    color 0C
    echo [ERROR] El servidor se detuvo con código %EXITCODE%.
    echo         Revise los mensajes anteriores: PostgreSQL detenido, puerto ocupado
    echo         o variables de .env incorrectas.
    goto :end_error
)
echo [INFO] Servidor detenido correctamente.
echo.
pause
exit /b 0

:: ===========================================================================
:: Subrutinas
:: ===========================================================================
:run_seed
if not exist "scripts\seedRunner.js" (
    color 0C
    echo [ERROR] No se encontró scripts\seedRunner.js
    goto :end_error
)
echo.
echo [INFO] Cargando datos de ejemplo en la base de datos...
echo.
call node scripts\seedRunner.js
if errorlevel 1 (
    color 0C
    echo [ERROR] La carga de datos falló. Revise la conexión a PostgreSQL y el archivo .env.
    goto :end_error
)
echo.
echo [OK] Datos de ejemplo cargados.
echo.
pause
exit /b 0

:parse_args
if "%~1"=="" goto :args_done
if /i "%~1"=="/dev"     ( set "MODE=dev" & shift & goto :parse_args )
if /i "%~1"=="/seed"    ( set "MODE=seed" & shift & goto :parse_args )
if /i "%~1"=="/install" ( set "FORCE_INSTALL=1" & shift & goto :parse_args )
if /i "%~1"=="/help"    ( set "MODE=help" & shift & goto :parse_args )
if /i "%~1"=="-h"       ( set "MODE=help" & shift & goto :parse_args )
if /i "%~1"=="--help"   ( set "MODE=help" & shift & goto :parse_args )
color 0C
echo [ERROR] Opción no reconocida: %~1
echo         Ejecute "ejecutar.bat /help" para ver las opciones disponibles.
set "MODE=invalid"
exit /b 0

:args_done
exit /b 0

:show_help
echo.
echo  Uso: ejecutar.bat [opción]
echo.
echo    (sin opción)   Instala dependencias si faltan y arranca el servidor.
echo    /dev           Arranca con recarga automática (nodemon).
echo    /seed          Carga los datos de ejemplo en PostgreSQL.
echo    /install       Fuerza la reinstalación de dependencias (npm install).
echo    /help          Muestra esta ayuda.
echo.
echo  El puerto se toma de la variable PORT del archivo .env (por defecto 3000).
echo.
pause
exit /b 0

:end_cancelled
echo.
echo [INFO] Operación cancelada por el usuario.
echo.
pause
exit /b 1

:end_error
echo.
pause
exit /b 1
