# Nexsentia - Weak-Signal Detection Platform

## Overview

Nexsentia is an enterprise-grade SaaS platform designed to detect weak organizational, technical, and business signals early, enabling organizations to anticipate crises rather than react to them.

## Features

### Phase 0 - Platform Foundation ✅

- **Multi-tenant Architecture**: Isolated tenant data with tenant-aware entities
- **Authentication & Authorization**: JWT-based authentication with refresh tokens
- **Role-Based Access Control (RBAC)**: Granular permissions system
- **Audit Logging**: Complete audit trail of all system activities
- **Security**: Helmet.js, CORS configuration, password hashing with bcrypt
- **API Documentation**: Swagger/OpenAPI documentation

### User Roles

- **SUPER_ADMIN**: Full system access across all tenants
- **ADMIN**: Tenant-level administration
- **MANAGER**: Manage team and resources within tenant
- **ANALYST**: Read and analyze data (default role)
- **CONTRIBUTOR**: Create and edit content
- **VIEWER**: Read-only access to dashboards
- **GUEST**: Limited guest access

## Tech Stack

- **Framework**: NestJS 11.x
- **Language**: TypeScript 5.x
- **Database**: MySQL with TypeORM
- **Authentication**: JWT + Passport
- **Documentation**: Swagger/OpenAPI
- **Security**: Helmet, bcrypt, CORS
- **Validation**: class-validator, class-transformer

## Prerequisites

- Node.js 20+ (LTS recommended)
- MySQL 8.0+
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd NexSentia
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and configure your database and security settings:
   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_USERNAME=nexsentia
   DB_PASSWORD=your_password
   DB_DATABASE=nexsentia_db

   JWT_SECRET=your-secret-key
   JWT_REFRESH_SECRET=your-refresh-secret-key
   ```

4. **Create MySQL database**

   **Option A: Using the setup script (recommended)**
   ```bash
   mysql -u root -p < scripts/setup-db.sql
   ```

   **Option B: Manual setup**
   ```bash
   mysql -u root -p
   CREATE DATABASE nexsentia_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'nexsentia'@'localhost' IDENTIFIED BY 'nexsentia_password';
   GRANT ALL PRIVILEGES ON nexsentia_db.* TO 'nexsentia'@'localhost';
   FLUSH PRIVILEGES;
   EXIT;
   ```

   **⚠️ Important**: Change the default password in production!

5. **Run database migrations**
   ```bash
   npm run migration:run
   ```

   This will create all the necessary tables (tenants, users, audit_logs) with proper indexes and foreign keys.

## Running the Application

### Development Mode
```bash
npm run start:dev
```

### Production Mode
```bash
npm run build
npm run start:prod
```

### Debug Mode
```bash
npm run start:debug
```

## Database Migrations

This project uses TypeORM migrations for database schema management. **Never use `DB_SYNCHRONIZE=true` in production.**

### Running Migrations

```bash
# Run all pending migrations
npm run migration:run

# Revert the last migration
npm run migration:revert
```

### Creating New Migrations

When you add or modify entities, you can either generate a migration automatically or create an empty one manually:

```bash
# Generate migration from entity changes (recommended)
npm run migration:generate -- src/database/migrations/YourMigrationName

# Create an empty migration to write manually
npm run migration:create src/database/migrations/YourMigrationName
```

### Migration Files

Migrations are located in `src/database/migrations/` and run in order by timestamp. The initial schema includes three separate migrations:

1. **CreateTenantsTable** - Multi-tenant organizations
   - Subscription tier management (free, starter, professional, enterprise)
   - Unique slug and name constraints
   - JSON settings field for extensibility

2. **CreateUsersTable** - User authentication and RBAC
   - 7 role types: super_admin, admin, manager, analyst, contributor, viewer, guest
   - Email verification and password reset tokens
   - Composite unique index on email + tenantId
   - Foreign key to tenants with CASCADE delete

3. **CreateAuditLogsTable** - Comprehensive audit trail
   - 12 audit action types
   - Request tracking (method, path, status, user agent)
   - Change tracking with before/after snapshots
   - Foreign keys to tenants and users
   - Optimized indexes for common queries

## API Documentation

Once the application is running, access the Swagger documentation at:
```
http://localhost:3000/api/docs
```

## API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/auth/register` | Register new user/tenant | No |
| POST | `/api/v1/auth/login` | Login user | No |
| POST | `/api/v1/auth/refresh` | Refresh access token | No |
| GET | `/api/v1/auth/me` | Get current user profile | Yes |
| POST | `/api/v1/auth/logout` | Logout user | Yes |

### Audit Logs

| Method | Endpoint | Description | Permission Required |
|--------|----------|-------------|---------------------|
| GET | `/api/v1/audit` | Get audit logs | AUDIT_READ |
| GET | `/api/v1/audit/user/:userId` | Get user audit logs | AUDIT_READ |
| GET | `/api/v1/audit/resource/:resource/:id` | Get resource audit logs | AUDIT_READ |

## Multi-Tenancy

Nexsentia implements tenant isolation at the database level:

- Each tenant has a unique auto-increment ID
- All tenant-aware entities include a `tenantId` field
- Queries are automatically scoped to the authenticated user's tenant
- First user in a tenant is automatically assigned SUPER_ADMIN role

## Security Features

1. **Password Security**: Bcrypt hashing with configurable rounds
2. **JWT Tokens**: Separate access and refresh tokens
3. **CORS**: Configurable allowed origins
4. **Helmet**: Security headers for HTTP responses
5. **Input Validation**: Automatic DTO validation with class-validator
6. **SQL Injection Protection**: TypeORM parameterized queries

## Project Structure

```
src/
├── common/              # Shared resources
│   ├── decorators/      # Custom decorators (@Public, @Roles, etc.)
│   ├── entities/        # Base entities
│   ├── enums/           # Enums (roles, permissions, actions)
│   ├── guards/          # Auth guards (JWT, RBAC)
│   ├── interfaces/      # TypeScript interfaces
│   └── interceptors/    # Interceptors (audit logging)
├── config/              # Configuration files
│   ├── database/        # Database config & TypeORM setup
│   └── security/        # Security config (JWT, bcrypt)
├── database/            # Database resources
│   └── migrations/      # TypeORM migrations
├── modules/             # Feature modules
│   ├── auth/            # Authentication module
│   ├── users/           # User management
│   ├── tenants/         # Tenant management
│   └── audit/           # Audit logging
├── app.module.ts        # Root module
└── main.ts              # Application entry point

scripts/
└── setup-db.sql         # MySQL database setup script
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | development |
| `PORT` | Application port | 3000 |
| `DB_HOST` | MySQL host | localhost |
| `DB_PORT` | MySQL port | 3306 |
| `DB_USERNAME` | Database username | nexsentia |
| `DB_PASSWORD` | Database password | - |
| `DB_DATABASE` | Database name | nexsentia_db |
| `DB_SYNCHRONIZE` | Auto-sync schema (use false) | false |
| `DB_LOGGING` | Enable database query logging | false |
| `JWT_SECRET` | JWT access token secret | - |
| `JWT_EXPIRATION` | JWT access token expiration | 7d |
| `JWT_REFRESH_SECRET` | JWT refresh token secret | - |
| `JWT_REFRESH_EXPIRATION` | Refresh token expiration | 30d |
| `BCRYPT_ROUNDS` | Bcrypt hashing rounds | 10 |
| `CORS_ORIGIN` | Allowed CORS origins (comma-separated) | * |

## Development Roadmap

### ✅ Phase 0 - Platform Foundation
- Multi-tenant architecture
- Authentication & RBAC
- Audit logging
- Security setup

### 🚧 Phase 1 - Data Ingestion (Next)
- ServiceNow connector
- Jira connector
- Slack/Teams connector
- Microsoft Outlook connector
- Event normalization

### 📋 Phase 2 - Privacy & Graph Modeling
- PII anonymization
- Graph database setup
- Relationship mapping

### 📋 Phase 3 - Weak-Signal Detection
- Pattern extraction
- Trend acceleration
- Hypothesis generation

### 📋 Phase 4 - KPI Engine
- Organizational health KPIs
- Business impact KPIs
- Technical KPIs

### 📋 Phase 5 - Frontend UI
- Executive dashboard
- Graph visualization
- Role-specific journeys

### 📋 Phase 6 - Conversational AI
- Role-aware chat
- Context retrieval
- Prompt governance

## Testing

```bash
# Unit tests
npm run test

# e2e tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Build the application |
| `npm run start` | Start the application |
| `npm run start:dev` | Start in watch mode |
| `npm run start:prod` | Start production build |
| `npm run lint` | Lint code |
| `npm run format` | Format code with Prettier |
| `npm run migration:generate` | Generate migration from entity changes |
| `npm run migration:create` | Create empty migration file |
| `npm run migration:run` | Run all pending migrations |
| `npm run migration:revert` | Revert last migration |

## Contributing

This is a proprietary enterprise platform. Contact the Nexsentia team for contribution guidelines.

## License

PROPRIETARY - All rights reserved

## Support

For support and inquiries, contact the Nexsentia development team.
