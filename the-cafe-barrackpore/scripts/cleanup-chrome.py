import subprocess

try:
    cmd = 'powershell -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq \'chrome.exe\' -and $_.CommandLine -like \'*--headless*\' } | Select-Object -ExpandProperty ProcessId"'
    output = subprocess.check_output(cmd, shell=True).decode('utf-8', errors='ignore')
    pids = [line.strip() for line in output.splitlines() if line.strip().isdigit()]
    print(f"Found {len(pids)} headless Chrome processes.")
    for pid in pids:
        print(f"Terminating PID {pid}...")
        subprocess.run(f"taskkill /F /PID {pid}", shell=True, capture_output=True)
    print("Done cleanup.")
except Exception as e:
    print("Cleanup error:", e)
