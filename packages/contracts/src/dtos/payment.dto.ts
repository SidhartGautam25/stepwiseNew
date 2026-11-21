import { z } from 'zod';

export const CreatePaymentOrderSchema = z.object({
  workshopSlug: z.string().min(1, 'Workshop slug is required'),
  currency: z.string().optional().default('INR'),
});

export type CreatePaymentOrderDto = z.input<typeof CreatePaymentOrderSchema>;
export type CreatePaymentOrderParsedDto = z.output<typeof CreatePaymentOrderSchema>;

export const VerifyPaymentSchema = z.object({
  razorpayOrderId: z.string().min(1, 'Razorpay order ID is required'),
  razorpayPaymentId: z.string().min(1, 'Razorpay payment ID is required'),
  razorpaySignature: z.string().min(1, 'Razorpay signature is required'),
});

export type VerifyPaymentDto = z.infer<typeof VerifyPaymentSchema>;

export const PaymentOrderStatusSchema = z.enum([
  'CREATED',
  'ATTEMPTED',
  'PAID',
  'FAILED',
  'CANCELLED',
  'REFUNDED',
]);

export type PaymentOrderStatus = z.infer<typeof PaymentOrderStatusSchema>;

export const PaymentOrderResponseSchema = z.object({
  orderId: z.string(),
  amount: z.number(),
  currency: z.string(),
  keyId: z.string(),
  workshopSlug: z.string(),
  status: PaymentOrderStatusSchema,
  receipt: z.string(),
  notes: z.record(z.unknown()).optional(),
  createdAt: z.string().optional(),
});

export type PaymentOrderResponseDto = z.infer<typeof PaymentOrderResponseSchema>;

export const PaymentVerifyResponseSchema = z.object({
  success: z.boolean(),
  orderId: z.string(),
  paymentId: z.string(),
  workshopSlug: z.string(),
  status: PaymentOrderStatusSchema,
  message: z.string().optional(),
});

export type PaymentVerifyResponseDto = z.infer<typeof PaymentVerifyResponseSchema>;

export const PaymentTransactionSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  paymentId: z.string(),
  amount: z.number(),
  currency: z.string(),
  status: z.string(),
  method: z.string().nullable().optional(),
  createdAt: z.string(),
});

export type PaymentTransactionDto = z.infer<typeof PaymentTransactionSchema>;

export const PaymentHistoryItemSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  workshopSlug: z.string(),
  amount: z.number(),
  currency: z.string(),
  status: PaymentOrderStatusSchema,
  createdAt: z.string(),
  paymentId: z.string().nullable().optional(),
});

export type PaymentHistoryItemDto = z.infer<typeof PaymentHistoryItemSchema>;
