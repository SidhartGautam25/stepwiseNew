import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard, CurrentUser } from '@app/auth';
import type { AuthenticatedUser } from '@app/contracts';
import {
  CreatePaymentOrderSchema,
  VerifyPaymentSchema,
  type CreatePaymentOrderDto,
  type VerifyPaymentDto,
} from '@app/contracts';
import { PaymentService } from './payment.service.js';

@Controller('v1/payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Create Razorpay Order
   * Authenticated route
   */
  @Post('orders')
  @UseGuards(JwtAuthGuard)
  async createOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const parsed = CreatePaymentOrderSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.errors[0]?.message || 'Invalid order payload');
    }

    return this.paymentService.createOrder(user.id, user.email, parsed.data);
  }

  /**
   * Verify Client Checkout Signature
   * Authenticated route
   */
  @Post('verify')
  @UseGuards(JwtAuthGuard)
  async verifyPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const parsed = VerifyPaymentSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.errors[0]?.message || 'Invalid verification payload');
    }

    return this.paymentService.verifyPayment(user.id, parsed.data);
  }

  /**
   * Get User Payment Purchase History
   * Authenticated route
   */
  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getPaymentHistory(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentService.getUserPaymentHistory(user.id);
  }

  /**
   * Get Specific Order Details
   * Authenticated route
   */
  @Get('orders/:orderId')
  @UseGuards(JwtAuthGuard)
  async getOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
  ) {
    return this.paymentService.getOrder(user.id, orderId);
  }

  /**
   * Razorpay Webhook Endpoint
   * Public route with HMAC verification
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: Request,
    @Headers('x-razorpay-signature') signature: string,
    @Body() body: any,
  ) {
    // If raw body buffer is available, use it; otherwise stringify the body
    const rawBody = (req as any).rawBody
      ? (req as any).rawBody.toString('utf-8')
      : JSON.stringify(body);

    return this.paymentService.handleWebhook(rawBody, signature, body);
  }
}
