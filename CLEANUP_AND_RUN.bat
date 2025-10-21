@echo off
echo ========================================
echo  WiChain - Native WebRTC Video Calling
echo  Cleanup and Fresh Install
echo ========================================
echo.

cd /d %~dp0wichain-backend\frontend

echo [1/4] Removing old dependencies...
if exist node_modules (
    rmdir /S /Q node_modules
    echo     ✅ node_modules removed
)
if exist package-lock.json (
    del /F package-lock.json
    echo     ✅ package-lock.json removed
)

echo.
echo [2/4] Installing fresh dependencies...
call npm install
if %errorlevel% neq 0 (
    echo     ❌ ERROR: npm install failed!
    pause
    exit /b 1
)
echo     ✅ Dependencies installed

echo.
echo [3/4] Building frontend...
call npm run build
if %errorlevel% neq 0 (
    echo     ❌ ERROR: Build failed!
    pause
    exit /b 1
)
echo     ✅ Frontend built

echo.
echo [4/4] Starting WiChain...
cd ..\src-tauri
cargo tauri dev

pause
