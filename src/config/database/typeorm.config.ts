import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';

config();

const isCompiled = __filename.endsWith('.js');
const basePath = isCompiled ? 'dist' : 'src';
const extension = isCompiled ? 'js' : 'ts';

export const typeOrmConfig: DataSourceOptions = {
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || undefined,
  database: process.env.DB_DATABASE || 'nexsentia_db',
  entities: [`${basePath}/**/*.entity.${extension}`],
  migrations: [`${basePath}/database/migrations/*.${extension}`],
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true' || false,
};

const dataSource = new DataSource(typeOrmConfig);
export default dataSource;
