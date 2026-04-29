/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Observable, tap } from 'rxjs';
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.logger.log(
          `${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`,
        );
      }),
    );
  }
}
