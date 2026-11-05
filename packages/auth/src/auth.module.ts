import { Global, Module } from '@nestjs/common';
import { JwtVerifierService } from './jwt-verifier.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

@Global()
@Module({
  providers: [JwtVerifierService, JwtAuthGuard],
  exports: [JwtVerifierService, JwtAuthGuard],
})
export class AuthModule {}
