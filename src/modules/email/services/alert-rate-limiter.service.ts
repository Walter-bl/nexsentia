import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan } from 'typeorm';
import { AlertHistory } from '../entities/alert-history.entity';
import { AlertRule } from '../entities/alert-rule.entity';
import { AlertSubscription } from '../entities/alert-subscription.entity';

interface RateLimitCheck {
  allowed: boolean;
  reason?: string;
  suppressedUntil?: Date;
  nextAllowedTime?: Date;
}

@Injectable()
export class AlertRateLimiterService {
  private readonly logger = new Logger(AlertRateLimiterService.name);

  // Global rate limits
  private readonly MAX_ALERTS_PER_USER_PER_HOUR = 20;
  private readonly MAX_ALERTS_PER_USER_PER_DAY = 100;
  private readonly MAX_IDENTICAL_ALERTS_PER_HOUR = 3;

  constructor(
    @InjectRepository(AlertHistory)
    private readonly historyRepository: Repository<AlertHistory>,
    @InjectRepository(AlertRule)
    private readonly ruleRepository: Repository<AlertRule>,
    @InjectRepository(AlertSubscription)
    private readonly subscriptionRepository: Repository<AlertSubscription>,
  ) {}

  /**
   * Check if an alert should be sent based on rate limiting rules
   */
  async checkRateLimit(
    tenantId: number,
    ruleId: number,
    userId: number,
    sourceId?: string,
  ): Promise<RateLimitCheck> {
    // 1. Check rule-specific cooldown
    const ruleCooldownCheck = await this.checkRuleCooldown(tenantId, ruleId);
    if (!ruleCooldownCheck.allowed) {
      return ruleCooldownCheck;
    }

    // 2. Check user hourly limit
    const userHourlyCheck = await this.checkUserHourlyLimit(userId);
    if (!userHourlyCheck.allowed) {
      return userHourlyCheck;
    }

    // 3. Check user daily limit
    const userDailyCheck = await this.checkUserDailyLimit(userId);
    if (!userDailyCheck.allowed) {
      return userDailyCheck;
    }

    // 4. Check for identical alerts (deduplication)
    if (sourceId) {
      const deduplicationCheck = await this.checkDeduplication(tenantId, ruleId, sourceId);
      if (!deduplicationCheck.allowed) {
        return deduplicationCheck;
      }
    }

    // 5. Check quiet hours for user
    const quietHoursCheck = await this.checkQuietHours(userId);
    if (!quietHoursCheck.allowed) {
      return quietHoursCheck;
    }

    return { allowed: true };
  }

  /**
   * Check rule-specific cooldown period
   */
  private async checkRuleCooldown(
    tenantId: number,
    ruleId: number,
  ): Promise<RateLimitCheck> {
    const rule = await this.ruleRepository.findOne({
      where: { id: ruleId, tenantId },
    });

    if (!rule) {
      return { allowed: false, reason: 'Rule not found' };
    }

    const cooldownMinutes = rule.cooldownMinutes || 60;
    const cooldownStart = new Date(Date.now() - cooldownMinutes * 60 * 1000);

    const recentAlert = await this.historyRepository.findOne({
      where: {
        tenantId,
        ruleId,
        createdAt: MoreThan(cooldownStart),
        status: 'sent',
      },
      order: { createdAt: 'DESC' },
    });

    if (recentAlert) {
      const nextAllowedTime = new Date(
        recentAlert.createdAt.getTime() + cooldownMinutes * 60 * 1000,
      );

      return {
        allowed: false,
        reason: `Rule cooldown active (${cooldownMinutes} minutes)`,
        suppressedUntil: nextAllowedTime,
        nextAllowedTime,
      };
    }

    return { allowed: true };
  }

  /**
   * Check user hourly alert limit
   */
  private async checkUserHourlyLimit(userId: number): Promise<RateLimitCheck> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const count = await this.historyRepository.count({
      where: {
        userId,
        createdAt: MoreThan(oneHourAgo),
        status: 'sent',
      },
    });

    if (count >= this.MAX_ALERTS_PER_USER_PER_HOUR) {
      const oldestAlert = await this.historyRepository.findOne({
        where: {
          userId,
          createdAt: MoreThan(oneHourAgo),
          status: 'sent',
        },
        order: { createdAt: 'ASC' },
      });

      const nextAllowedTime = oldestAlert
        ? new Date(oldestAlert.createdAt.getTime() + 60 * 60 * 1000)
        : new Date(Date.now() + 60 * 60 * 1000);

      return {
        allowed: false,
        reason: `User hourly limit reached (${this.MAX_ALERTS_PER_USER_PER_HOUR} alerts/hour)`,
        suppressedUntil: nextAllowedTime,
        nextAllowedTime,
      };
    }

    return { allowed: true };
  }

  /**
   * Check user daily alert limit
   */
  private async checkUserDailyLimit(userId: number): Promise<RateLimitCheck> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const count = await this.historyRepository.count({
      where: {
        userId,
        createdAt: MoreThan(oneDayAgo),
        status: 'sent',
      },
    });

    if (count >= this.MAX_ALERTS_PER_USER_PER_DAY) {
      const oldestAlert = await this.historyRepository.findOne({
        where: {
          userId,
          createdAt: MoreThan(oneDayAgo),
          status: 'sent',
        },
        order: { createdAt: 'ASC' },
      });

      const nextAllowedTime = oldestAlert
        ? new Date(oldestAlert.createdAt.getTime() + 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 24 * 60 * 60 * 1000);

      return {
        allowed: false,
        reason: `User daily limit reached (${this.MAX_ALERTS_PER_USER_PER_DAY} alerts/day)`,
        suppressedUntil: nextAllowedTime,
        nextAllowedTime,
      };
    }

    return { allowed: true };
  }

  /**
   * Check for duplicate alerts (same source)
   */
  private async checkDeduplication(
    tenantId: number,
    ruleId: number,
    sourceId: string,
  ): Promise<RateLimitCheck> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const count = await this.historyRepository.count({
      where: {
        tenantId,
        ruleId,
        sourceId,
        createdAt: MoreThan(oneHourAgo),
        status: 'sent',
      },
    });

    if (count >= this.MAX_IDENTICAL_ALERTS_PER_HOUR) {
      return {
        allowed: false,
        reason: `Duplicate alert suppressed (${count} alerts in last hour for same source)`,
        suppressedUntil: new Date(Date.now() + 60 * 60 * 1000),
      };
    }

    return { allowed: true };
  }

  /**
   * Check user's quiet hours preferences
   */
  private async checkQuietHours(userId: number): Promise<RateLimitCheck> {
    const subscriptions = await this.subscriptionRepository.find({
      where: {
        userId,
        isActive: true,
      },
    });

    for (const subscription of subscriptions) {
      if (subscription.preferences?.quietHours?.enabled) {
        const { startHour, endHour, timezone } = subscription.preferences.quietHours;

        const now = new Date();
        const currentHour = now.getHours(); // TODO: Apply timezone conversion

        // Check if current time is within quiet hours
        const isInQuietHours =
          startHour < endHour
            ? currentHour >= startHour && currentHour < endHour
            : currentHour >= startHour || currentHour < endHour;

        if (isInQuietHours) {
          // Calculate when quiet hours end
          const endDate = new Date(now);
          endDate.setHours(endHour, 0, 0, 0);
          if (endDate < now) {
            endDate.setDate(endDate.getDate() + 1);
          }

          return {
            allowed: false,
            reason: `Quiet hours active (${startHour}:00 - ${endHour}:00)`,
            suppressedUntil: endDate,
            nextAllowedTime: endDate,
          };
        }
      }
    }

    return { allowed: true };
  }

  /**
   * Get rate limit statistics for a user
   */
  async getRateLimitStats(userId: number): Promise<{
    hourly: { count: number; limit: number; remaining: number };
    daily: { count: number; limit: number; remaining: number };
    nextResetTime: Date;
  }> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const hourlyCount = await this.historyRepository.count({
      where: {
        userId,
        createdAt: MoreThan(oneHourAgo),
        status: 'sent',
      },
    });

    const dailyCount = await this.historyRepository.count({
      where: {
        userId,
        createdAt: MoreThan(oneDayAgo),
        status: 'sent',
      },
    });

    const oldestHourlyAlert = await this.historyRepository.findOne({
      where: {
        userId,
        createdAt: MoreThan(oneHourAgo),
        status: 'sent',
      },
      order: { createdAt: 'ASC' },
    });

    const nextResetTime = oldestHourlyAlert
      ? new Date(oldestHourlyAlert.createdAt.getTime() + 60 * 60 * 1000)
      : new Date(Date.now() + 60 * 60 * 1000);

    return {
      hourly: {
        count: hourlyCount,
        limit: this.MAX_ALERTS_PER_USER_PER_HOUR,
        remaining: Math.max(0, this.MAX_ALERTS_PER_USER_PER_HOUR - hourlyCount),
      },
      daily: {
        count: dailyCount,
        limit: this.MAX_ALERTS_PER_USER_PER_DAY,
        remaining: Math.max(0, this.MAX_ALERTS_PER_USER_PER_DAY - dailyCount),
      },
      nextResetTime,
    };
  }

  /**
   * Cleanup old suppressed alerts
   */
  async cleanupSuppressedAlerts(): Promise<number> {
    const result = await this.historyRepository.delete({
      status: 'suppressed',
      createdAt: LessThan(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)), // 7 days old
    });

    return result.affected || 0;
  }
}
