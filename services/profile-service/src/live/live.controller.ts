import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from '@app/auth';
import type { AuthenticatedUser } from '@app/contracts';

@Controller('v1/live')
export class LiveController {
  @Get('status')
  streamLiveStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    // Emit initial connection event
    res.write(
      `event: connected\ndata: ${JSON.stringify({
        status: 'connected',
        userId: user.id,
        email: user.email,
        roles: user.roles,
        timestamp: new Date().toISOString(),
      })}\n\n`,
    );

    // Heartbeat every 15s to keep connection open through proxies
    const heartbeat = setInterval(() => {
      res.write(`event: ping\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      res.end();
    });
  }
}
