import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UserDto } from '@app/contracts';

export const CurrentUser = createParamDecorator(
  (data: keyof UserDto | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as UserDto | undefined;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);

