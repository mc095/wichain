@echo off
echo Installing required Python packages...
pip install cryptography

echo.
echo Running WiChain Python Tests...
echo =====================================
python test_wichain.py

echo.
echo Tests completed. Press any key to exit...
pause > nul
