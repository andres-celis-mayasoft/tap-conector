
#!/bin/bash

# Forzar que se use bash si el script se invoca con sh
set -e

ENV=$1

if [ -z "$ENV" ]; then
  echo "❌ Debes indicar el entorno: prod | test"
  exit 1
fi

# Usamos un solo = para máxima compatibilidad con sh/dash/bash
if [ "$ENV" = "prod" ]; then
  BRANCH="master"
elif [ "$ENV" = "test" ]; then
  BRANCH="develop"
else
  echo "❌ Entorno inválido. Usa: prod | test"
  exit 1
fi

COMPOSE_FILE="docker-compose.$ENV.yml"
ENV_FILE=".env.$ENV"
# IMPORTANTE: Para PROD, si quieres conservar los datos viejos,
# el PROJECT_NAME debe ser el que ya usabas.
if [ "$ENV" = "prod" ]; then
    PROJECT_NAME="tap-conector"
else
    PROJECT_NAME="tap-conector-$ENV"
fi

echo "--------------------------------"
echo "🌐 Entorno: $ENV | Rama: $BRANCH | Proyecto: $PROJECT_NAME"
echo "--------------------------------"

echo "📥 Actualizando código desde Git..."
git fetch origin

# Comprobación de rama compatible
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  echo "🔀 Cambiando de $CURRENT_BRANCH a $BRANCH..."
  git checkout "$BRANCH"
fi

git pull origin "$BRANCH"

echo "🚀 Iniciando despliegue de contenedores..."

docker compose \
  -p "$PROJECT_NAME" \
  -f "$COMPOSE_FILE" \
  --env-file "$ENV_FILE" \
  up -d --build --remove-orphans

echo "✅ Deploy $ENV completado con éxito"
