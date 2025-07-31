@echo off
echo.
echo ==========================================
echo    REINICIO COMPLETO DEL SERVIDOR
echo ==========================================
echo.

echo 🔄 Deteniendo todos los procesos de Node.js...
taskkill /f /im node.exe 2>nul

echo.
echo ⏳ Esperando 3 segundos...
timeout /t 3 /nobreak >nul

echo.
echo 🧹 Limpiando cache de Node.js...
if exist node_modules/.cache (
    rmdir /s /q node_modules\.cache
    echo    ✅ Cache de Node.js limpiado
) else (
    echo    ℹ️  No hay cache para limpiar
)

echo.
echo 🚀 Iniciando servidor limpio...
node server.js

pause
