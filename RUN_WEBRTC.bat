@echo off
echo ========================================
echo  WiChain WebRTC Video Call Setup
echo ========================================
echo.

cd /d %~dp0wichain-backend\frontend

echo [1/3] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: npm install failed!
    pause
    exit /b 1
)

echo.
echo [2/3] Building frontend...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Build failed!
    pause
    exit /b 1
)

echo.
echo [3/3] Starting WiChain...
cd ..\src-tauri
cargo tauri dev

pause
