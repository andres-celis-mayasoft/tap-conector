#!/bin/bash

set -e

docker compose build
docker compose up -d
docker compose exec -T app npx prisma migrate deploy --schema=./prisma/schema.prisma
