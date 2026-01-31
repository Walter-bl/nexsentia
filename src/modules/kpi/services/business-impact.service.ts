import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { BusinessImpact } from '../entities/business-impact.entity';
import { ServiceNowIncident } from '../../servicenow/entities/servicenow-incident.entity';
import { JiraIssue } from '../../jira/entities/jira-issue.entity';

@Injectable()
export class BusinessImpactService {
  private readonly logger = new Logger(BusinessImpactService.name);

  constructor(
    @InjectRepository(BusinessImpact)
    private readonly impactRepository: Repository<BusinessImpact>,
    @InjectRepository(ServiceNowIncident)
    private readonly incidentRepository: Repository<ServiceNowIncident>,
    @InjectRepository(JiraIssue)
    private readonly jiraIssueRepository: Repository<JiraIssue>,
  ) {}

  /**
   * Map revenue impact for an incident
   */
  async mapRevenueImpact(
    tenantId: number,
    sourceType: string,
    sourceId: string,
    config: {
      affectedServices?: string[];
      revenuePerHour?: number;
      customersAffected?: number;
      durationMinutes?: number;
      recurringImpact?: boolean;
    },
  ): Promise<BusinessImpact> {
    const { affectedServices, revenuePerHour, customersAffected, durationMinutes, recurringImpact } = config;

    // Calculate estimated revenue loss
    let estimatedRevenueLoss = 0;
    let recurringRevenueImpact = 0;
    let oneTimeRevenueLoss = 0;

    if (revenuePerHour && durationMinutes) {
      const durationHours = durationMinutes / 60;
      oneTimeRevenueLoss = revenuePerHour * durationHours;
      estimatedRevenueLoss = oneTimeRevenueLoss;
    }

    // Add recurring revenue impact if applicable
    if (recurringImpact && customersAffected) {
      // Assume average customer value per month is $100 (configurable)
      const avgCustomerValue = 100;
      // Assume 10% churn rate for affected customers
      const churnRate = 0.1;
      recurringRevenueImpact = customersAffected * avgCustomerValue * churnRate;
      estimatedRevenueLoss += recurringRevenueImpact;
    }

    // Determine severity based on revenue impact
    let severity = 'low';
    if (estimatedRevenueLoss > 100000) {
      severity = 'critical';
    } else if (estimatedRevenueLoss > 50000) {
      severity = 'high';
    } else if (estimatedRevenueLoss > 10000) {
      severity = 'medium';
    }

    // Get source data
    const { impactDate, resolvedDate, metadata } = await this.getSourceData(
      tenantId,
      sourceType,
      sourceId,
    );

    // Create business impact record
    const impact = this.impactRepository.create({
      tenantId,
      sourceType,
      sourceId,
      impactType: sourceType === 'servicenow' ? 'incident' : 'bug',
      estimatedRevenueLoss,
      customersAffected,
      durationMinutes,
      impactDate,
      resolvedDate,
      severity,
      revenueMapping: {
        affectedServices,
        revenuePerHour,
        recurringRevenueImpact,
        oneTimeRevenueLoss,
        methodology: 'duration_based_calculation',
      },
      metadata,
    });

    return await this.impactRepository.save(impact);
  }

  /**
   * Estimate loss for an impact
   */
  async estimateLoss(
    tenantId: number,
    impactId: number,
    config?: {
      includeOpportunityCost?: boolean;
      includeReputationImpact?: boolean;
    },
  ): Promise<BusinessImpact> {
    const impact = await this.impactRepository.findOne({
      where: { tenantId, id: impactId },
    });

    if (!impact) {
      throw new Error(`Impact ${impactId} not found`);
    }

    const { includeOpportunityCost = true, includeReputationImpact = true } = config || {};

    // Calculate direct costs (time spent resolving)
    const directCosts = this.calculateDirectCosts(impact);

    // Calculate indirect costs (customer support, communication, etc.)
    const indirectCosts = this.calculateIndirectCosts(impact);

    // Calculate opportunity cost
    const opportunityCost = includeOpportunityCost
      ? this.calculateOpportunityCost(impact)
      : 0;

    // Estimate reputation impact
    const reputationImpact = includeReputationImpact
      ? this.estimateReputationImpact(impact)
      : 0;

    const totalLoss = directCosts + indirectCosts + opportunityCost + reputationImpact;

    // Calculate confidence based on data available
    const confidence = this.calculateEstimationConfidence(impact);

    // Update impact with loss estimation
    impact.lossEstimation = {
      directCosts,
      indirectCosts,
      opportunityCost,
      reputationImpact,
      calculationMethod: 'comprehensive_estimation',
      confidence,
    };

    impact.estimatedRevenueLoss = totalLoss;

    return await this.impactRepository.save(impact);
  }

  /**
   * Calculate direct costs (engineering time, resources)
   */
  private calculateDirectCosts(impact: BusinessImpact): number {
    // Assume average engineer hourly cost is $100
    const engineerHourlyCost = 100;

    if (!impact.durationMinutes) return 0;

    const hours = impact.durationMinutes / 60;

    // Assume severity multiplier for team size involved
    const severityMultiplier = {
      low: 1,
      medium: 2,
      high: 4,
      critical: 8,
    }[impact.severity] || 1;

    return hours * engineerHourlyCost * severityMultiplier;
  }

  /**
   * Calculate indirect costs (support, communication, etc.)
   */
  private calculateIndirectCosts(impact: BusinessImpact): number {
    if (!impact.customersAffected) return 0;

    // Assume $50 per customer in support costs
    const supportCostPerCustomer = 50;

    // Scale based on severity
    const severityMultiplier = {
      low: 0.5,
      medium: 1.0,
      high: 1.5,
      critical: 2.0,
    }[impact.severity] || 1;

    return impact.customersAffected * supportCostPerCustomer * severityMultiplier;
  }

  /**
   * Calculate opportunity cost (missed sales, delayed features)
   */
  private calculateOpportunityCost(impact: BusinessImpact): number {
    if (!impact.durationMinutes) return 0;

    const hours = impact.durationMinutes / 60;

    // Critical incidents typically block entire teams
    if (impact.severity === 'critical') {
      // Assume team of 5, $150/hr value, 50% productivity loss
      return hours * 5 * 150 * 0.5;
    }

    // High priority issues affect some team members
    if (impact.severity === 'high') {
      return hours * 2 * 150 * 0.3;
    }

    return 0;
  }

  /**
   * Estimate reputation/brand impact
   */
  private estimateReputationImpact(impact: BusinessImpact): number {
    if (!impact.customersAffected) return 0;

    // Only consider reputation impact for significant customer-facing issues
    if (impact.customersAffected < 100) return 0;

    // Estimate based on customer lifetime value
    const avgCustomerLTV = 1000; // $1000 lifetime value
    const churnRisk = {
      low: 0.01,
      medium: 0.02,
      high: 0.05,
      critical: 0.10,
    }[impact.severity] || 0.01;

    return impact.customersAffected * avgCustomerLTV * churnRisk;
  }

  /**
   * Calculate confidence in estimation
   */
  private calculateEstimationConfidence(impact: BusinessImpact): number {
    let confidence = 1.0;

    // Reduce confidence if missing key data
    if (!impact.durationMinutes) confidence -= 0.2;
    if (!impact.customersAffected) confidence -= 0.2;
    if (!impact.resolvedDate) confidence -= 0.1;
    if (!impact.revenueMapping) confidence -= 0.2;

    return Math.max(0, confidence);
  }

  /**
   * Get source data from original system
   */
  private async getSourceData(
    tenantId: number,
    sourceType: string,
    sourceId: string,
  ): Promise<{
    impactDate: Date;
    resolvedDate?: Date;
    metadata: any;
  }> {
    if (sourceType === 'servicenow') {
      const incident = await this.incidentRepository.findOne({
        where: { tenantId, sysId: sourceId },
      });

      if (incident) {
        return {
          impactDate: incident.sysCreatedOn || new Date(),
          resolvedDate: incident.state === 'Resolved' ? incident.sysUpdatedOn : undefined,
          metadata: {
            priority: incident.priority,
            category: incident.category,
            assignee: incident.assignedTo,
          },
        };
      }
    } else if (sourceType === 'jira') {
      const issue = await this.jiraIssueRepository.findOne({
        where: { tenantId, jiraIssueId: sourceId },
      });

      if (issue) {
        return {
          impactDate: issue.createdAt,
          resolvedDate: issue.resolvedAt,
          metadata: {
            priority: issue.priority,
            issueType: issue.issueType,
            assignee: issue.assigneeAccountId,
          },
        };
      }
    }

    // Default fallback
    return {
      impactDate: new Date(),
      metadata: {},
    };
  }

  /**
   * Validate business impact
   */
  async validateImpact(
    tenantId: number,
    impactId: number,
    userId: number,
    isValid: boolean,
    notes?: string,
    actualRevenueLoss?: number,
  ): Promise<BusinessImpact> {
    const impact = await this.impactRepository.findOne({
      where: { tenantId, id: impactId },
    });

    if (!impact) {
      throw new Error(`Impact ${impactId} not found`);
    }

    impact.isValidated = true;
    impact.validatedAt = new Date();
    impact.validatedBy = userId;
    impact.validationNotes = notes;

    if (actualRevenueLoss !== undefined) {
      impact.actualRevenueLoss = actualRevenueLoss;
    }

    return await this.impactRepository.save(impact);
  }

  /**
   * Get business impacts for a period
   */
  async getImpacts(
    tenantId: number,
    periodStart: Date,
    periodEnd: Date,
    filters?: {
      severity?: string;
      sourceType?: string;
      validated?: boolean;
    },
  ): Promise<BusinessImpact[]> {
    const where: any = {
      tenantId,
      impactDate: Between(periodStart, periodEnd),
    };

    if (filters?.severity) {
      where.severity = filters.severity;
    }

    if (filters?.sourceType) {
      where.sourceType = filters.sourceType;
    }

    if (filters?.validated !== undefined) {
      where.isValidated = filters.validated;
    }

    return await this.impactRepository.find({
      where,
      order: { estimatedRevenueLoss: 'DESC' },
    });
  }

  /**
   * Get total revenue loss for a period
   */
  async getTotalRevenueLoss(
    tenantId: number,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<{
    total: number;
    estimated: number;
    actual: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  }> {
    const impacts = await this.getImpacts(tenantId, periodStart, periodEnd);

    const estimated = impacts.reduce((sum, impact) => sum + (impact.estimatedRevenueLoss || 0), 0);
    const actual = impacts.reduce((sum, impact) => sum + (impact.actualRevenueLoss || 0), 0);

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const impact of impacts) {
      byType[impact.impactType] = (byType[impact.impactType] || 0) + (impact.estimatedRevenueLoss || 0);
      bySeverity[impact.severity] = (bySeverity[impact.severity] || 0) + (impact.estimatedRevenueLoss || 0);
    }

    return { total: estimated, estimated, actual, byType, bySeverity };
  }
}
