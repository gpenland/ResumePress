#!/bin/sh
set -e

# Run DB migrations on every startup (idempotent)
node node_modules/prisma/build/index.js migrate deploy

node server.js
