@echo off
chcp 65001 >nul
color 0B
title Degisiklikleri Goster - GameArena

cd /d "C:\Users\Seljuk\Desktop\GameArena_Web"

echo.
echo ================================================
echo   GAMEARENA - DEGISIKLIKLERI GOSTER
echo ================================================
echo.

echo [1] DEGISEN VE YENI DOSYALAR:
echo ------------------------------------------------
git status --short

echo.
echo ================================================
echo.
echo [2] DETAYLI DEGISIKLIKLER (SADECE DEGISENLER):
echo ------------------------------------------------
git diff --stat

echo.
echo ================================================
echo.

set /p detay="Detayli DIFF gormek istiyor musun? (E/H): "
if /i "%detay%"=="E" (
    echo.
    echo ================================================
    echo   DETAYLI DIFF:
    echo ================================================
    git diff
    echo.
)

echo.
echo ================================================
echo.
pause