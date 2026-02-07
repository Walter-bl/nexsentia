import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WeakSignalsController } from './weak-signals.controller';
import { WeakSignalDetectionService } from '../services/weak-signal-detection.service';

describe('WeakSignalsController', () => {
  let controller: WeakSignalsController;
  let service: WeakSignalDetectionService;

  const mockWeakSignalService = {
    detectWeakSignals: jest.fn(),
    getWeakSignals: jest.fn(),
    getWeakSignalById: jest.fn(),
    updateWeakSignalStatus: jest.fn(),
    getStatistics: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WeakSignalsController],
      providers: [
        {
          provide: WeakSignalDetectionService,
          useValue: mockWeakSignalService,
        },
      ],
    }).compile();

    controller = module.get<WeakSignalsController>(WeakSignalsController);
    service = module.get<WeakSignalDetectionService>(WeakSignalDetectionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('detectWeakSignals', () => {
    it('should trigger weak signal detection', async () => {
      const mockSignals = [
        {
          id: 1,
          signalType: 'pattern_recurring',
          title: 'Test Signal',
          description: 'Test description',
          severity: 'high',
          confidenceScore: 85,
          status: 'new',
          detectedAt: new Date(),
          category: 'Engineering',
          affectedEntities: [],
          explainability: {},
          patternData: {},
          trendData: null,
          sourceSignals: [],
          metadata: {},
        },
      ];

      mockWeakSignalService.detectWeakSignals.mockResolvedValue(mockSignals);

      const result = await controller.detectWeakSignals(1, { daysBack: 90 });

      expect(result).toEqual(mockSignals);
      expect(mockWeakSignalService.detectWeakSignals).toHaveBeenCalledWith(1, 90);
    });
  });

  describe('getWeakSignals', () => {
    it('should get weak signals with filters', async () => {
      const mockSignals = [
        {
          id: 1,
          signalType: 'pattern_recurring',
          severity: 'high',
          status: 'new',
          confidenceScore: 85,
        },
      ];

      mockWeakSignalService.getWeakSignals.mockResolvedValue(mockSignals);

      const result = await controller.getWeakSignals(1, {
        signalType: 'pattern_recurring',
        severity: 'high',
      });

      expect(result.signals).toBeDefined();
      expect(result.total).toBe(1);
      expect(mockWeakSignalService.getWeakSignals).toHaveBeenCalled();
    });
  });

  describe('getWeakSignalById', () => {
    it('should get a single weak signal', async () => {
      const mockSignal = {
        id: 1,
        signalType: 'pattern_recurring',
        title: 'Test Signal',
        confidenceScore: 85,
      };

      mockWeakSignalService.getWeakSignalById.mockResolvedValue(mockSignal);

      const result = await controller.getWeakSignalById(1, 1);

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
    });

    it('should throw NotFoundException if signal not found', async () => {
      mockWeakSignalService.getWeakSignalById.mockResolvedValue(null);

      await expect(controller.getWeakSignalById(1, 999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('should update weak signal status', async () => {
      const mockSignal = {
        id: 1,
        status: 'validated',
        validatedBy: 123,
      };

      mockWeakSignalService.updateWeakSignalStatus.mockResolvedValue(mockSignal);

      const result = await controller.updateStatus(
        1,
        1,
        { status: 'validated', notes: 'Validated' },
        { id: 123 },
      );

      expect(result.status).toBe('validated');
      expect(mockWeakSignalService.updateWeakSignalStatus).toHaveBeenCalledWith(
        1,
        1,
        'validated',
        123,
        'Validated',
      );
    });
  });

  describe('getStatistics', () => {
    it('should get weak signal statistics', async () => {
      const mockStats = {
        total: 10,
        byType: {
          pattern_recurring: 5,
          trend_acceleration: 5,
          anomaly_detection: 0,
          correlation_cluster: 0,
        },
        bySeverity: {
          critical: 2,
          high: 3,
          medium: 3,
          low: 2,
        },
        byStatus: {
          new: 5,
          investigating: 3,
          validated: 2,
        },
        avgConfidence: 82.5,
        recentSignals: 3,
      };

      mockWeakSignalService.getStatistics.mockResolvedValue(mockStats);

      const result = await controller.getStatistics(1);

      expect(result).toEqual(mockStats);
      expect(result.total).toBe(10);
    });
  });
});
