import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly uploadDir: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR') || './uploads';
    const appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3000';
    this.baseUrl = `${appUrl}/uploads`;

    // Ensure upload directory exists
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
    this.logger.log(`Local storage initialized at ${this.uploadDir}`);
  }

  async uploadFile(file: Buffer, key: string, contentType: string): Promise<string> {
    try {
      const filePath = path.join(this.uploadDir, key);
      const dir = path.dirname(filePath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, file);
      this.logger.log(`File uploaded successfully: ${key}`);
      return key;
    } catch (error) {
      this.logger.error(`Error uploading file: ${error.message}`, error.stack);
      throw new Error('Failed to upload file');
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const filePath = path.join(this.uploadDir, key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.log(`File deleted successfully: ${key}`);
      }
    } catch (error) {
      this.logger.error(`Error deleting file: ${error.message}`, error.stack);
      throw new Error('Failed to delete file');
    }
  }

  async getPresignedUrl(key: string, expiresIn?: number): Promise<string | null> {
    if (!key) return null;
    const filePath = path.join(this.uploadDir, key);
    if (!fs.existsSync(filePath)) {
      this.logger.debug(`File not found: ${key}`);
      return null;
    }
    return `${this.baseUrl}/${key}`;
  }

  async getPresignedUploadUrl(key: string, contentType: string, expiresIn?: number): Promise<string> {
    return `${this.baseUrl}/${key}`;
  }

  generateProfileImageKey(userId: number, filename: string): string {
    const timestamp = Date.now();
    const extension = filename.split('.').pop();
    return `profile-images/${userId}/${timestamp}.${extension}`;
  }
}
