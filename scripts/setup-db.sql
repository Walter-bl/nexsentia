-- NexSentia Database Setup Script
-- Run this script with: mysql -u root -p < scripts/setup-db.sql

-- Create database
CREATE DATABASE IF NOT EXISTS nexsentia_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user (change password in production!)
CREATE USER IF NOT EXISTS 'nexsentia'@'localhost' IDENTIFIED BY 'nexsentia_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON nexsentia_db.* TO 'nexsentia'@'localhost';

-- Apply privileges
FLUSH PRIVILEGES;

-- Use the database
USE nexsentia_db;

-- Show confirmation
SELECT 'Database nexsentia_db created successfully!' AS status;
SELECT 'User nexsentia@localhost created successfully!' AS status;
SELECT 'Run migrations with: npm run migration:run' AS next_step;
