#!/bin/sh

set -e

echo '========================================='
echo 'Running database migrations'
echo '========================================='

# Check for leader file
if [ -f /opt/elasticbeanstalk/.leader-only ]; then
  echo 'Leader file found - this is the leader instance'
  IS_LEADER=true
else
  echo 'No leader file - assuming single instance or always run mode'
  IS_LEADER=true
fi

if [ "$IS_LEADER" = true ]; then
  echo 'Running migrations...'
  cd /var/app/current

  # Run migrations using production command
  if npm run migration:run:prod; then
    echo 'Migrations completed successfully'
  else
    echo 'Warning: Migration command failed or no migrations to run'
    exit 0  # Don't fail deployment if migrations fail
  fi
else
  echo 'Skipping migrations on non-leader instance'
fi

echo '========================================='
