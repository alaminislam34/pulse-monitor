import { Request, Response, NextFunction } from 'express';
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

  const router = app._router || app.router;
  if (router && router.stack) {
    traverse(router.stack);
  }
  return routes;
}

export function expressPulseMiddleware(monitor: Monitor): any {
  return (req: any, res: any, next: any) => {
    // Scan routes once on first request
    if (!(monitor as any).hasScannedRoutes && req.app) {
      (monitor as any).hasScannedRoutes = true;
      try {
        const routes = discoverExpressRoutes(req.app);
        monitor.registerDiscoveredRoutes(routes);
      } catch (err) {
        console.error('⚠️ [PulseMonitor] Failed to auto-discover Express routes:', err);
      }
    }

    const start = process.hrtime();
    const endpoint = (monitor as any).config.dashboardEndpoint; // Access config safely

    // Determine IP address
    const ip = (req.ip || req.socket?.remoteAddress || '').replace('::ffff:', '');

    // Check if the request is for the dashboard
    if (req.path === endpoint || req.path === `${endpoint}/data`) {
      // 1. IP Whitelisting (Stealth Mode)
      if (!monitor.isIpAllowed(ip)) {
        return next();
      }

      // 2. Handle API data request
      if (req.path === `${endpoint}/data`) {
        const authHeader = req.headers['x-pulse-auth'] || req.query.secret;
        if ((monitor as any).config.authSecret && !monitor.validateAuth(String(authHeader))) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        return res.json(monitor.getDashboardData());
      }

      // 3. Serve HTML Dashboard
      const html = monitor.getDashboardHtml();
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);
    }

    const logBodies = (monitor as any).config.logBodies;
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
          const maxLimit = ((monitor as any).config.maxBodySizeKb ?? 64) * 1024;
          resBody = bodyBuffer.subarray(0, maxLimit).toString('utf8');
        } catch (e) {}

        return oldEnd.apply(res, arguments as any);
      };
    }

    // Capture request details for threat detection and body logging
    const reqDetails = {
      headers: req.headers,
      query: req.query,
      body: req.body,
    };

    // Listen for response finish to record metrics
    res.on('finish', () => {
      const diff = process.hrtime(start);
      const durationMs = diff[0] * 1e3 + diff[1] * 1e-6;

      monitor.recordRequest(
        {
          path: req.path,
          method: req.method,
          statusCode: res.statusCode,
          durationMs,
          ip,
          userAgent: req.headers['user-agent'],
        },
        {
          ...reqDetails,
          resBody
        }
      );
    });

    next();
  };
}
