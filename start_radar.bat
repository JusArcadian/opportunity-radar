@echo off
REM start_radar.bat: opens the Opportunity Radar phone app on this PC. Leave the black window open while you use it.
cd /d "%~dp0"
start "" http://localhost:8000
py -m http.server 8000 -d web || python -m http.server 8000 -d web
pause
