#!/bin/bash
set -e

# ============================================================
# Nexsentia - Hostinger VPS (Rocky Linux) Deployment Script
# Fully automated — generates all secrets, creates DB, configures everything
#
# Usage: chmod +x deploy.sh && ./deploy.sh
# ============================================================

DOMAIN="backend.nexsentia.com"
EMAIL="admin@nexsentia.com"
APP_DIR="$(pwd)"

# --- Helper: generate random secrets ---
gen_secret() { openssl rand -hex 32; }
gen_password() { openssl rand -base64 24 | tr -d '/+=' | head -c 32; }

DB_PASS=$(gen_password)
JWT_SEC=$(gen_secret)
JWT_REFRESH_SEC=$(gen_secret)
ENCRYPT_KEY=$(gen_secret)

echo "==> Deploying Nexsentia to Hostinger VPS (Rocky Linux)"
echo "    Domain: $DOMAIN"
echo "    Email:  $EMAIL"

# --- 1. System dependencies (Rocky Linux uses dnf) ---
echo "==> Installing system dependencies..."
sudo dnf install -y epel-release > /dev/null 2>&1
sudo dnf install -y curl git nginx certbot python3-certbot-nginx > /dev/null 2>&1

# --- 2. Node.js 20 ---
if ! command -v node &> /dev/null; then
  echo "==> Installing Node.js 20..."
  curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - > /dev/null 2>&1
  sudo dnf install -y nodejs > /dev/null 2>&1
fi
echo "    Node: $(node -v)"

# --- 3. PM2 ---
if ! command -v pm2 &> /dev/null; then
  echo "==> Installing PM2..."
  sudo npm install -g pm2 > /dev/null 2>&1
fi

# --- 4. MySQL 8 ---
if ! command -v mysql &> /dev/null; then
  echo "==> Installing MySQL 8..."
  sudo dnf install -y mysql-server > /dev/null 2>&1
  sudo systemctl enable mysqld
  sudo systemctl start mysqld
fi

echo "==> Setting up MySQL database & user..."
sudo mysql <<SQL
CREATE DATABASE IF NOT EXISTS nexsentia_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
DROP USER IF EXISTS 'nexsentia'@'localhost';
CREATE USER 'nexsentia'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON nexsentia_db.* TO 'nexsentia'@'localhost';
FLUSH PRIVILEGES;
SQL
echo "    MySQL database: nexsentia_db (user: nexsentia)"

# --- 5. Redis ---
if ! command -v redis-server &> /dev/null; then
  echo "==> Installing Redis..."
  sudo dnf install -y redis > /dev/null 2>&1
  sudo systemctl enable redis
  sudo systemctl start redis
fi

# --- 6. Firewall (Rocky Linux uses firewalld, not ufw) ---
echo "==> Configuring firewall..."
sudo systemctl enable firewalld
sudo systemctl start firewalld
sudo firewall-cmd --permanent --add-service=http > /dev/null
sudo firewall-cmd --permanent --add-service=https > /dev/null
sudo firewall-cmd --permanent --add-service=ssh > /dev/null
sudo firewall-cmd --reload > /dev/null

# --- 7. Create uploads directory ---
mkdir -p "$APP_DIR/uploads"

# --- 8. Generate .env ---
echo "==> Generating .env with auto-generated secrets..."
cat > .env <<EOF
# Application
NODE_ENV=production
PORT=3000
API_PREFIX=api/v1

# Database (MySQL)
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=nexsentia
DB_PASSWORD=${DB_PASS}
DB_DATABASE=nexsentia_db
DB_SYNCHRONIZE=false
DB_LOGGING=false

# JWT
JWT_SECRET=${JWT_SEC}
JWT_EXPIRATION=7d
JWT_REFRESH_SECRET=${JWT_REFRESH_SEC}
JWT_REFRESH_EXPIRATION=30d

# OAuth (Google)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://${DOMAIN}/api/v1/auth/google/callback

# CORS
CORS_ORIGIN=https://${DOMAIN},https://nexsentia.com,https://www.nexsentia.com,https://app.nexsentia.com
CORS_CREDENTIALS=true

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100

# Audit
AUDIT_RETENTION_DAYS=365

# Multi-tenant
TENANT_HEADER=x-tenant-id

# File Uploads (local disk)
UPLOAD_DIR=./uploads

# Email (Resend)
RESEND_API_KEY=re_ZbmFK4pF_5zkhDv8DQMCF1QbzG4UrJBss
EMAIL_FROM=noreply@nexsentia.com
EMAIL_FROM_NAME=Nexsentia
APP_URL=https://app.nexsentia.com

# Jira OAuth
JIRA_OAUTH_CLIENT_ID=your-jira-oauth-client-id
JIRA_OAUTH_CLIENT_SECRET=your-jira-oauth-client-secret
JIRA_OAUTH_CALLBACK_URL=https://${DOMAIN}/api/v1/jira/oauth/callback

# Jira Sync Settings
JIRA_SYNC_INTERVAL_MINUTES=15
JIRA_SYNC_CRON_SCHEDULE=*/10 * * * *

# Slack OAuth
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_REDIRECT_URI=https://${DOMAIN}/api/v1/slack/oauth/callback

# Slack Sync Settings
SLACK_SYNC_INTERVAL_MINUTES=30
SLACK_SYNC_CRON_SCHEDULE=0 */30 * * * *

# Microsoft Teams OAuth
TEAMS_CLIENT_ID=your-teams-client-id
TEAMS_CLIENT_SECRET=your-teams-client-secret
TEAMS_REDIRECT_URI=https://${DOMAIN}/api/v1/teams/oauth/callback
TEAMS_TENANT_ID=common

# Teams Sync Settings
TEAMS_SYNC_INTERVAL_MINUTES=30
TEAMS_SYNC_CRON_SCHEDULE=0 */30 * * * *

# ServiceNow OAuth
SERVICENOW_CLIENT_ID=your-servicenow-client-id
SERVICENOW_CLIENT_SECRET=your-servicenow-client-secret
SERVICENOW_REDIRECT_URI=https://${DOMAIN}/api/v1/servicenow/oauth/callback

# ServiceNow Sync Settings
SERVICENOW_SYNC_INTERVAL_MINUTES=30
SERVICENOW_SYNC_CRON_SCHEDULE=0 */30 * * * *

# Privacy & PII
ENCRYPTION_KEY=${ENCRYPT_KEY}

# Data Anonymization
ENABLE_ANONYMIZATION_CRON=true
ANONYMIZATION_CRON_SCHEDULE=0 */10 * * * *
ANONYMIZATION_CRON_TIMEZONE=America/New_York

# OpenAI
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4-turbo-preview

# Redis Cache
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Organizational Pulse Cache
ORG_PULSE_STARTUP_WARMING_ENABLED=false
ORG_PULSE_CACHE_INTERVAL_ENABLED=true
ORG_PULSE_CACHE_INTERVAL_MS=1500000
EOF

echo "    .env created with all secrets auto-generated"

# --- 9. Build app ---
echo "==> Installing dependencies..."
npm ci --quiet

echo "==> Building application..."
npm run build

# --- 10. Run migrations ---
echo "==> Running database migrations..."
npm run migration:run:prod

# --- 11. Nginx (Rocky Linux uses /etc/nginx/conf.d/) ---
echo "==> Configuring Nginx..."
sudo tee /etc/nginx/conf.d/nexsentia.conf > /dev/null <<NGINX
server {
    listen 80;
    server_name ${DOMAIN};

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
NGINX

# SELinux: allow nginx to proxy to Node.js
sudo setsebool -P httpd_can_network_connect 1 2>/dev/null || true

sudo nginx -t && sudo systemctl enable nginx && sudo systemctl restart nginx

# --- 12. SSL ---
echo "==> Obtaining SSL certificate..."
sudo certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${EMAIL}"

# Auto-renewal timer (Rocky Linux uses systemd timer, not cron)
sudo systemctl enable certbot-renew.timer 2>/dev/null || \
  (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'") | sort -u | crontab -

# --- 13. Start PM2 ---
echo "==> Starting application with PM2..."
pm2 delete nexsentia 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save

# Auto-start on reboot
PM2_STARTUP=$(pm2 startup systemd -u $(whoami) --hp $HOME | grep "sudo" | tail -1)
if [ -n "$PM2_STARTUP" ]; then
  eval "$PM2_STARTUP"
fi

echo ""
echo "============================================================"
echo "  Nexsentia deployed successfully on Rocky Linux!"
echo ""
echo "  API:     https://${DOMAIN}/api/v1"
echo "  Health:  https://${DOMAIN}/health"
echo ""
echo "  DB Password: ${DB_PASS}"
echo "  (saved in .env — this is the only time it's printed)"
echo ""
echo "  Replace placeholder values in .env when ready:"
echo "    - Google OAuth (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)"
echo "    - Jira OAuth (JIRA_OAUTH_CLIENT_ID, JIRA_OAUTH_CLIENT_SECRET)"
echo "    - Slack OAuth (SLACK_CLIENT_ID, SLACK_CLIENT_SECRET)"
echo "    - Teams OAuth (TEAMS_CLIENT_ID, TEAMS_CLIENT_SECRET)"
echo "    - ServiceNow OAuth (SERVICENOW_CLIENT_ID, SERVICENOW_CLIENT_SECRET)"
echo "    - OpenAI API Key (OPENAI_API_KEY)"
echo "  Then run: pm2 reload nexsentia"
echo ""
echo "  Commands:"
echo "    pm2 logs nexsentia        # View logs"
echo "    pm2 reload nexsentia      # Zero-downtime reload"
echo "    pm2 monit                  # Real-time monitoring"
echo "============================================================"
