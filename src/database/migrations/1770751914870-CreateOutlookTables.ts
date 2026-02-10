import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateOutlookTables1770751914870 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create outlook_connections table
        await queryRunner.query(`
            CREATE TABLE outlook_connections (
                id INT AUTO_INCREMENT PRIMARY KEY,
                tenantId INT NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                accessToken TEXT,
                refreshToken TEXT,
                tokenExpiresAt TIMESTAMP NULL,
                userId VARCHAR(255),
                isActive BOOLEAN DEFAULT TRUE,
                scopes JSON,
                lastSyncedAt TIMESTAMP NULL,
                syncState JSON,
                metadata JSON,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                deletedAt TIMESTAMP NULL,
                INDEX idx_outlook_connections_tenant (tenantId),
                INDEX idx_outlook_connections_email (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // Create outlook_mailboxes table
        await queryRunner.query(`
            CREATE TABLE outlook_mailboxes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                tenantId INT NOT NULL,
                connectionId INT NOT NULL,
                folderId VARCHAR(255) NOT NULL,
                folderName VARCHAR(255) NOT NULL,
                parentFolderId VARCHAR(255),
                folderType VARCHAR(50) DEFAULT 'mail',
                totalMessages INT DEFAULT 0,
                unreadMessages INT DEFAULT 0,
                metadata JSON,
                lastSyncedAt TIMESTAMP NULL,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                deletedAt TIMESTAMP NULL,
                INDEX idx_outlook_mailboxes_tenant_connection (tenantId, connectionId),
                INDEX idx_outlook_mailboxes_folderid (folderId),
                FOREIGN KEY (connectionId) REFERENCES outlook_connections(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // Create outlook_messages table
        await queryRunner.query(`
            CREATE TABLE outlook_messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                tenantId INT NOT NULL,
                mailboxId INT NOT NULL,
                outlookMessageId VARCHAR(255) NOT NULL UNIQUE,
                conversationId VARCHAR(255) NOT NULL,
                subject TEXT NOT NULL,
                bodyText LONGTEXT,
                bodyHtml LONGTEXT,
                bodyPreview TEXT,
                fromEmail VARCHAR(255) NOT NULL,
                fromName VARCHAR(255),
                toRecipients JSON,
                ccRecipients JSON,
                bccRecipients JSON,
                replyTo JSON,
                categories JSON,
                isRead BOOLEAN DEFAULT FALSE,
                isFlagged BOOLEAN DEFAULT FALSE,
                isImportant BOOLEAN DEFAULT FALSE,
                isDraft BOOLEAN DEFAULT FALSE,
                importance VARCHAR(50) DEFAULT 'normal',
                hasAttachment BOOLEAN DEFAULT FALSE,
                attachments JSON,
                internetMessageId VARCHAR(255),
                webLink VARCHAR(500),
                sizeBytes INT,
                parentFolderId VARCHAR(255),
                outlookCreatedAt TIMESTAMP NOT NULL,
                outlookReceivedAt TIMESTAMP NOT NULL,
                outlookSentAt TIMESTAMP NULL,
                lastModifiedAt TIMESTAMP NULL,
                lastSyncedAt TIMESTAMP NULL,
                metadata JSON,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                deletedAt TIMESTAMP NULL,
                INDEX idx_outlook_messages_tenant_mailbox (tenantId, mailboxId),
                INDEX idx_outlook_messages_outlookid (outlookMessageId),
                INDEX idx_outlook_messages_conversationid (conversationId),
                INDEX idx_outlook_messages_from (fromEmail),
                INDEX idx_outlook_messages_subject (subject(255)),
                INDEX idx_outlook_messages_created (outlookCreatedAt),
                FOREIGN KEY (mailboxId) REFERENCES outlook_mailboxes(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS outlook_messages`);
        await queryRunner.query(`DROP TABLE IF EXISTS outlook_mailboxes`);
        await queryRunner.query(`DROP TABLE IF EXISTS outlook_connections`);
    }

}
