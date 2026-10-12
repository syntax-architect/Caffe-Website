# ==============================================================================
# 1-Click Client Provisioning PowerShell Script for Multi-Restaurant Sales
# Usage: .\scripts\deploy-client.ps1 -ClientSlug "bistro" -Port 8082
# ==============================================================================

param (
    [Parameter(Mandatory=$false)][string]$ClientSlug = "demo-client",
    [Parameter(Mandatory=$false)][int]$Port = 8080,
    [Parameter(Mandatory=$false)][string]$SupabaseUrl = "",
    [Parameter(Mandatory=$false)][string]$SupabaseKey = ""
)

$containerName = "caffe-$ClientSlug"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "🚀 Provisioning New Restaurant Instance: $ClientSlug" -ForegroundColor Green
Write-Host "📡 Serving on Host Port: $Port" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

# Stop and remove existing container if running
$existing = docker ps -aq -f "name=^/$containerName$"
if ($existing) {
    Write-Host "⚠️ Stopping previous container $containerName..." -ForegroundColor DarkYellow
    docker stop $containerName | Out-Null
    docker rm $containerName | Out-Null
}

# Build image
Write-Host "🔨 Building client container..." -ForegroundColor Cyan
docker build `
  --build-arg "VITE_RESTAURANT_ID=$ClientSlug" `
  --build-arg "VITE_SUPABASE_URL=$SupabaseUrl" `
  --build-arg "VITE_SUPABASE_ANON_KEY=$SupabaseKey" `
  -t "caffe-client-$ClientSlug:latest" .

# Launch container
Write-Host "🚢 Launching container $containerName..." -ForegroundColor Cyan
docker run -d `
  --name $containerName `
  --restart unless-stopped `
  -p "$Port:80" `
  --memory 512m `
  --cpus 1.0 `
  "caffe-client-$ClientSlug:latest"

Write-Host ""
Write-Host "🎉 SUCCESS: Restaurant client '$ClientSlug' is live at:" -ForegroundColor Green
Write-Host "👉 http://localhost:$Port/" -ForegroundColor White
Write-Host "👉 Health status: http://localhost:$Port/healthz" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
