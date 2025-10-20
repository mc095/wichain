#!/bin/bash

echo "========================================"
echo "WiChain Mobile Setup Script"
echo "========================================"
echo ""

echo "Step 1: Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install dependencies"
    exit 1
fi
echo "✓ Dependencies installed"
echo ""

echo "Step 2: Building web app..."
npm run build
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to build web app"
    exit 1
fi
echo "✓ Web app built"
echo ""

echo "Step 3: Adding platforms..."
echo "Adding Android..."
npx cap add android 2>/dev/null || echo "Android platform already exists"

echo "Adding iOS..."
npx cap add ios 2>/dev/null || echo "iOS platform already exists"
echo "✓ Platforms ready"
echo ""

echo "Step 4: Syncing code..."
npx cap sync
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to sync"
    exit 1
fi
echo "✓ Sync complete"
echo ""

echo "========================================"
echo "Setup Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo ""
echo "For Android:"
echo "1. Run: npm run cap:open:android"
echo "2. In Android Studio, click Build -> Build APK"
echo "3. Find APK at: android/app/build/outputs/apk/debug/"
echo ""
echo "For iOS:"
echo "1. Run: npm run cap:open:ios"
echo "2. In Xcode, click Play button"
echo "3. Test on simulator or real iPhone"
echo ""
echo "Done! Press any key to continue..."
read -n 1
