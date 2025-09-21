@echo off
echo Setting up MongoDB for WiChain...
echo.

echo Checking if MongoDB is installed...
mongod --version >nul 2>&1
if %errorlevel% neq 0 (
    echo MongoDB is not installed or not in PATH.
    echo.
    echo Please install MongoDB Community Server from:
    echo https://www.mongodb.com/try/download/community
    echo.
    echo After installation, make sure to:
    echo 1. Add MongoDB to your PATH
    echo 2. Start the MongoDB service
    echo.
    pause
    exit /b 1
)

echo MongoDB is installed!
echo.

echo Starting MongoDB service...
net start MongoDB >nul 2>&1
if %errorlevel% neq 0 (
    echo MongoDB service is not running. Starting it...
    mongod --dbpath "C:\data\db" --logpath "C:\data\log\mongod.log" --install
    net start MongoDB
)

echo.
echo MongoDB setup complete!
echo WiChain will now store messages in MongoDB instead of JSON files.
echo.
echo To verify MongoDB is running:
echo   netstat -an | findstr :27017
echo.
pause
