# Database Seeders

This directory contains database seeders for populating initial data into the Nexsentia database.

## Available Seeders

### 1. Roles and Permissions Seeder
**File:** `roles-permissions.seeder.ts`

Seeds the following roles with their respective permissions:

- **Super Admin**: Full system access across all tenants
  - All permissions

- **Admin**: Full access within tenant
  - Users: create, read, update, delete, list
  - Roles: create, read, update, delete, list
  - Audit: read, list
  - Reports: create, read, update, delete, list
  - Settings: read, update

- **Analyst**: Can create and view reports
  - Users: read
  - Reports: create, read, update, list
  - Settings: read

- **Viewer**: Read-only access to reports
  - Reports: read, list

## Running Seeders

### Development
```bash
npm run seed
```

### Production
```bash
npm run seed:prod
```

## Important Notes

1. **Idempotent**: Seeders are designed to be idempotent - they won't duplicate data if run multiple times
2. **Order Matters**: Seeders run in a specific order due to foreign key constraints
3. **Environment**: Seeders use the same database configuration as your application (from `.env` file)

## Adding New Seeders

1. Create a new seeder file in this directory (e.g., `tenants.seeder.ts`)
2. Export an async function that accepts `DataSource` as parameter
3. Add the seeder to `index.ts` in the appropriate order

Example:
```typescript
import { DataSource } from 'typeorm';
import { MyEntity } from '../../modules/my-module/entities/my-entity.entity';

export async function seedMyEntity(dataSource: DataSource): Promise<void> {
  const repository = dataSource.getRepository(MyEntity);

  // Your seeding logic here
  console.log('Seeding MyEntity...');

  // Example: Create or update records
  const existing = await repository.findOne({ where: { code: 'example' } });
  if (!existing) {
    await repository.save({
      code: 'example',
      name: 'Example Record',
    });
  }

  console.log('MyEntity seeding completed!');
}
```

Then add to `index.ts`:
```typescript
import { seedMyEntity } from './my-entity.seeder';

// In runSeeders function
await seedRolesAndPermissions(dataSource);
await seedMyEntity(dataSource); // Add here in correct order
```

## Troubleshooting

### Connection Issues
- Ensure your `.env` file has correct database credentials
- Verify database server is running
- Check database exists before running seeders

### Duplicate Key Errors
- Check if seeder is properly checking for existing records
- Ensure unique constraints are handled in the seeder logic

### Foreign Key Constraints
- Run seeders in the correct order (parent tables before child tables)
- Ensure referenced records exist before creating dependent records
