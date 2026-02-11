import { Injectable, Logger, Inject, forwardRef, OnModuleInit } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MetricDefinition } from '../entities/metric-definition.entity';
import { OrganizationalPulseService } from './organizational-pulse.service';

/**
 * Service to cache and preload organizational pulse data
 * Prevents 504 gateway timeout by caching expensive computations
 *
 * IMPORTANT: This service now actually preloads data by calling OrganizationalPulseService
 * to warm the cache BEFORE user requests, making even the first request fast.
 */
@Injectable()
export class OrganizationalPulseCacheService implements OnModuleInit {
  private readonly logger = new Logger(OrganizationalPulseCacheService.name);
  private readonly CACHE_TTL = 300000; // 5 minutes in milliseconds
  private readonly CACHE_KEY_PREFIX = 'org_pulse';

  // Track tenants for preloading
  private activeTenants: Set<number> = new Set();

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @InjectRepository(MetricDefinition)
    private readonly metricDefinitionRepository: Repository<MetricDefinition>,
    @Inject(forwardRef(() => OrganizationalPulseService))
    private readonly pulseService: OrganizationalPulseService,
  ) {}

  /**
   * Get cache key for organizational pulse data
   */
  getCacheKey(tenantId: number, timeRange: string): string {
    return `${this.CACHE_KEY_PREFIX}:${tenantId}:${timeRange}`;
  }

  /**
   * Get cached organizational pulse data
   */
  async get(tenantId: number, timeRange: string): Promise<any | null> {
    const key = this.getCacheKey(tenantId, timeRange);
    try {
      const cached = await this.cacheManager.get(key);
      if (cached) {
        this.logger.debug(`Cache HIT for ${key}`);
        return cached;
      }
      this.logger.debug(`Cache MISS for ${key}`);
      return null;
    } catch (error) {
      this.logger.error(`Error getting cache for ${key}:`, error);
      return null;
    }
  }

  /**
   * Set organizational pulse data in cache
   */
  async set(tenantId: number, timeRange: string, data: any): Promise<void> {
    const key = this.getCacheKey(tenantId, timeRange);
    try {
      await this.cacheManager.set(key, data, this.CACHE_TTL);
      this.logger.log(`Cached organizational pulse for tenant ${tenantId}, timeRange ${timeRange}`);

      // Track this tenant for preloading
      this.activeTenants.add(tenantId);
    } catch (error) {
      this.logger.error(`Error setting cache for ${key}:`, error);
    }
  }

  /**
   * Clear cache for specific tenant and time range
   */
  async clear(tenantId: number, timeRange?: string): Promise<void> {
    if (timeRange) {
      const key = this.getCacheKey(tenantId, timeRange);
      await this.cacheManager.del(key);
      this.logger.log(`Cleared cache for ${key}`);
    } else {
      // Clear all time ranges for this tenant
      const timeRanges = ['7d', '14d', '1m', '3m', '6m', '1y'];
      for (const range of timeRanges) {
        const key = this.getCacheKey(tenantId, range);
        await this.cacheManager.del(key);
      }
      this.logger.log(`Cleared all cache for tenant ${tenantId}`);
    }
  }

  /**
   * Clear all cache
   */
  async clearAll(): Promise<void> {
    // Clear cache for all registered tenants
    const timeRanges = ['7d', '14d', '1m', '3m', '6m', '1y'];
    for (const tenantId of this.activeTenants) {
      for (const range of timeRanges) {
        await this.cacheManager.del(this.getCacheKey(tenantId, range));
      }
    }
    this.logger.log('Cleared all organizational pulse cache');
  }

  /**
   * Register tenant for preloading
   */
  registerTenant(tenantId: number): void {
    this.activeTenants.add(tenantId);
    this.logger.log(`Registered tenant ${tenantId} for preloading`);
  }

  /**
   * Get list of active tenants
   */
  getActiveTenants(): number[] {
    return Array.from(this.activeTenants);
  }

  /**
   * Preload organizational pulse data on application startup
   * This warms the cache so first user requests are fast
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('🔥 Warming organizational pulse cache on startup...');

    // Don't block application startup - run preload asynchronously
    setTimeout(async () => {
      try {
        await this.preloadOrganizationalPulse();
        this.logger.log('✅ Startup cache warming completed');
      } catch (error) {
        this.logger.error('❌ Startup cache warming failed:', error);
      }
    }, 5000); // Wait 5 seconds after startup to let the app initialize
  }

  /**
   * Background job to preload organizational pulse data
   * Runs every 4 hours to keep cache warm
   *
   * IMPORTANT: This now actually calls the calculation service to populate cache
   */
  @Cron(CronExpression.EVERY_4_HOURS)
  async preloadOrganizationalPulse(): Promise<void> {
    this.logger.log('🔄 Starting organizational pulse preload job');

    // Get distinct tenants from metric definitions
    const tenants = await this.metricDefinitionRepository
      .createQueryBuilder('md')
      .select('DISTINCT md.tenantId', 'tenantId')
      .where('md.isActive = :isActive', { isActive: true })
      .getRawMany();

    const tenantIds = tenants.map(t => t.tenantId);
    this.logger.log(`Found ${tenantIds.length} active tenants to preload`);

    // Preload for most common time ranges
    const timeRanges: Array<'1m' | '3m' | '6m'> = ['1m', '3m', '6m'];

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const tenantId of tenantIds) {
      // Register tenant for tracking
      this.registerTenant(tenantId);

      for (const timeRange of timeRanges) {
        try {
          // Check if data is already cached
          const cached = await this.get(tenantId, timeRange);
          if (cached) {
            this.logger.debug(`⏭️  Skipping tenant ${tenantId}, timeRange ${timeRange} (already cached)`);
            skipCount++;
            continue;
          }

          // ACTUAL PRELOADING: Calculate and cache the data
          this.logger.log(`🔥 Preloading tenant ${tenantId}, timeRange ${timeRange}...`);
          const data = await this.pulseService.calculateOrganizationalPulse(tenantId, timeRange);

          // Store in cache
          await this.set(tenantId, timeRange, data);
          successCount++;
          this.logger.log(`✅ Preloaded tenant ${tenantId}, timeRange ${timeRange}`);
        } catch (error) {
          errorCount++;
          this.logger.error(`❌ Failed to preload tenant ${tenantId}, timeRange ${timeRange}:`, error.message);
          // Continue with other tenants even if one fails
        }
      }
    }

    this.logger.log(`🎉 Organizational pulse preload job completed: ${successCount} preloaded, ${skipCount} skipped, ${errorCount} errors`);
  }

  /**
   * Manual preload trigger (can be called via API or on startup)
   */
  async triggerPreload(tenantIds?: number[]): Promise<void> {
    const tenantsToPreload = tenantIds || Array.from(this.activeTenants);

    if (tenantsToPreload.length === 0) {
      this.logger.warn('No tenants to preload');
      return;
    }

    this.logger.log(`Triggering preload for ${tenantsToPreload.length} tenants`);

    // Note: This service doesn't have access to DashboardController
    // Actual preloading will happen through normal request flow
    // This just ensures tenants are registered
    tenantsToPreload.forEach(tenantId => this.registerTenant(tenantId));
  }
}
