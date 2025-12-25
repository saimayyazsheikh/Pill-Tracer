@echo off
title Pill Tracer Server
color 0A
echo ===================================================
echo        Pill Tracer - Pharmacy Management System
echo ===================================================
echo.
echo Starting Server...
echo.

cd /d "%~dp0"
node server.js

pause
