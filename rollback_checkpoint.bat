@echo off
chcp 65001 > nul
echo ====================================================================
echo  ОТКАТ ПРОЕКТА К ИСХОДНОЙ ТОЧКЕ (BASELINE-BAZIS)
echo ====================================================================
echo Внимание! Все незафиксированные изменения будут отменены.
set /p confirm="Вы уверены, что хотите выполнить полный откат? (y/n): "
if /i "%confirm%" neq "y" goto cancel

echo Откатываем проект к контрольной точке baseline-bazis...
git reset --hard baseline-bazis
git clean -fd
echo.
echo [УСПЕХ] Проект успешно возвращен в исходное состояние (baseline-bazis).
pause
exit /b 0

:cancel
echo Откат отменен пользователем.
pause
exit /b 0
