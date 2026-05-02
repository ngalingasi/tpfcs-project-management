# TPFCS Production Deployment

## File Structure

```
tpfcs-project-management/   ← API (Node.js)
├── src/
├── dist/                   ← React dashboard build output (copied here)
├── uploads/                ← User uploaded files
├── .env
└── package.json

tpfcs-dashboard/            ← Dashboard source (build only, not on server)
```

## URL Layout

```
https://projects.tpfcs.co.tz/          → React SPA (from dist/)
https://projects.tpfcs.co.tz/api/v1/   → REST API
https://projects.tpfcs.co.tz/uploads/  → Uploaded files
```

---

## One-time Setup

### 1. Run database migrations (in order)

```bash
mysql -u root -p tpfcs_projects < database/migrations/001_tokens_table.sql
mysql -u root -p tpfcs_projects < database/migrations/002_activity_status_enum.sql
mysql -u root -p tpfcs_projects < database/migrations/003_budget_management.sql
mysql -u root -p tpfcs_projects < database/migrations/004_otp_verifications.sql
mysql -u root -p tpfcs_projects < database/migrations/005_project_improvements.sql
mysql -u root -p tpfcs_projects < database/migrations/006_project_financing.sql
mysql -u root -p tpfcs_projects < database/seeds/skills_seeder.sql
```

### 2. Install dependencies

```bash
cd tpfcs-project-management
npm install
```

### 3. Configure .env

```bash
cp .env.example .env
nano .env
```

Required values:

```env
NODE_ENV=production
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=tpfcs_projects
DB_TIMEZONE=+03:00
JWT_SECRET=<64-char-random>
JWT_ACCESS_EXPIRATION_MINUTES=30
JWT_REFRESH_EXPIRATION_DAYS=30
ALLOWED_ORIGINS=https://projects.tpfcs.co.tz
APP_URL=https://projects.tpfcs.co.tz
# SMTP settings...
# BRANDBOX settings...
```

---

## Build Dashboard

### On your local machine (recommended):

```bash
cd tpfcs-dashboard
npm install
npm run build:prod          # builds to tpfcs-dashboard/dist/

# Copy dist to server
scp -r dist/* user@your-server:/path/to/tpfcs-project-management/dist/
```

### Or from the API folder (if both folders are on same machine):

```bash
cd tpfcs-project-management
npm run build:dashboard     # builds dashboard and copies to ./dist/
```

---

## Start Server

### PM2 (recommended for production)

```bash
npm install -g pm2

pm2 start src/index.js --name tpfcs --env production
pm2 startup    # auto-start on reboot
pm2 save
```

### Manual

```bash
NODE_ENV=production node src/index.js
```

---

## Nginx (reverse proxy)

```nginx
server {
    listen 443 ssl http2;
    server_name projects.tpfcs.co.tz;

    ssl_certificate     /etc/letsencrypt/live/projects.tpfcs.co.tz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/projects.tpfcs.co.tz/privkey.pem;

    # Increase upload limit for documents
    client_max_body_size 50M;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name projects.tpfcs.co.tz;
    return 301 https://$host$request_uri;
}
```

---

## Update Deployment

```bash
# 1. Pull latest API changes
git pull

# 2. Rebuild dashboard (local) and copy to server
cd tpfcs-dashboard && npm run build:prod
scp -r dist/* user@server:/path/to/tpfcs-project-management/dist/

# 3. Reload API (zero downtime)
pm2 reload tpfcs
```

---

## Verify

```bash
# API health
curl https://projects.tpfcs.co.tz/health

# API endpoint
curl https://projects.tpfcs.co.tz/api/v1/auth/me

# Dashboard should load at
open https://projects.tpfcs.co.tz
```
