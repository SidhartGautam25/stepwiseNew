import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Public } from '@app/auth';
import { PaymentService } from '../payment/payment.service.js';
import { InternalAuthGuard } from './internal-auth.guard.js';

@Controller('internal/payments')
@Public()
@UseGuards(InternalAuthGuard)
export class InternalPaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Service-to-service query: Check if user owns / paid for a workshop
   */
  @Get('users/:userId/workshops/:workshopSlug')
  async checkPurchaseStatus(
    @Param('userId') userId: string,
    @Param('workshopSlug') workshopSlug: string,
  ) {
    return this.paymentService.getWorkshopPurchaseStatus(userId, workshopSlug);
  }
}

