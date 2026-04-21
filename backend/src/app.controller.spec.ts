import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';

describe('HealthController', () => {
  let healthController: HealthController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService],
    }).compile();

    healthController = app.get<HealthController>(HealthController);
  });

  describe('health', () => {
    it('should return a healthy status', () => {
      expect(healthController.getHealth().status).toBe('ok');
    });
  });
});
