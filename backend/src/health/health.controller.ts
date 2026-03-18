import { Controller, Get } from '@nestjs/common';
import { apiResponse } from '../common/http/api-response';

@Controller()
export class HealthController {
  @Get('health')
  getHealth() {
    return apiResponse({
      service: 'vervet-network-backend',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    });
  }
}
