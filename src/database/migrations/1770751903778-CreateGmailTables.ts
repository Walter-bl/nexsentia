import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateGmailTables1770751903778 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create gmail_connections table
        await queryRunner.query(`
            CREATE TABLE gmail_connections (
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
                INDEX idx_gmail_connections_tenant (tenantId),
                INDEX idx_gmail_connections_email (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // Create gmail_mailboxes table
        await queryRunner.query(`
            CREATE TABLE gmail_mailboxes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                tenantId INT NOT NULL,
                connectionId INT NOT NULL,
                labelId VARCHAR(255) NOT NULL,
                labelName VARCHAR(255) NOT NULL,
                labelType VARCHAR(50) DEFAULT 'label',
                totalMessages INT DEFAULT 0,
                unreadMessages INT DEFAULT 0,
                metadata JSON,
                lastSyncedAt TIMESTAMP NULL,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                deletedAt TIMESTAMP NULL,
                INDEX idx_gmail_mailboxes_tenant_connection (tenantId, connectionId),
                INDEX idx_gmail_mailboxes_labelid (labelId),
                FOREIGN KEY (connectionId) REFERENCES gmail_connections(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // Create gmail_messages table
        await queryRunner.query(`
            CREATE TABLE gmail_messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                tenantId INT NOT NULL,
                mailboxId INT NOT NULL,
                gmailMessageId VARCHAR(255) NOT NULL UNIQUE,
                gmailThreadId VARCHAR(255) NOT NULL,
                subject TEXT NOT NULL,
                bodyText LONGTEXT,
                bodyHtml LONGTEXT,
                snippet TEXT,
                fromEmail VARCHAR(255) NOT NULL,
                fromName VARCHAR(255),
                toRecipients JSON,
                ccRecipients JSON,
                bccRecipients JSON,
                labels JSON NOT NULL,
                isRead BOOLEAN DEFAULT FALSE,
                isStarred BOOLEAN DEFAULT FALSE,
                isImportant BOOLEAN DEFAULT FALSE,
                isDraft BOOLEAN DEFAULT FALSE,
                isSent BOOLEAN DEFAULT FALSE,
                isTrash BOOLEAN DEFAULT FALSE,
                isSpam BOOLEAN DEFAULT FALSE,
                hasAttachment BOOLEAN DEFAULT FALSE,
                attachments JSON,
                sizeBytes INT,
                headers JSON,
                \`references\` JSON,
                inReplyTo VARCHAR(255),
                gmailCreatedAt TIMESTAMP NOT NULL,
                lastSyncedAt TIMESTAMP NULL,
                metadata JSON,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                deletedAt TIMESTAMP NULL,
                INDEX idx_gmail_messages_tenant_mailbox (tenantId, mailboxId),
                INDEX idx_gmail_messages_gmailid (gmailMessageId),
                INDEX idx_gmail_messages_threadid (gmailThreadId),
                INDEX idx_gmail_messages_from (fromEmail),
                INDEX idx_gmail_messages_subject (subject(255)),
                INDEX idx_gmail_messages_created (gmailCreatedAt),
                FOREIGN KEY (mailboxId) REFERENCES gmail_mailboxes(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS gmail_messages`);
        await queryRunner.query(`DROP TABLE IF EXISTS gmail_mailboxes`);
        await queryRunner.query(`DROP TABLE IF EXISTS gmail_connections`);
    }

}
