import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { JwtPayload } from '../decorators/current-user.decorator';
import { currentCorrelationId } from '../correlation.context';

const SKIP_PATHS = new Set(['/health', '/ready', '/metrics']);

@Injectable()
export class HttpLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HttpLog');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    if (SKIP_PATHS.has(req.path) || req.path.includes('/webhook')) {
      return next.handle();
    }

    const start = Date.now();
    const method = req.method;
    const ip = (req.ip ?? req.socket?.remoteAddress ?? 'unknown').replace(/^::ffff:/, '');
    const route: string = (req.route as { path?: string } | undefined)?.path ?? req.path;

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse<Response>();
          this._log(method, route, res.statusCode, Date.now() - start, ip, req.user?.sub);
        },
        error: (err: unknown) => {
          const status = err instanceof Error && 'status' in err
            ? (err as { status: number }).status
            : 500;
          this._log(method, route, status, Date.now() - start, ip, req.user?.sub);
        },
      }),
    );
  }

  private _log(
    method: string,
    route: string,
    status: number,
    durationMs: number,
    ip: string,
    userId?: string,
  ): void {
    const correlationId = currentCorrelationId();
    const entry = { method, route, status, durationMs, ip, ...(userId ? { userId } : {}), ...(correlationId ? { correlationId } : {}) };

    if (status >= 500) {
      this.logger.error(`${method} ${route} ${status} ${durationMs}ms`, entry);
    } else if (status >= 400) {
      this.logger.warn(`${method} ${route} ${status} ${durationMs}ms`, entry);
    } else {
      this.logger.log(`${method} ${route} ${status} ${durationMs}ms`, entry);
    }
  }
}
