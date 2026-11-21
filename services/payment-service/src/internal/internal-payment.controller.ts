import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ServiceAuthGuard, ServiceOnly } from '@app/auth';
import { PaymentService } from '../payment/payment.service.js';

@Controller('internal/payments')
@UseGuards(ServiceAuthGuard)
export class InternalPaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Service-to-service query: Check if user owns / paid for a workshop
   */
  @Get('users/:userId/workshops/:workshopSlug')
  @ServiceOnly('payment:read')
  async checkPurchaseStatus(
    @Param('userId') userId: string,
    @Param('workshopSlug') workshopSlug: string,
  ) {
    return this.paymentService.getWorkshopPurchaseStatus(userId, workshopSlug);
  }
}
