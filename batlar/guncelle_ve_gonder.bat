@echo off
chcp 65001 >nul
color 0A
title Guncelle ve Gonder - GameArena

REM Proje ana klasörüne git
cd /d "%~dp0.."

echo.
echo ================================================
echo   GAMEARENA - GITHUB'A GONDERME
echo ================================================
echo.

echo [1] DEGISEN DOSYALAR:
echo ------------------------------------------------
git status --short
echo.
echo ------------------------------------------------
echo.

REM Degisiklik var mi kontrol et
git diff --quiet HEAD 2>nul
if %errorlevel% neq 0 goto :devam
git diff --cached --quiet 2>nul
if %errorlevel% neq 0 goto :devam

for /f %%i in ('git ls-files --others --exclude-standard 2^>nul') do (
    goto :devam
)

echo [BILGI] Hicbir sey degismemis!
echo.
pause
exit /b 0

:devam
echo.
set /p mesaj="Commit mesaji yaz (bos birakma): "

if "%mesaj%"=="" (
    echo.
    echo [HATA] Commit mesaji bos olamaz!
    echo.
    pause
    exit /b 1
)

echo.
echo ================================================
echo   ISLEM BASLIYOR...
echo ================================================
echo.

echo [2] Once GitHub'dan degisiklikler cekiliyor (git pull)...
git pull origin main --no-edit

if %errorlevel% neq 0 (
    echo.
    echo ================================================
    echo   [HATA] Pull basarisiz! Conflict olabilir.
    echo ================================================
    echo.
    echo Lutfen manuel olarak:
    echo   1. git status
    echo   2. Conflict'leri cozun
    echo   3. Tekrar deneyin
    echo.
    pause
    exit /b 1
)

echo.
echo [3] Dosyalar hazirlaniyor (git add)...
git add .

echo.
echo [4] Commit yapiliyor...
git commit -m "%mesaj%"

if %errorlevel% neq 0 (
    echo [BILGI] Yeni commit yok, push icin devam...
)

echo.
echo [5] GitHub'a gonderiliyor (git push)...
git push

if %errorlevel% neq 0 (
    echo.
    echo ================================================
    echo   [HATA] Push basarisiz!
    echo ================================================
    echo.
    echo Yukaridaki hata mesajini kontrol edin.
    echo.
    pause
    exit /b 1
)

echo.
echo ================================================
echo   BASARILI! GitHub'a gonderildi!
echo ================================================
echo.
echo Render otomatik olarak yeni deploy baslatacak.
echo Site 2-3 dakika icinde guncellenecek.
echo.
echo Kontrol icin:
echo   Site: https://gamearena-web-ky7q.onrender.com
echo   GitHub: https://github.com/Seljukk00/gamearena-web-2
echo   Render: https://dashboard.render.com
echo.

choice /C YN /M "Siteyi tarayicida acmak ister misin"
if %errorlevel%==1 start https://gamearena-web-ky7q.onrender.com

pause