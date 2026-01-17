import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly presignedUrlExpiry: number;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('s3.bucket') || 'nexsentia-uploads';
    this.presignedUrlExpiry = this.configService.get<number>('s3.presignedUrlExpiry') || 3600;

    this.s3Client = new S3Client({
      region: this.configService.get<string>('s3.region') || 'us-east-1',
      credentials: {
        accessKeyId: this.configService.get<string>('s3.accessKeyId') || '',
        secretAccessKey: this.configService.get<string>('s3.secretAccessKey') || '',
      },
    });
  }

  /**
   * Upload file to S3
   */
  async uploadFile(file: Buffer, key: string, contentType: string): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file,
        ContentType: contentType,
      });

      await this.s3Client.send(command);
      this.logger.log(`File uploaded successfully: ${key}`);

      return key;
    } catch (error) {
      this.logger.error(`Error uploading file: ${error.message}`, error.stack);
      throw new Error('Failed to upload file to S3');
    }
  }

  /**
   * Delete file from S3
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`File deleted successfully: ${key}`);
    } catch (error) {
      this.logger.error(`Error deleting file: ${error.message}`, error.stack);
      throw new Error('Failed to delete file from S3');
    }
  }

  /**
   * Generate presigned URL for file access
   */
  async getPresignedUrl(key: string, expiresIn?: number): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn: expiresIn || this.presignedUrlExpiry,
      });

      return url;
    } catch (error) {
      this.logger.error(`Error generating presigned URL: ${error.message}`, error.stack);
      throw new Error('Failed to generate presigned URL');
    }
  }

  /**
   * Generate presigned URL for file upload
   */
  async getPresignedUploadUrl(key: string, contentType: string, expiresIn?: number): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      });

      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn: expiresIn || this.presignedUrlExpiry,
      });

      return url;
    } catch (error) {
      this.logger.error(`Error generating presigned upload URL: ${error.message}`, error.stack);
      throw new Error('Failed to generate presigned upload URL');
    }
  }

  /**
   * Generate key for user profile image
   */
  generateProfileImageKey(userId: number, filename: string): string {
    const timestamp = Date.now();
    const extension = filename.split('.').pop();
    return `profile-images/${userId}/${timestamp}.${extension}`;
  }
}
