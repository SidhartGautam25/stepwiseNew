import type { NextRequest } from 'next/server';
import { handleAuthMiddleware } from '@/utils/auth/middleware';

export function middleware(request: NextRequest) {
  return handleAuthMiddleware(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images, public assets (.svg, .png, .jpg, .ico)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
