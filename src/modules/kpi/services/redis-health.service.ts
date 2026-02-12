import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';

export interface RedisHealthStatus {
  connected: boolean;
  type: 'redis' | 'memory';
  host?: string;
  port?: number;
  latencyMs?: number;
  error?: string;
  lastChecked: Date;
}

@Injectable()
export class RedisHealthService implements OnModuleInit {
  private readonly logger = new Logger(RedisHealthService.name);
  private lastHealthStatus: RedisHealthStatus | null = null;
  private readonly isRedisConfigured: boolean;
  private readonly redisHost: string | undefined;
  private readonly redisPort: number;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly configService: ConfigService,
  ) {
    this.redisHost = this.configService.get<string>('REDIS_HOST');
    this.redisPort = this.configService.get<number>('REDIS_PORT', 6379);
    this.isRedisConfigured = !!this.redisHost;
  }

  async onModuleInit(): Promise<void> {
    // Check connection on startup
    const status = await this.checkHealth();
    if (status.connected) {
      this.logger.log(`✅ Cache connected: ${status.type.toUpperCase()}${status.host ? ` at ${status.host}:${status.port}` : ''}`);
    } else {
      this.logger.warn(`⚠️ Cache connection issue: ${status.error || 'Unknown error'}`);
    }
  }

  /**
   * Check Redis/cache health status
   */
  async checkHealth(): Promise<RedisHealthStatus> {
    const startTime = Date.now();

    try {
      // Test write
      const testKey = `health_check_${Date.now()}`;
      const testValue = 'ping';
      await this.cacheManager.set(testKey, testValue, 5000); // 5 second TTL

      // Test read
      const readValue = await this.cacheManager.get(testKey);

      // Clean up
      await this.cacheManager.del(testKey);

      const latencyMs = Date.now() - startTime;

      if (readValue !== testValue) {
        this.lastHealthStatus = {
          connected: false,
          type: this.isRedisConfigured ? 'redis' : 'memory',
          host: this.redisHost,
          port: this.redisPort,
          latencyMs,
          error: 'Read value mismatch - cache may be corrupted',
          lastChecked: new Date(),
        };
        return this.lastHealthStatus;
      }

      this.lastHealthStatus = {
        connected: true,
        type: this.isRedisConfigured ? 'redis' : 'memory',
        host: this.redisHost,
        port: this.redisPort,
        latencyMs,
        lastChecked: new Date(),
      };

      return this.lastHealthStatus;
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      this.lastHealthStatus = {
        connected: false,
        type: this.isRedisConfigured ? 'redis' : 'memory',
        host: this.redisHost,
        port: this.redisPort,
        latencyMs,
        error: error.message || 'Unknown error',
        lastChecked: new Date(),
      };

      this.logger.error(`Cache health check failed: ${error.message}`);
      return this.lastHealthStatus;
    }
  }

  /**
   * Get last cached health status (fast, no actual check)
   */
  getLastHealthStatus(): RedisHealthStatus | null {
    return this.lastHealthStatus;
  }

  /**
   * Check if Redis is configured (vs in-memory fallback)
   */
  isUsingRedis(): boolean {
    return this.isRedisConfigured;
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    type: 'redis' | 'memory';
    configured: boolean;
    connected: boolean;
    host?: string;
    port?: number;
  }> {
    const health = await this.checkHealth();
    return {
      type: health.type,
      configured: this.isRedisConfigured,
      connected: health.connected,
      host: this.redisHost,
      port: this.redisPort,
    };
  }
}
