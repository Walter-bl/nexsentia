import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { AnonymizationMapping } from '../entities/anonymization-mapping.entity';

@Injectable()
export class PiiAnonymizationService {
  private readonly logger = new Logger(PiiAnonymizationService.name);
  private readonly encryptionKey: Buffer;
  private readonly algorithm = 'aes-256-gcm';

  constructor(
    @InjectRepository(AnonymizationMapping)
    private readonly mappingRepository: Repository<AnonymizationMapping>,
    private readonly configService: ConfigService,
  ) {
    // Initialize encryption key from environment
    const key = this.configService.get<string>('ENCRYPTION_KEY');
    if (!key) {
      throw new Error('ENCRYPTION_KEY must be set in environment variables');
    }
    this.encryptionKey = Buffer.from(key, 'hex');
    if (this.encryptionKey.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
    }
  }

  /**
   * Hash a value using SHA-256 (one-way)
   */
  hash(value: string, salt?: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(value);
    if (salt) {
      hash.update(salt);
    }
    return hash.digest('hex');
  }

  /**
   * Encrypt a value using AES-256-GCM
   */
  private encrypt(plaintext: string): { encrypted: string; iv: string; authTag: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  /**
   * Decrypt a value using AES-256-GCM
   */
  private decrypt(encrypted: string, iv: string, authTag: string): string {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.encryptionKey,
      Buffer.from(iv, 'hex'),
    );

    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Tokenize a PII value (reversible anonymization)
   */
  async tokenize(
    tenantId: number,
    value: string,
    piiType: string,
    sourceType?: string,
    sourceId?: string,
  ): Promise<string> {
    // Check if this value already has a token
    const valueHash = this.hash(value);
    const existing = await this.mappingRepository.findOne({
      where: {
        tenantId,
        originalValueHash: valueHash,
        piiType,
        isActive: true,
      },
    });

    if (existing) {
      // Update last accessed timestamp
      existing.lastAccessedAt = new Date();
      if (existing.metadata) {
        existing.metadata.accessCount = (existing.metadata.accessCount || 0) + 1;
      }
      await this.mappingRepository.save(existing);
      return existing.tokenId;
    }

    // Create new token
    const tokenId = this.generateTokenId(piiType);
    const { encrypted, iv, authTag } = this.encrypt(value);
    const encryptedValue = `${encrypted}:${iv}:${authTag}`;

    const mapping = this.mappingRepository.create({
      tenantId,
      tokenId,
      originalValueHash: valueHash,
      encryptedValue,
      piiType,
      method: 'tokenization',
      metadata: {
        sourceType,
        sourceId,
        accessCount: 0,
      },
      isActive: true,
    });

    await this.mappingRepository.save(mapping);

    this.logger.log(`Created token ${tokenId} for ${piiType}`);
    return tokenId;
  }

  /**
   * Detokenize a token back to original value
   */
  async detokenize(tenantId: number, tokenId: string): Promise<string> {
    const mapping = await this.mappingRepository.findOne({
      where: {
        tenantId,
        tokenId,
        isActive: true,
      },
    });

    if (!mapping) {
      throw new BadRequestException('Invalid or expired token');
    }

    // Update last accessed
    mapping.lastAccessedAt = new Date();
    if (mapping.metadata) {
      mapping.metadata.accessCount = (mapping.metadata.accessCount || 0) + 1;
    }
    await this.mappingRepository.save(mapping);

    // Decrypt the value
    const [encrypted, iv, authTag] = mapping.encryptedValue.split(':');
    return this.decrypt(encrypted, iv, authTag);
  }

  /**
   * Mask a value (partial anonymization)
   */
  mask(value: string, piiType: string): string {
    switch (piiType) {
      case 'email':
        return this.maskEmail(value);
      case 'phone_us':
      case 'phone_intl':
        return this.maskPhone(value);
      case 'ssn':
        return this.maskSSN(value);
      case 'credit_card':
        return this.maskCreditCard(value);
      default:
        return this.maskGeneric(value);
    }
  }

  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!domain) return '***@***';

    const visibleChars = Math.min(2, Math.floor(localPart.length / 2));
    const masked = localPart.substring(0, visibleChars) + '***';
    return `${masked}@${domain}`;
  }

  private maskPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 10) {
      return `***-***-${digits.slice(-4)}`;
    }
    return '***-***-****';
  }

  private maskSSN(ssn: string): string {
    const digits = ssn.replace(/\D/g, '');
    if (digits.length === 9) {
      return `***-**-${digits.slice(-4)}`;
    }
    return '***-**-****';
  }

  private maskCreditCard(card: string): string {
    const digits = card.replace(/\D/g, '');
    if (digits.length >= 13) {
      return `****-****-****-${digits.slice(-4)}`;
    }
    return '****-****-****-****';
  }

  private maskGeneric(value: string): string {
    if (value.length <= 4) {
      return '***';
    }
    const visibleChars = Math.min(2, Math.floor(value.length / 4));
    return value.substring(0, visibleChars) + '***' + value.substring(value.length - visibleChars);
  }

  /**
   * Anonymize a field value based on method
   */
  async anonymize(
    tenantId: number,
    value: string,
    piiType: string,
    method: 'hash' | 'tokenize' | 'encrypt' | 'mask',
    sourceType?: string,
    sourceId?: string,
  ): Promise<string> {
    switch (method) {
      case 'hash':
        return this.hash(value);
      case 'tokenize':
        return await this.tokenize(tenantId, value, piiType, sourceType, sourceId);
      case 'mask':
        return this.mask(value, piiType);
      case 'encrypt':
        const { encrypted, iv, authTag } = this.encrypt(value);
        return `${encrypted}:${iv}:${authTag}`;
      default:
        throw new BadRequestException(`Unknown anonymization method: ${method}`);
    }
  }

  /**
   * Generate a unique token ID
   */
  private generateTokenId(piiType: string): string {
    const prefix = piiType.toUpperCase().replace(/[^A-Z]/g, '');
    const random = crypto.randomBytes(16).toString('hex');
    return `${prefix}_TOKEN_${random}`;
  }

  /**
   * Revoke a token (mark as inactive)
   */
  async revokeToken(tenantId: number, tokenId: string): Promise<void> {
    await this.mappingRepository.update(
      {
        tenantId,
        tokenId,
      },
      {
        isActive: false,
      },
    );

    this.logger.log(`Revoked token ${tokenId} for tenant ${tenantId}`);
  }

  /**
   * Get all active tokens for a tenant
   */
  async getTokens(
    tenantId: number,
    piiType?: string,
  ): Promise<AnonymizationMapping[]> {
    const where: any = {
      tenantId,
      isActive: true,
    };

    if (piiType) {
      where.piiType = piiType;
    }

    return await this.mappingRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Cleanup expired tokens
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.mappingRepository
      .createQueryBuilder()
      .update()
      .set({ isActive: false })
      .where('expiresAt IS NOT NULL')
      .andWhere('expiresAt < :now', { now: new Date() })
      .andWhere('isActive = :active', { active: true })
      .execute();

    const count = result.affected || 0;
    this.logger.log(`Cleaned up ${count} expired tokens`);
    return count;
  }

  /**
   * Get anonymization statistics
   */
  async getStatistics(tenantId: number): Promise<{
    totalTokens: number;
    activeTokens: number;
    revokedTokens: number;
    byPiiType: Record<string, number>;
    byMethod: Record<string, number>;
  }> {
    const allTokens = await this.mappingRepository.find({
      where: { tenantId },
    });

    const byPiiType: Record<string, number> = {};
    const byMethod: Record<string, number> = {};
    let activeCount = 0;

    for (const token of allTokens) {
      byPiiType[token.piiType] = (byPiiType[token.piiType] || 0) + 1;
      byMethod[token.method] = (byMethod[token.method] || 0) + 1;
      if (token.isActive) {
        activeCount++;
      }
    }

    return {
      totalTokens: allTokens.length,
      activeTokens: activeCount,
      revokedTokens: allTokens.length - activeCount,
      byPiiType,
      byMethod,
    };
  }
}
