#!/bin/bash

set -e

ENV=$1

if [ -z "$ENV" ]; then
  echo "❌ Debes indicar el entorno: prod | test"
  exit 1
fi


if [ "$ENV" == "prod" ]; then
  BRANCH="main"  
elif [ "$ENV" == "test" ]; then
  BRANCH="develop"
else
  echo "❌ Entorno inválido. Usa: prod | test"
  exit 1
fi

COMPOSE_FILE="docker-compose.$ENV.yml"
ENV_FILE=".env.$ENV"
PROJECT_NAME="tap-conector-$ENV"

echo "--------------------------------"
echo "🌐 Entorno: $ENV | Rama: $BRANCH"
echo "--------------------------------"

echo "📥 Actualizando código desde Git..."
git fetch origin 

if [ "$(git rev-parse --abbrev-ref HEAD)" != "$BRANCH" ]; then
  echo "🔀 Cambiando a la rama $BRANCH..."
  git checkout $BRANCH
fi

git pull origin $BRANCH

echo "🚀 Iniciando despliegue de contenedores..."

docker compose \
  -p "$PROJECT_NAME" \
  -f "$COMPOSE_FILE" \
  --env-file "$ENV_FILE" \
  up -d --build --remove-orphans

echo "✅ Deploy $ENV completado con éxito"