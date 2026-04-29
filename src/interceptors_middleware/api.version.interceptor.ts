import { Observable } from 'rxjs';
import {
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class ApiVersionInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    if (req.path.startsWith('/api/') && req.headers['x-api-version'] !== '1') {
      throw new BadRequestException({
        status: 'error',
        message: 'API version header required',
      });
    }
    return next.handle();
  }
}
