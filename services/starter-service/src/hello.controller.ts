import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '@app/auth';

@ApiTags('Hello')
@Controller('hello')
export class HelloController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Starter service hello endpoint' })
  @ApiResponse({ status: 200, description: 'Hello greeting' })
  getHello() {
    return {
      message: 'Hello from starter-service',
      service: 'starter-service',
      timestamp: new Date().toISOString(),
    };
  }
}
