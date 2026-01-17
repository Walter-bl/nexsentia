# Database Migrations

This directory contains TypeORM database migrations for the Nexsentia application.

## Migration Commands

### Development

#### Create a new migration
```bash
npm run migration:create src/database/migrations/MigrationName
```

#### Generate migration from entity changes
```bash
npm run migration:generate src/database/migrations/MigrationName
```

#### Run pending migrations
```bash
npm run migration:run
```

#### Revert last migration
```bash
npm run migration:revert
```

### Production

#### Run pending migrations
```bash
npm run migration:run:prod
```

#### Revert last migration
```bash
npm run migration:revert:prod
```

## Migration Workflow

### 1. Creating Migrations

**Option A: Auto-generate from entity changes (Recommended)**
```bash
# Make changes to your entities first
# Then generate migration
npm run migration:generate src/database/migrations/AddUserProfileImage
```

**Option B: Create empty migration**
```bash
npm run migration:create src/database/migrations/CustomMigration
```

### 2. Review Migration
- Check the generated SQL in the migration file
- Ensure `up()` and `down()` methods are correct
- Test migration in development first

### 3. Run Migration
```bash
npm run migration:run
```

### 4. Rollback if Needed
```bash
npm run migration:revert
```

## Best Practices

### 1. Naming Conventions
- Use descriptive names: `AddEmailVerificationToUsers`
- Use camelCase for migration class names
- Files are auto-prefixed with timestamp

### 2. Data Safety
- **Always backup production database before migrations**
- Test migrations in development/staging first
- Use transactions for data transformations
- Never delete migrations that have run in production

### 3. Migration Content
```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailVerificationToUsers1234567890123 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add your SQL here
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN emailVerificationToken VARCHAR(255) NULL,
      ADD COLUMN emailVerifiedAt TIMESTAMP NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert changes
    await queryRunner.query(`
      ALTER TABLE users
      DROP COLUMN emailVerificationToken,
      DROP COLUMN emailVerifiedAt
    `);
  }
}
```

### 4. Complex Migrations
For data transformations or complex changes:
```typescript
public async up(queryRunner: QueryRunner): Promise<void> {
  // Start transaction
  await queryRunner.startTransaction();

  try {
    // Your migration steps
    await queryRunner.query(`ALTER TABLE ...`);
    await queryRunner.query(`UPDATE ...`);

    // Commit transaction
    await queryRunner.commitTransaction();
  } catch (error) {
    // Rollback on error
    await queryRunner.rollbackTransaction();
    throw error;
  }
}
```

## Production Deployment

### Automatic Migrations (Recommended)
Migrations run automatically on deployment via the postdeploy hook:
`.platform/hooks/postdeploy/01-run-migrations.sh`

### Manual Migrations
If automatic migrations are disabled:
```bash
# SSH into production server
ssh your-server

# Navigate to app directory
cd /var/app/current

# Run migrations
npm run migration:run:prod
```

## Troubleshooting

### Migration Failed Midway
```bash
# Revert the failed migration
npm run migration:revert

# Fix the migration file
# Run again
npm run migration:run
```

### Pending Migrations Check
```bash
# View migration status
npm run typeorm migration:show -d src/config/database/typeorm.config.ts
```

### Lock Issues
If migrations are stuck due to locks:
```sql
-- Check for locks (MySQL)
SHOW OPEN TABLES WHERE In_use > 0;

-- Kill locked process
KILL <process_id>;
```

## Migration Table

TypeORM tracks migrations in the `migrations` table:
- `id`: Auto-increment ID
- `timestamp`: Migration timestamp from filename
- `name`: Migration class name

**Never manually modify this table unless you know what you're doing!**

## Environment-Specific Migrations

### Development
- Use `DB_SYNCHRONIZE=false` to rely on migrations
- Test all migrations before production
- Keep database schema in sync with entities

### Staging
- Mirror production settings
- Test migrations here first
- Verify data integrity after migrations

### Production
- **Always backup first**
- Run during low-traffic periods
- Monitor application logs after migration
- Have rollback plan ready

## Common Issues

### "Entity was not found" Error
- Ensure entity is imported in TypeORM config
- Check entity file paths in `typeorm.config.ts`

### "Table already exists" Error
- Migration already ran
- Check `migrations` table
- May need to manually adjust migration state

### Foreign Key Constraint Failures
- Ensure parent tables exist first
- Check data integrity
- May need to temporarily disable FK checks (carefully!)

## Additional Resources

- [TypeORM Migrations Documentation](https://typeorm.io/migrations)
- [MySQL Migration Best Practices](https://dev.mysql.com/doc/refman/8.0/en/schema-change-optimization.html)
