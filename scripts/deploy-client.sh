#!/usr/bin/env bash
# ==============================================================================
# 1-Click Client Provisioning Script for Multi-Restaurant Sales
# Usage: ./scripts/deploy-client.sh <client_slug> <port> [supabase_url] [supabase_anon_key]
# Example: ./scripts/deploy-client.sh bistro 8082 https://xyz.supabase.co eyJhb...
# ==============================================================================

set -e

CLIENT_SLUG=${1:-"demo-client"}
PORT=${2:-"8080"}
SUPABASE_URL=${3:-""}
SUPABASE_KEY=${4:-""}

CONTAINER_NAME="caffe-${CLIENT_SLUG}"

echo "=========================================================="
echo "🚀 Provisioning New Restaurant Instance: ${CLIENT_SLUG}"
echo "📡 Serving on Host Port: ${PORT}"
echo "=========================================================="

# Stop and remove existing container for this client if present
if [ "$(docker ps -aq -f name=^/${CONTAINER_NAME}$)" ]; then
    echo "⚠️ Stopping previous container ${CONTAINER_NAME}..."
    docker stop ${CONTAINER_NAME} || true
    docker rm ${CONTAINER_NAME} || true
fi

# Build or reuse image
echo "🔨 Building client container..."
docker build \
  --build-arg VITE_RESTAURANT_ID="${CLIENT_SLUG}" \
  --build-arg VITE_SUPABASE_URL="${SUPABASE_URL}" \
  --build-arg VITE_SUPABASE_ANON_KEY="${SUPABASE_KEY}" \
  -t "caffe-client-${CLIENT_SLUG}:latest" .

# Run the container
echo "🚢 Launching container ${CONTAINER_NAME}..."
docker run -d \
  --name "${CONTAINER_NAME}" \
  --restart unless-stopped \
  -p "${PORT}:80" \
  --memory 512m \
  --cpus 1.0 \
  "caffe-client-${CLIENT_SLUG}:latest"

echo ""
echo "🎉 SUCCESS: Restaurant client '${CLIENT_SLUG}' is live at:"
echo "👉 http://localhost:${PORT}/"
echo "👉 Health status: http://localhost:${PORT}/healthz"
echo "=========================================================="
