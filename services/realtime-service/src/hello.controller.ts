import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '@app/auth';

@ApiTags('Hello')
@Controller('hello')
export class HelloController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Realtime service hello endpoint' })
  @ApiResponse({ status: 200, description: 'Hello greeting' })
  getHello() {
    return {
      message: 'Hello from realtime-service',
      service: 'realtime-service',
      timestamp: new Date().toISOString(),
    };
  }
}
