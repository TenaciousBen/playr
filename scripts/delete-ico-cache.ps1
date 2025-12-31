taskkill /f /im explorer.exe

Remove-Item -Force -ErrorAction SilentlyContinue "$env:LOCALAPPDATA\Microsoft\Windows\Explorer\iconcache*"
Remove-Item -Force -ErrorAction SilentlyContinue "$env:LOCALAPPDATA\Microsoft\Windows\Explorer\thumbcache*"

Start-Process explorer.exe
Echo "Icon cache cleared and explorer restarted"