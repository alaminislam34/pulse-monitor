import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Monitor } from '../core/Monitor';

function discoverExpressRoutes(app: any): Array<{ path: string; method: string }> {
  const routes: Array<{ path: string; method: string }> = [];

  function traverse(stack: any[], prefix = '') {
    if (!Array.isArray(stack)) return;
    stack.forEach((layer: any) => {
      if (!layer) return;
      if (layer.route) {
        const path = (prefix + layer.route.path).replace(/\/+/g, '/');
        const methods = Object.keys(layer.route.methods || {}).map(m => m.toUpperCase());
        methods.forEach(method => routes.push({ path, method }));
      } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
        let routerPath = '';
        if (layer.regexp) {
          routerPath = layer.regexp.source
            .replace('^\\', '')
            .replace('\\/?(?=\\/|$)', '')
            .replace('\\/?$', '')
            .replace(/\\\//g, '/');
          routerPath = routerPath.replace(/\?\:\(\[\^\\\/\]\+\?\)/g, ':id');
        }
        traverse(layer.handle.stack, prefix + '/' + routerPath);
      }
    });
  }

  if (app._router && app._router.stack) {
    traverse(app._router.stack);
  }
  return routes;
}

@Injectable()
export class NestJSPulseInterceptor implements NestInterceptor {
  constructor(private readonly monitor: Monitor) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const req = httpContext.getRequest();
    const res = httpContext.getResponse();
    
    // Some serverless/microservices configurations may not use HTTP context
    if (!req || !res) {
      return next.handle();
    }

    // Scan routes once on first request
    if (!(this.monitor as any).hasScannedRoutes && req.app) {
      (this.monitor as any).hasScannedRoutes = true;
      try {
        const routes = discoverExpressRoutes(req.app);
        this.monitor.registerDiscoveredRoutes(routes);
      } catch (err) {
        console.error('⚠️ [PulseMonitor] Failed to auto-discover NestJS routes:', err);
      }
    }

    const start = process.hrtime();
    
    const logBodies = (this.monitor as any).config.logBodies;
    let resBody: string | undefined;

    if (logBodies) {
      const chunks: Buffer[] = [];
      const oldWrite = res.write;
      const oldEnd = res.end;

      res.write = function (chunk: any, encoding?: any, cb?: any) {
        if (chunk) {
          if (Buffer.isBuffer(chunk)) {
            chunks.push(chunk);
          } else {
            chunks.push(Buffer.from(chunk, (typeof encoding === 'string' ? encoding : 'utf8') as BufferEncoding));
          }
        }
        return oldWrite.apply(res, arguments as any);
      };

      res.end = function (chunk: any, encoding?: any, cb?: any) {
        if (chunk) {
          if (Buffer.isBuffer(chunk)) {
            chunks.push(chunk);
          } else {
            chunks.push(Buffer.from(chunk, (typeof encoding === 'string' ? encoding : 'utf8') as BufferEncoding));
          }
        }
        try {
          const bodyBuffer = Buffer.concat(chunks);
          const maxLimit = ((this.monitor as any).config.maxBodySizeKb ?? 64) * 1024;
          resBody = bodyBuffer.subarray(0, maxLimit).toString('utf8');
        } catch (e) {}

        return oldEnd.apply(res, arguments as any);
      };
    }

    // Capture request details for threat detection
    const reqDetails = {
      headers: req.headers || {},
      query: req.query || {},
      body: req.body,
    };

    const recordMetrics = (statusCode: number) => {
      const diff = process.hrtime(start);
      const durationMs = diff[0] * 1e3 + diff[1] * 1e-6;
      const ip = (req.ip || req.socket?.remoteAddress || '').replace('::ffff:', '');

      this.monitor.recordRequest(
        {
          path: req.url || req.path || '',
          method: req.method || 'GET',
          statusCode,
          durationMs,
          ip,
          userAgent: req.headers ? req.headers['user-agent'] : undefined,
        },
        {
          ...reqDetails,
          resBody
        }
      );
    };

    return next.handle().pipe(
      tap({
        next: () => {
          // On success, capture the actual response status code
          const statusCode = res.statusCode || 200;
          recordMetrics(statusCode);
        },
        error: (err: any) => {
          // On exception, estimate status code from exception property
          const statusCode = err.status || err.statusCode || 500;
          recordMetrics(statusCode);
        },
      })
    );
  }
}
