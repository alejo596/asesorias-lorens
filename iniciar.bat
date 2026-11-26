@echo off
:: Lanzador heredado. Se mantiene el nombre por comodidad, pero la lógica real
:: vive en ejecutar.bat (detección de puerto ocupado, dependencias, .env, etc.).
call "%~dp0ejecutar.bat" %*
