#!/bin/sh

set -e

echo '========================================='
echo 'Running database seeders'
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
  echo 'Running seeders...'
  cd /var/app/current

  # Run seeders using production command
  if npm run seed:prod; then
    echo 'Seeders completed successfully'
  else
    echo 'Warning: Seeder command failed or no seeders to run'
    exit 0  # Don't fail deployment if seeders fail
  fi
else
  echo 'Skipping seeders on non-leader instance'
fi

echo '========================================='
