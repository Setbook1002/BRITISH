@echo off
cd /d "%~dp0"

echo Attempting to start server...

REM Try Python first
py -m http.server 3000 > nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   Support Hub is running!
    echo ========================================
    echo.
    echo   Open in your browser:
    echo   http://localhost:3000
    echo.
    echo   Close this window to stop the server
    echo ========================================
    echo.
    py -m http.server 3000
    exit /b
)

REM Try python3
python3 -m http.server 3000 > nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   Support Hub is running!
    echo ========================================
    echo.
    echo   Open in your browser:
    echo   http://localhost:3000
    echo.
    echo   Close this window to stop the server
    echo ========================================
    echo.
    python3 -m http.server 3000
    exit /b
)

REM If no Python found
echo ERROR: This method requires Python to be installed.
echo.
echo Alternative: Open index.html directly in your browser
echo Location: "%~dp0index.html"
echo.
pause
