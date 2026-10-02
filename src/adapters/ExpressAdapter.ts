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

    // Check if the request is for the dashboard or its API endpoints
    const isDashboardRoot = req.path === endpoint || req.path === `${endpoint}/`;
    const isDashboardApi = req.path.startsWith(`${endpoint}/`);

    if (isDashboardRoot || isDashboardApi) {
      // 1. IP Whitelisting (Stealth Mode)
      if (!monitor.isIpAllowed(ip)) {
        return next();
      }

      const checkAuth = () => {
        const authHeader = req.headers['x-pulse-auth'] || req.query.secret;
        if ((monitor as any).config.authSecret && !monitor.validateAuth(String(authHeader))) {
          res.status(401).json({ error: 'Unauthorized' });
          return false;
        }
        return true;
      };

      // 2. Metadata Endpoint
      if (req.path === `${endpoint}/api/meta`) {
        if (!checkAuth()) return;
        return res.json(monitor.getProtocolMeta());
      }

      // 3. Events Endpoint (Historical data)
      if (req.path === `${endpoint}/api/events`) {
        if (!checkAuth()) return;
        return res.json(monitor.getCanonicalEvents(req.query));
      }

      // 4. SSE Stream Endpoint (Live push)
      if (req.path === `${endpoint}/api/stream`) {
        if (!checkAuth()) return;
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        if (typeof res.flushHeaders === 'function') {
          res.flushHeaders();
        }

        res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);

        const unsubscribe = monitor.subscribeStream((event: any) => {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        });

        const pingInterval = setInterval(() => {
          res.write(': ping\n\n');
        }, 15000);

        req.on('close', () => {
          clearInterval(pingInterval);
          unsubscribe();
        });
        return;
      }

      // 5. Legacy Dashboard Data Endpoint (Backward compatibility)
      if (req.path === `${endpoint}/data`) {
        if (!checkAuth()) return;
        return res.json(monitor.getDashboardData());
      }

      // 6. Serve HTML Dashboard
      if (isDashboardRoot) {
        const html = monitor.getDashboardHtml();
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(html);
      }
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
