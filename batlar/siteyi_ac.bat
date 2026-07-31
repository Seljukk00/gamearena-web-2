@echo off
title Siteye Git - GameArena

echo.
echo ================================================
echo   GAMEARENA - SITELERI ACIYOR
echo ================================================
echo.

echo [1] Canli siteye gidiliyor...
start https://gamearena-web.onrender.com

timeout /t 1 /nobreak >nul

echo [2] GitHub reposuna gidiliyor...
start https://github.com/selcukaydin927-ctrl/gamearena-web

timeout /t 1 /nobreak >nul

echo [3] Render dashboard'a gidiliyor...
start https://dashboard.render.com

echo.
echo ================================================
echo   Tum siteler tarayicida acildi!
echo ================================================
echo.

timeout /t 3 /nobreak >nul