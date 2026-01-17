#!/bin/sh

set -e

echo '========================================='
echo 'Loading environment variables'
echo '========================================='

echo 'Current directory:'
pwd

echo ''
echo 'Step 1: Get environment variables from Elastic Beanstalk configuration'
/opt/elasticbeanstalk/bin/get-config environment | /bin/jq -r 'to_entries | .[] | "\(.key)=\"\(.value)\""' > .env

echo 'Step 2: Get Instance metadata'
INSTANCE_ID="$(ec2-metadata --instance-id | sed -r -e 's/^[A-Za-z0-9-]+:\s*//')"
echo "Instance ID: ${INSTANCE_ID}"
echo 'EC2_INSTANCE_ID="'${INSTANCE_ID}'"' >> .env

echo ''
echo 'Step 3: Get environment name and region'
ENVIRONMENT_NAME="$(/opt/elasticbeanstalk/bin/get-config --output YAML container --key environment_name)"
ENVIRONMENT_REGION="$(ec2-metadata -z | sed -r -e 's/^[A-Za-z0-9-]+:\s*//' -e 's/[a-z]$//')"

echo "Environment: ${ENVIRONMENT_NAME}"
echo "Region: ${ENVIRONMENT_REGION}"

echo 'EB_ENV_NAME="'${ENVIRONMENT_NAME}'"' >> .env
echo 'EB_ENV_REGION="'${ENVIRONMENT_REGION}'"' >> .env

echo ''
echo 'Step 4: Get environment variables from AWS Parameter Store'
echo 'Loading from path: /NexSentia-env/NexSentia/'

aws ssm get-parameters-by-path \
  --path "/NexSentia-env/NexSentia/" \
  --region ${ENVIRONMENT_REGION} \
  --with-decryption \
  --query 'Parameters[].[Name,Value]' \
  --output text | while read -r name value; do
    # Extract the parameter name (everything after the last /)
    param_name=$(echo "$name" | awk -F'/' '{print $NF}')
    echo "${param_name}=\"${value}\"" >> .env
done

echo ''
echo '========================================='
echo 'Environment file created successfully'
echo '========================================='

# Show parameter count (without values for security)
param_count=$(wc -l < .env)
echo "Total environment variables loaded: ${param_count}"
