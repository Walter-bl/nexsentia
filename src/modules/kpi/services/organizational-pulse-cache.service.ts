import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
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

  private pulseService: OrganizationalPulseService;

  // Track if initial cache warming has completed
  private isWarmingComplete = false;
  private warmingPromise: Promise<void> | null = null;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @InjectRepository(MetricDefinition)
    private readonly metricDefinitionRepository: Repository<MetricDefinition>,
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
   * Set the pulse service (called by the module after initialization)
   * This avoids circular dependency issues
   */
  setPulseService(pulseService: OrganizationalPulseService): void {
    this.pulseService = pulseService;
  }

  /**
   * Preload all time ranges for a specific tenant in the background
   * Called when a user makes a request to ensure all time ranges are cached
   */
  async preloadAllTimeRangesForTenant(tenantId: number): Promise<void> {
    if (!this.pulseService) {
      this.logger.warn('[PreloadTenant] Pulse service not available, skipping');
      return;
    }

    const allTimeRanges: Array<'7d' | '14d' | '1m' | '3m' | '6m' | '1y'> = ['7d', '14d', '1m', '3m', '6m', '1y'];

    this.logger.log(`[PreloadTenant] 🔄 Starting background preload for tenant ${tenantId}...`);

    let successCount = 0;
    let skippedCount = 0;

    for (const timeRange of allTimeRanges) {
      try {
        // Check if already cached
        const cached = await this.get(tenantId, timeRange);
        if (cached) {
          skippedCount++;
          continue;
        }

        // Preload this time range
        this.logger.log(`[PreloadTenant] 🔥 Preloading tenant ${tenantId}, timeRange ${timeRange}...`);
        const startTime = Date.now();

        const data = await this.pulseService.calculateOrganizationalPulse(tenantId, timeRange);
        await this.set(tenantId, timeRange, data);

        const duration = Date.now() - startTime;
        successCount++;
        this.logger.log(`[PreloadTenant] ✅ Preloaded tenant ${tenantId}, timeRange ${timeRange} in ${duration}ms`);
      } catch (error) {
        this.logger.error(
          `[PreloadTenant] ❌ Failed to preload tenant ${tenantId}, timeRange ${timeRange}:`,
          error.message
        );
      }
    }

    this.logger.log(
      `[PreloadTenant] 🎉 Completed for tenant ${tenantId}: ${successCount} preloaded, ${skippedCount} already cached`
    );
  }

  /**
   * Preload organizational pulse data on application startup
   * This warms the cache so first user requests are fast
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('🔥 Scheduling organizational pulse cache warming...');

    // Start warming in background (non-blocking) but track the promise
    this.warmingPromise = this.attemptWarmup();
  }

  /**
   * Attempt to warm up the cache with retries
   */
  private async attemptWarmup(): Promise<void> {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Wait a short time for pulse service to be wired (circular dependency resolution)
      // First attempt: 1 second, subsequent attempts: 3 seconds
      const delay = attempt === 1 ? 1000 : 3000;
      await this.sleep(delay);

      try {
        if (!this.pulseService) {
          this.logger.warn(`⚠️  Pulse service not initialized yet (attempt ${attempt}/${maxAttempts})`);
          continue;
        }

        this.logger.log(`🔥 Starting cache warming (attempt ${attempt}/${maxAttempts})...`);
        const startTime = Date.now();

        // Preload ALL time ranges on startup
        await this.preloadAllTimeRanges();

        const duration = Date.now() - startTime;
        this.isWarmingComplete = true;
        this.logger.log(`✅ Cache warming completed in ${duration}ms - ALL time ranges cached`);

        return; // Success, exit retry loop

      } catch (error) {
        this.logger.error(
          `❌ Startup cache warming failed (attempt ${attempt}/${maxAttempts}):`,
          error.stack || error.message
        );

        if (attempt === maxAttempts) {
          this.logger.error('❌ All cache warming attempts exhausted. Cache will warm on first request.');
        }
      }
    }
  }

  /**
   * Preload ALL time ranges for all active tenants on startup
   * This ensures all data is cached immediately when the app starts
   */
  private async preloadAllTimeRanges(): Promise<void> {
    try {
      // Get distinct tenants from metric definitions
      const tenants = await this.metricDefinitionRepository
        .createQueryBuilder('md')
        .select('DISTINCT md.tenantId', 'tenantId')
        .where('md.isActive = :isActive', { isActive: true })
        .getRawMany();

      const tenantIds = tenants.map(t => t.tenantId);
      this.logger.log(`[StartupCache] Found ${tenantIds.length} active tenants to preload`);

      if (tenantIds.length === 0) {
        this.logger.warn('⚠️  No active tenants found to preload');
        return;
      }

      // Preload ALL time ranges on startup
      const allTimeRanges: Array<'7d' | '14d' | '1m' | '3m' | '6m' | '1y'> = ['7d', '14d', '1m', '3m', '6m', '1y'];

      let successCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      for (const tenantId of tenantIds) {
        this.registerTenant(tenantId);

        for (const timeRange of allTimeRanges) {
          try {
            // Check if already cached (useful with Redis where cache persists)
            const cached = await this.get(tenantId, timeRange);
            if (cached) {
              skippedCount++;
              this.logger.debug(`[StartupCache] ⏭️  Skipping tenant ${tenantId}, timeRange ${timeRange} (already cached)`);
              continue;
            }

            // Preload this time range
            this.logger.log(`[StartupCache] 🔥 Preloading tenant ${tenantId}, timeRange ${timeRange}...`);
            const startTime = Date.now();

            const data = await this.pulseService.calculateOrganizationalPulse(tenantId, timeRange);
            await this.set(tenantId, timeRange, data);

            const duration = Date.now() - startTime;
            successCount++;
            this.logger.log(`[StartupCache] ✅ Preloaded tenant ${tenantId}, timeRange ${timeRange} in ${duration}ms`);
          } catch (error) {
            errorCount++;
            this.logger.error(
              `[StartupCache] ❌ Failed to preload tenant ${tenantId}, timeRange ${timeRange}:`,
              error.message
            );
          }
        }
      }

      this.logger.log(
        `[StartupCache] 🎉 Completed: ${successCount} preloaded, ${skippedCount} already cached, ${errorCount} errors`
      );
    } catch (error) {
      this.logger.error('[StartupCache] ❌ Failed:', error.stack || error.message);
      throw error;
    }
  }

  /**
   * Helper to sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if cache warming is complete
   */
  isWarmed(): boolean {
    return this.isWarmingComplete;
  }

  /**
   * Wait for cache warming to complete (with timeout)
   */
  async waitForWarmup(timeoutMs: number = 10000): Promise<boolean> {
    if (this.isWarmingComplete) {
      return true;
    }

    if (!this.warmingPromise) {
      return false;
    }

    try {
      await Promise.race([
        this.warmingPromise,
        this.sleep(timeoutMs),
      ]);
      return this.isWarmingComplete;
    } catch (error) {
      this.logger.error('Error waiting for warmup:', error);
      return false;
    }
  }

  /**
   * Background job to preload organizational pulse data
   * Runs every 4 hours to keep cache warm
   *
   * IMPORTANT: This now actually calls the calculation service to populate cache
   * DISABLED: Cron disabled to reduce server load - cache is warmed on startup
   */
  // @Cron(CronExpression.EVERY_4_HOURS)
  async preloadOrganizationalPulse(): Promise<void> {
    if (!this.pulseService) {
      this.logger.error('❌ Pulse service not available, cannot preload');
      return;
    }

    this.logger.log('🔄 Starting organizational pulse preload job');

    try {
      // Get distinct tenants from metric definitions
      const tenants = await this.metricDefinitionRepository
        .createQueryBuilder('md')
        .select('DISTINCT md.tenantId', 'tenantId')
        .where('md.isActive = :isActive', { isActive: true })
        .getRawMany();

      const tenantIds = tenants.map(t => t.tenantId);
      this.logger.log(`Found ${tenantIds.length} active tenants to preload`);

      if (tenantIds.length === 0) {
        this.logger.warn('⚠️  No active tenants found to preload');
        return;
      }

      // Preload for most common time ranges
      const timeRanges: Array<'7d' | '14d' | '1m' | '3m' | '6m' | '1y'> = ['7d', '14d', '1m', '3m', '6m', '1y'];

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
            const startTime = Date.now();

            const data = await this.pulseService.calculateOrganizationalPulse(tenantId, timeRange);

            // Store in cache
            await this.set(tenantId, timeRange, data);

            const duration = Date.now() - startTime;
            successCount++;
            this.logger.log(`✅ Preloaded tenant ${tenantId}, timeRange ${timeRange} in ${duration}ms`);
          } catch (error) {
            errorCount++;
            this.logger.error(
              `❌ Failed to preload tenant ${tenantId}, timeRange ${timeRange}:`,
              error.stack || error.message
            );
            // Continue with other tenants even if one fails
          }
        }
      }

      this.logger.log(
        `🎉 Organizational pulse preload job completed: ${successCount} preloaded, ${skipCount} skipped, ${errorCount} errors`
      );
    } catch (error) {
      this.logger.error('❌ Preload job failed:', error.stack || error.message);
    }
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
