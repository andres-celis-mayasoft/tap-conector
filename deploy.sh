#!/bin/bash

set -e

ENV=$1

if [ -z "$ENV" ]; then
  echo "❌ Debes indicar el entorno: prod | test"
  exit 1
fi

if [ "$ENV" != "prod" ] && [ "$ENV" != "test" ]; then
  echo "❌ Entorno inválido. Usa: prod | test"
  exit 1
fi

COMPOSE_FILE="docker-compose.$ENV.yml"
ENV_FILE=".env.$ENV"
PROJECT_NAME="tap-conector-$ENV"
SERVICE_NAME="backend"

echo "🚀 Deploy backend ($ENV)"
echo "📦 Compose: $COMPOSE_FILE"

docker compose \
  -p $PROJECT_NAME \
  -f $COMPOSE_FILE \
  --env-file $ENV_FILE \
  build

docker compose \
  -p $PROJECT_NAME \
  -f $COMPOSE_FILE \
  --env-file $ENV_FILE \
  up -d

echo "✅ Deploy $ENV completado"
