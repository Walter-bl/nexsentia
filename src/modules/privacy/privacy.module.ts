import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

// Entities
import { PiiDetectionLog } from './entities/pii-detection-log.entity';
import { AnonymizationMapping } from './entities/anonymization-mapping.entity';
import { GraphNode } from './entities/graph-node.entity';
import { GraphEdge } from './entities/graph-edge.entity';

// Services
import { PiiDetectionService } from './services/pii-detection.service';
import { PiiAnonymizationService } from './services/pii-anonymization.service';
import { PiiValidationService } from './services/pii-validation.service';
import { GraphBuilderService } from './services/graph-builder.service';
import { GraphQueryService } from './services/graph-query.service';

// Controllers
import { PiiController } from './controllers/pii.controller';
import { GraphController } from './controllers/graph.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PiiDetectionLog,
      AnonymizationMapping,
      GraphNode,
      GraphEdge,
    ]),
    ConfigModule,
  ],
  controllers: [PiiController, GraphController],
  providers: [
    PiiDetectionService,
    PiiAnonymizationService,
    PiiValidationService,
    GraphBuilderService,
    GraphQueryService,
  ],
  exports: [
    PiiDetectionService,
    PiiAnonymizationService,
    PiiValidationService,
    GraphBuilderService,
    GraphQueryService,
  ],
})
export class PrivacyModule {}
