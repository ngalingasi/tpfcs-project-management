# TPFCS Project Management System — REST API

A production-ready Node.js + Express + MySQL2 REST API for managing government projects, objectives, targets, activities, documents, and users.

## Tech Stack

| Layer | Library |
|---|---|
| Framework | Express 4 |
| Database | MySQL2 (promise pool) |
| Auth | Passport-JWT + JWT |
| Validation | Joi |
| Logging | Winston + Morgan |
| Security | Helmet, xss-clean, express-rate-limit |
| Email | Nodemailer |
| File Upload | Multer |
| Process Manager | PM2 |
| API Docs | Swagger (swagger-jsdoc + swagger-ui-express) |

## Database Schema

```
users → projects → objectives → targets → activities
                ↘ project_regions (regions)
                ↘ project_implementers (implementers)
                ↘ documents → document_versions
```

## Quick Start

```bash
# 1. Clone and install
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your DB credentials, JWT secret, SMTP settings

# 3. Set up the database
mysql -u root -p < tpfcs_projects.sql
mysql -u root -p tpfcs_projects < database/migrations/001_tokens_table.sql
mysql -u root -p tpfcs_projects < database/seed.sql

# 4. Start in development mode
npm run dev
```

## Docker

```bash
cp .env.example .env   # fill in values
docker-compose up --build
```

## API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | /v1/auth/login | Login (username or email + password) |
| POST | /v1/auth/logout | Logout (invalidate refresh token) |
| POST | /v1/auth/refresh-tokens | Get new access token |
| POST | /v1/auth/forgot-password | Send reset email |
| POST | /v1/auth/reset-password | Reset password via token |
| POST | /v1/auth/change-password | Change own password |
| GET  | /v1/auth/me | Get current user profile |

### Users
| Method | Endpoint | Description |
|---|---|---|
| POST | /v1/users | Create user (admin) |
| GET  | /v1/users | List users |
| GET  | /v1/users/:userId | Get user |
| PATCH | /v1/users/:userId | Update user |
| DELETE | /v1/users/:userId | Deactivate user |

### Projects
| Method | Endpoint | Description |
|---|---|---|
| POST | /v1/projects | Create project |
| GET  | /v1/projects | List projects (paginated) |
| GET  | /v1/projects/:projectId | Get project with details |
| PATCH | /v1/projects/:projectId | Update project |
| DELETE | /v1/projects/:projectId | Delete project |
| POST | /v1/projects/:projectId/objectives | Add objective |
| GET  | /v1/projects/:projectId/objectives | List objectives |
| POST | /v1/projects/:projectId/documents | Upload document |
| GET  | /v1/projects/:projectId/documents | List documents |

### Objectives
| Method | Endpoint | Description |
|---|---|---|
| GET  | /v1/objectives/:objectiveId | Get objective with targets |
| PATCH | /v1/objectives/:objectiveId | Update objective |
| DELETE | /v1/objectives/:objectiveId | Delete objective |
| POST | /v1/objectives/:objectiveId/targets | Add target |
| GET  | /v1/objectives/:objectiveId/targets | List targets |

### Targets
| Method | Endpoint | Description |
|---|---|---|
| GET  | /v1/targets/:targetId | Get target |
| PATCH | /v1/targets/:targetId | Update target (incl. current_value) |
| DELETE | /v1/targets/:targetId | Delete target |

### Activities
| Method | Endpoint | Description |
|---|---|---|
| POST | /v1/activities | Create activity |
| GET  | /v1/activities | List activities (filterable) |
| GET  | /v1/activities/:activityId | Get activity |
| PATCH | /v1/activities/:activityId | Update activity / progress / status |
| DELETE | /v1/activities/:activityId | Delete activity |
| GET  | /v1/activities/:activityId/history | Status change history |

### Documents
| Method | Endpoint | Description |
|---|---|---|
| GET  | /v1/documents/:documentId | Get document + all versions |
| POST | /v1/documents/:documentId/versions | Upload new version |
| GET  | /v1/documents/:documentId/download/:version? | Download file |
| DELETE | /v1/documents/:documentId | Delete document + files |

### Lookups
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | /v1/lookups/sectors | List / create sectors |
| GET/PATCH/DELETE | /v1/lookups/sectors/:sectorId | Manage sector |
| GET/POST | /v1/lookups/regions | List / create regions |
| GET/PATCH/DELETE | /v1/lookups/regions/:regionId | Manage region |
| GET/POST | /v1/lookups/implementers | List / create implementers |
| GET/PATCH/DELETE | /v1/lookups/implementers/:implementerId | Manage implementer |

## Roles & Permissions

| Role | Permissions |
|---|---|
| user | view projects, view/update own activities |
| manager | view/manage projects & activities, view users |
| admin | full access to all resources |

## Swagger Docs

Available at `http://localhost:3000/v1/docs` (development only).

## Default Admin Credentials

After running the seed:
- **Username:** `admin`
- **Password:** `password`

⚠️ Change immediately after first login — the account has `must_change_password = 1`.
