@echo off
echo ========================================
echo WICHAIN - FIX AND COMMIT SCRIPT
echo ========================================
echo.

cd /d "%~dp0"

echo [1/7] Cleaning frontend dependencies...
cd wichain-backend\frontend
if exist package-lock.json del /f /q package-lock.json
if exist node_modules rmdir /s /q node_modules
echo ✅ Cleaned!
echo.

echo [2/7] Installing fresh dependencies...
call npm install
if errorlevel 1 (
    echo ❌ npm install failed!
    pause
    exit /b 1
)
echo ✅ npm install succeeded!
echo.

echo [3/7] Verifying Tauri versions...
call npm list @tauri-apps/api @tauri-apps/cli
echo.

echo [4/7] Building frontend...
call npm run build
if errorlevel 1 (
    echo ❌ Frontend build failed!
    pause
    exit /b 1
)
echo ✅ Frontend built!
echo.

cd ..\..\

echo [5/7] Checking Git status...
git status
echo.

echo [6/7] Staging all changes...
git add .
git add -u
echo ✅ Changes staged!
echo.

echo [7/7] Ready to commit!
echo.
echo Run these commands:
echo   git commit -m "Fix: Desktop-only build with version auto-matching"
echo   git push origin main
echo   git tag v1.0.0
echo   git push origin v1.0.0
echo.

pause
