import { SetMetadata } from '@nestjs/common';

export const SERVICE_SCOPE_KEY = 'serviceScope';
export const ServiceOnly = (scope: string) => SetMetadata(SERVICE_SCOPE_KEY, scope);
