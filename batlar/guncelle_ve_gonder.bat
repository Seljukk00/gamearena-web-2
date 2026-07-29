@echo off
chcp 65001 >nul
color 0A
title Guncelle ve Gonder - FutbolcuBil

cd /d "C:\Users\Seljuk\Desktop\FutbolcuBil_Web"

echo.
echo ================================================
echo   FUTBOLCU BIL - GITHUB'A GONDERME
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

REM Yeni dosya var mi kontrol
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

echo [2] Dosyalar hazirlaniyor (git add)...
git add .

echo.
echo [3] Commit yapiliyor...
git commit -m "%mesaj%"

echo.
echo [4] GitHub'a gonderiliyor (git push)...
git push

echo.
echo ================================================
echo   BASARILI! GitHub'a gonderildi!
echo ================================================
echo.
echo Render otomatik olarak yeni deploy baslatacak.
echo Site 2-3 dakika icinde guncellenecek.
echo.
echo Kontrol icin:
echo   Site: https://futbolcubil-web.onrender.com
echo   Render: https://dashboard.render.com
echo.

pause