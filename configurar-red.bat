@echo off
echo ================================================
echo    CONFIGURACION DE RED PARA POLI-CAR
echo ================================================
echo.

echo 🔥 Configurando Firewall de Windows...
echo.

REM Crear regla para permitir conexiones entrantes en puerto 3000
netsh advfirewall firewall add rule name="PoliCar-App-Entrada" dir=in action=allow protocol=TCP localport=3000
if %errorlevel% equ 0 (
    echo ✅ Regla de entrada creada exitosamente
) else (
    echo ❌ Error creando regla de entrada (ejecutar como Administrador)
)

REM Crear regla para permitir conexiones salientes en puerto 3000
netsh advfirewall firewall add rule name="PoliCar-App-Salida" dir=out action=allow protocol=TCP localport=3000
if %errorlevel% equ 0 (
    echo ✅ Regla de salida creada exitosamente
) else (
    echo ❌ Error creando regla de salida (ejecutar como Administrador)
)

echo.
echo 🌐 Obteniendo IP de la red local...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4"') do (
    set ip=%%a
    set ip=!ip: =!
    if not "!ip!"=="" (
        echo Tu IP local es: !ip!
        echo.
        echo 📋 Otros PCs pueden acceder con:
        echo    http://!ip!:3000
        echo.
    )
)

echo ================================================
echo            INSTRUCCIONES FINALES
echo ================================================
echo.
echo 1. Ejecuta este archivo como ADMINISTRADOR
echo 2. Inicia el servidor con: node server.js
echo 3. Comparte la IP mostrada arriba con otros usuarios
echo 4. Asegurate que todos esten en la misma red (WiFi/LAN)
echo.
echo ⚠️  IMPORTANTE: Si el firewall bloquea, ejecutar como Admin
echo.
pause
