import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WeakSignalDetectionService } from './weak-signal-detection.service';
import { PatternExtractionService } from './pattern-extraction.service';
import { TrendAccelerationService } from './trend-acceleration.service';
import { WeakSignal } from '../entities/weak-signal.entity';

describe('WeakSignalDetectionService', () => {
  let service: WeakSignalDetectionService;
  let patternService: PatternExtractionService;
  let trendService: TrendAccelerationService;
  let weakSignalRepository: any;

  const mockWeakSignalRepository = {
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    })),
  };

  const mockPatternService = {
    extractRecurringPatterns: jest.fn(),
  };

  const mockTrendService = {
    detectTrendAccelerations: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeakSignalDetectionService,
        {
          provide: getRepositoryToken(WeakSignal),
          useValue: mockWeakSignalRepository,
        },
        {
          provide: PatternExtractionService,
          useValue: mockPatternService,
        },
        {
          provide: TrendAccelerationService,
          useValue: mockTrendService,
        },
      ],
    }).compile();

    service = module.get<WeakSignalDetectionService>(WeakSignalDetectionService);
    patternService = module.get<PatternExtractionService>(PatternExtractionService);
    trendService = module.get<TrendAccelerationService>(TrendAccelerationService);
    weakSignalRepository = module.get(getRepositoryToken(WeakSignal));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('detectWeakSignals', () => {
    it('should detect weak signals from patterns and trends', async () => {
      const mockPatterns = [
        {
          patternId: 'test-pattern-1',
          type: 'issue_recurrence' as const,
          description: 'Test pattern',
          occurrences: 5,
          frequency: 'weekly' as const,
          lastOccurrence: new Date(),
          predictedNext: new Date(),
          similarities: ['test1', 'test2'],
          confidenceScore: 85,
          evidence: [
            {
              source: 'jira',
              sourceId: '1',
              timestamp: new Date(),
              relevanceScore: 90,
            },
          ],
        },
      ];

      const mockAccelerations = [
        {
          accelerationId: 'test-accel-1',
          metric: 'Test Metric',
          metricKey: 'test_metric',
          description: 'Test acceleration',
          baseline: 10,
          current: 20,
          changeRate: 100,
          accelerationFactor: 2,
          timeWindow: '30 days',
          severity: 'high' as const,
          confidenceScore: 80,
          predictedEscalationTime: new Date(),
          evidence: [
            {
              timestamp: new Date(),
              value: 15,
              source: 'kpi',
            },
          ],
          riskIndicators: ['Test risk'],
        },
      ];

      mockPatternService.extractRecurringPatterns.mockResolvedValue(mockPatterns);
      mockTrendService.detectTrendAccelerations.mockResolvedValue(mockAccelerations);
      mockWeakSignalRepository.save.mockImplementation((signals) => Promise.resolve(signals));

      const result = await service.detectWeakSignals(1, 90);

      expect(result).toBeDefined();
      expect(result.length).toBe(2); // 1 pattern + 1 acceleration
      expect(mockPatternService.extractRecurringPatterns).toHaveBeenCalledWith(1, 90);
      expect(mockTrendService.detectTrendAccelerations).toHaveBeenCalledWith(1, 30);
      expect(mockWeakSignalRepository.save).toHaveBeenCalled();
    });

    it('should handle empty patterns and accelerations', async () => {
      mockPatternService.extractRecurringPatterns.mockResolvedValue([]);
      mockTrendService.detectTrendAccelerations.mockResolvedValue([]);
      mockWeakSignalRepository.save.mockResolvedValue([]);

      const result = await service.detectWeakSignals(1, 90);

      expect(result).toEqual([]);
    });
  });

  describe('getWeakSignals', () => {
    it('should retrieve weak signals with filters', async () => {
      const mockSignals = [
        {
          id: 1,
          tenantId: 1,
          signalType: 'pattern_recurring',
          severity: 'high',
          status: 'new',
          confidenceScore: 85,
        },
      ];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockSignals),
      };

      mockWeakSignalRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getWeakSignals(1, {
        signalType: 'pattern_recurring',
        severity: 'high',
        minConfidence: 80,
      });

      expect(result).toEqual(mockSignals);
      expect(mockQueryBuilder.where).toHaveBeenCalled();
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(3);
    });
  });

  describe('updateWeakSignalStatus', () => {
    it('should update signal status to validated', async () => {
      const mockSignal = {
        id: 1,
        tenantId: 1,
        status: 'new',
      };

      mockWeakSignalRepository.findOne.mockResolvedValue(mockSignal);
      mockWeakSignalRepository.save.mockImplementation((signal) => Promise.resolve(signal));

      const result = await service.updateWeakSignalStatus(1, 1, 'validated', 123, 'Test notes');

      expect(result.status).toBe('validated');
      expect(result.validatedBy).toBe(123);
      expect(result.investigationNotes).toBe('Test notes');
      expect(result.validatedAt).toBeDefined();
    });

    it('should throw error if signal not found', async () => {
      mockWeakSignalRepository.findOne.mockResolvedValue(null);

      await expect(service.updateWeakSignalStatus(1, 999, 'validated')).rejects.toThrow('Weak signal not found');
    });
  });

  describe('getStatistics', () => {
    it('should calculate statistics correctly', async () => {
      const mockSignals = [
        {
          id: 1,
          signalType: 'pattern_recurring',
          severity: 'high',
          status: 'new',
          confidenceScore: 85,
          detectedAt: new Date(),
        },
        {
          id: 2,
          signalType: 'trend_acceleration',
          severity: 'critical',
          status: 'validated',
          confidenceScore: 90,
          detectedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        },
      ];

      mockWeakSignalRepository.find.mockResolvedValue(mockSignals);

      const result = await service.getStatistics(1);

      expect(result.total).toBe(2);
      expect(result.byType.pattern_recurring).toBe(1);
      expect(result.byType.trend_acceleration).toBe(1);
      expect(result.bySeverity.high).toBe(1);
      expect(result.bySeverity.critical).toBe(1);
      expect(result.byStatus.new).toBe(1);
      expect(result.byStatus.validated).toBe(1);
      expect(result.avgConfidence).toBe(87.5);
      expect(result.recentSignals).toBe(1);
    });
  });
});
