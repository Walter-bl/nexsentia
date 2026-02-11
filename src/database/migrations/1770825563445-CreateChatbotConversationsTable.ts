import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateChatbotConversationsTable1770825563445 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`chatbot_conversations\` (
                \`id\` int NOT NULL AUTO_INCREMENT,
                \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                \`deletedAt\` datetime(6) NULL,
                \`tenantId\` int NOT NULL,
                \`sessionId\` varchar(255) NOT NULL,
                \`userId\` int NULL,
                \`messages\` json NOT NULL,
                \`metadata\` json NULL,
                \`lastMessageAt\` timestamp NULL,
                PRIMARY KEY (\`id\`),
                INDEX \`IDX_chatbot_conversations_tenantId_sessionId\` (\`tenantId\`, \`sessionId\`),
                INDEX \`IDX_chatbot_conversations_tenantId_userId\` (\`tenantId\`, \`userId\`)
            ) ENGINE=InnoDB
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`chatbot_conversations\``);
    }

}
