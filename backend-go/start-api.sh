#!/bin/bash

# Load environment variables
source /home/ubuntu/.user_env
source /opt/.manus/webdev.sh.env 2>/dev/null || true

# Set port
export APP_PORT=8081

# Start Go API server
cd /home/ubuntu/realtime-translation/backend-go
exec go run cmd/server/main.go
