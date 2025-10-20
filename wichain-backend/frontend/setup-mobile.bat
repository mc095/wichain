@echo off
echo ========================================
echo WiChain Mobile Setup Script
echo ========================================
echo.

echo Step 1: Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo ✓ Dependencies installed
echo.

echo Step 2: Building web app...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Failed to build web app
    pause
    exit /b 1
)
echo ✓ Web app built
echo.

echo Step 3: Adding Android platform...
call npx cap add android
if %errorlevel% neq 0 (
    echo WARNING: Android platform may already exist or failed to add
)
echo ✓ Android platform ready
echo.

echo Step 4: Syncing with Android...
call npx cap sync android
if %errorlevel% neq 0 (
    echo ERROR: Failed to sync with Android
    pause
    exit /b 1
)
echo ✓ Android sync complete
echo.

echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Run: npm run cap:open:android
echo 2. In Android Studio, click Build -^> Build APK
echo 3. Find APK at: android/app/build/outputs/apk/debug/
echo.
echo For iOS (Mac only):
echo 1. Run: npm run cap:add:ios
echo 2. Run: npm run cap:open:ios
echo 3. In Xcode, click Play button
echo.
pause
