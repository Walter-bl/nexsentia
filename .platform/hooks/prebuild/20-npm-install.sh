#!/bin/sh

set -e

echo '========================================='
echo 'Installing Node.js dependencies'
echo '========================================='

# Install production dependencies from package-lock.json
npm ci --omit=dev --no-audit --no-fund

echo ''
echo '========================================='
echo 'Dependencies installed successfully'
echo '========================================='
