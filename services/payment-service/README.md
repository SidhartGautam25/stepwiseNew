# Handrail Payment Service (`payment-service`)

The **Payment Service** manages all financial transactions, checkout sessions, and webhook processing for paid workshops using **Razorpay**. It acts as the financial authority in the Handrail ecosystem.

---

## 1. Core Responsibilities

1. **Order Creation (`POST /v1/payments/orders`)**:
   - Checks if user has already purchased the workshop (prevents duplicate charging).
   - Looks up pricing from `payment_svc.workshop_pricing` or default fallback (₹499 / 49900 paise).
   - Creates a server-side order with Razorpay via authenticated API.
   - Saves order state in `payment_svc.payment_orders` with status `CREATED`.

2. **Payment Verification (`POST /v1/payments/verify`)**:
   - Verifies the cryptographic HMAC-SHA256 signature returned by Razorpay Checkout modal:
     $$\text{HMAC\_SHA256}(\text{order\_id} + "|" + \text{payment\_id}, \text{secret}) == \text{signature}$$
   - Updates order to `PAID` and records transaction in `payment_svc.payment_transactions`.
   - Publishes authoritative domain event `payment.succeeded` to RabbitMQ (`platform.events`).

3. **Authoritative Webhook Processing (`POST /v1/payments/webhook`)**:
   - Ingests asynchronous server-to-server webhook events from Razorpay (`order.paid`, `payment.captured`).
   - Validates `x-razorpay-signature` against `RAZORPAY_WEBHOOK_SECRET`.
   - Deduplicates events using `payment_svc.webhook_events`.
   - Fallback guarantor: ensures user is enrolled even if their browser closed before calling `/verify`.

4. **Internal Service Interface (`GET /internal/payments/users/:userId/workshops/:workshopSlug`)**:
   - Machine-to-machine endpoint guarded by `@ServiceOnly('payment:read')`.
   - Allows peer services to query purchase status directly.

---

## 2. Environment Variables

Add the following to your root `.env` file:

```env
# Port & Gateway URL
PORT_PAYMENT=4007
PAYMENT_SERVICE_URL=http://localhost:4007

# Database Connection (schema: payment_svc)
DATABASE_URL_PAYMENT=postgresql://handrail:handrail_password@localhost:5432/handrail_db?schema=payment_svc

# Razorpay API Credentials (from https://dashboard.razorpay.com/app/keys)
RAZORPAY_KEY_ID=rzp_test_placeholder
RAZORPAY_KEY_SECRET=rzp_secret_placeholder
RAZORPAY_WEBHOOK_SECRET=rzp_webhook_secret_placeholder

# Security
SUPABASE_JWT_SECRET=super-secret-jwt-token-with-minimum-32-chars-long!
SERVICE_SECRET=dev_internal_sync_token_secret

# Pricing
DEFAULT_WORKSHOP_PRICE_PAISE=49900 # ₹499 in paise
```

> [!NOTE]
> In local development / testing with placeholder keys (`rzp_test_placeholder`), the service automatically runs in **Mock Mode**, generating mock order IDs without needing active internet connection or live Razorpay credentials.

---

## 3. End-to-End Architecture Flow

```mermaid
sequenceDiagram
    autonumber
    actor Learner as Learner (Browser / Apps Web)
    participant Gateway as API Gateway (:4000)
    participant Payment as Payment Service (:4007)
    participant Razorpay as Razorpay Gateway
    participant RabbitMQ as RabbitMQ (Exchange: platform.events)
    participant Profile as Profile Service (:4004)
    participant Catalog as Catalog Service (:4001)

    %% Step 1: Order Creation
    Learner->>Gateway: POST /v1/payments/orders { workshopSlug } (Bearer JWT)
    Gateway->>Payment: Forward request with x-user-id
    Payment->>Razorpay: orders.create({ amount, currency, receipt, notes })
    Razorpay-->>Payment: { id: "order_xxx", amount, currency }
    Payment->>Payment: Save PaymentOrder (status: CREATED)
    Payment-->>Gateway: { orderId: "order_xxx", amount, currency, keyId }
    Gateway-->>Learner: Order details

    %% Step 2: Client Checkout
    Learner->>Razorpay: Open Razorpay modal & pay (UPI / Card / Netbanking)
    Razorpay-->>Learner: { razorpay_order_id, razorpay_payment_id, razorpay_signature }

    %% Step 3: Dual Verification Path
    par Client Verification (Instant UX)
        Learner->>Gateway: POST /v1/payments/verify { orderId, paymentId, signature }
        Gateway->>Payment: Forward request
        Payment->>Payment: Verify HMAC-SHA256 signature
        Payment->>Payment: Update status -> PAID, record PaymentTransaction
        Payment->>RabbitMQ: Publish "payment.succeeded"
        Payment-->>Learner: { success: true, workshopSlug }
    and Webhook Verification (Authoritative Fallback)
        Razorpay->>Gateway: POST /v1/payments/webhook (x-razorpay-signature)
        Gateway->>Payment: Forward webhook payload
        Payment->>Payment: Verify Webhook HMAC & Idempotent check
        opt If not already processed
            Payment->>RabbitMQ: Publish "payment.succeeded"
        end
        Payment-->>Razorpay: HTTP 200 OK
    end

    %% Step 4: Downstream Enrollment
    RabbitMQ->>Profile: Consumer receives "payment.succeeded"
    Profile->>Profile: Create Enrollment(userId, workshopSlug)
    Profile->>RabbitMQ: Publish "profile.enrollment.created"

    %% Step 5: Content Unlocking
    Learner->>Gateway: GET /v1/workshops/:slug/starter
    Gateway->>Catalog: Forward request
    Catalog->>Profile: Check Access (enrolled?)
    Profile-->>Catalog: { enrolled: true, unlockedChapters: [...] }
    Catalog-->>Learner: Presigned S3 Starter Download URL
```

---

## 4. API Endpoints Reference

### Public / Client Endpoints (Proxied by API Gateway)

#### 1. Create Payment Order
`POST /v1/payments/orders`
- **Auth**: User JWT (`Authorization: Bearer <token>`)
- **Body**:
  ```json
  {
    "workshopSlug": "build-your-own-http-server",
    "currency": "INR"
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "orderId": "order_xxx",
    "amount": 49900,
    "currency": "INR",
    "keyId": "rzp_test_xxxx",
    "workshopSlug": "build-your-own-http-server",
    "status": "CREATED",
    "receipt": "rcpt_1795260123"
  }
  ```

#### 2. Verify Payment
`POST /v1/payments/verify`
- **Auth**: User JWT
- **Body**:
  ```json
  {
    "razorpayOrderId": "order_xxx",
    "razorpayPaymentId": "pay_yyy",
    "razorpaySignature": "4f9d8..."
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "orderId": "order_xxx",
    "paymentId": "pay_yyy",
    "workshopSlug": "build-your-own-http-server",
    "status": "PAID",
    "message": "Payment verified successfully. Workshop enrolled!"
  }
  ```

#### 3. User Payment History
`GET /v1/payments/history`
- **Auth**: User JWT
- **Response**: `200 OK`
  ```json
  [
    {
      "id": "uuid",
      "orderId": "order_xxx",
      "workshopSlug": "build-your-own-http-server",
      "amount": 49900,
      "currency": "INR",
      "status": "PAID",
      "createdAt": "2026-11-21T11:00:00.000Z",
      "paymentId": "pay_yyy"
    }
  ]
  ```

#### 4. Razorpay Webhook
`POST /v1/payments/webhook`
- **Auth**: Public (HMAC Verified via `x-razorpay-signature` header)
- **Response**: `200 OK` `{"received": true}`

---

### Internal Service Endpoints (Machine-to-Machine)

#### Check User Workshop Purchase
`GET /internal/payments/users/:userId/workshops/:workshopSlug`
- **Auth**: `@ServiceOnly('payment:read')` (`x-service-token` or fallback service secret)
- **Response**: `200 OK`
  ```json
  {
    "purchased": true,
    "orderId": "order_xxx",
    "paidAt": "2026-11-21T11:05:00.000Z"
  }
  ```

---

## 5. Database Setup & Sync

To push the `payment_svc` schema to PostgreSQL:

```bash
# Push schema
pnpm db:push

# Generate client
pnpm --filter payment-service exec prisma generate
```

## 6. Running Tests

```bash
pnpm --filter payment-service test
```
