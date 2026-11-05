import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard } from '@app/auth';
import type { UserDto } from '@app/contracts';

@ApiTags('User')
@Controller('v1/me')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MeController {
  @Get()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Authenticated user profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getProfile(@CurrentUser() user: UserDto): UserDto {
    return user;
  }
}
