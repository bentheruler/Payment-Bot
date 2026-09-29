call npm test
if %errorlevel% neq 0 exit /b %errorlevel%
call npm run lint
if %errorlevel% neq 0 exit /b %errorlevel%
call npx tsc --noEmit
if %errorlevel% neq 0 exit /b %errorlevel%
call npm run build
if %errorlevel% neq 0 exit /b %errorlevel%
