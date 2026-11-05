import { NextResponse } from 'next/server';
import * as jose from 'jose';

export async function GET() {
  const secret = process.env.SUPABASE_JWT_SECRET || 'super-secret-jwt-token-with-minimum-32-chars-long!';
  const rawSecret = new TextEncoder().encode(secret);

  const mockUserId = '11111111-2222-3333-4444-555555555555';
  const mockEmail = 'dev-learner@handrail.dev';

  const token = await new jose.SignJWT({
    sub: mockUserId,
    email: mockEmail,
    role: 'authenticated',
    app_metadata: { provider: 'email' },
    user_metadata: { full_name: 'Dev Learner' },
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(rawSecret);

  return NextResponse.json({
    token,
    user: {
      id: mockUserId,
      email: mockEmail,
      role: 'authenticated',
    },
  });
}

