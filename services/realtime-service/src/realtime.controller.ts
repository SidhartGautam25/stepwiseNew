import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser, JwtAuthGuard } from '@app/auth';
import type { UserDto } from '@app/contracts';

@ApiTags('Realtime')
@Controller('v1/realtime')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RealtimeController {
  @Get('events')
  @ApiOperation({ summary: 'Server-Sent Events (SSE) stream for live updates' })
  streamEvents(
    @CurrentUser() user: UserDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    // Send initial connection event
    res.write(
      `event: connected\ndata: ${JSON.stringify({
        status: 'connected',
        userId: user.id,
        timestamp: new Date().toISOString(),
      })}\n\n`,
    );

    // Heartbeat every 15s to keep SSE pipe alive
    const interval = setInterval(() => {
      res.write(`event: ping\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
    }, 15000);

    req.on('close', () => {
      clearInterval(interval);
      res.end();
    });
  }
}
