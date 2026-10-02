import fs from 'fs';
import path from 'path';
import os from 'os';
import { Worker } from 'worker_threads';
import { CircularBuffer } from './CircularBuffer';
import { ThreatDetector, SecurityAlert } from '../security/ThreatDetector';
import { OpenApiManager, OpenApiDriftResult } from '../openapi/OpenApiManager';

export interface MonitorConfig {
  maxBufferSize?: number;
  enableThreatDetection?: boolean;
  databaseUrl?: string;
  whitelistIps?: string[];
  dashboardEndpoint?: string;
  authSecret?: string;
  logBodies?: boolean;
  maxBodySizeKb?: number;
  serviceName?: string;
  openApiSpecUrl?: string;
  openApiSpec?: any;
}

export interface RequestMetrics {
  timestamp: number;
  path: string;
  method: string;
  statusCode: number;
  durationMs: number;
  ip: string;
  userAgent?: string;
  reqBody?: string;
  resBody?: string;
  inferredReqType?: string;
  inferredResType?: string;
  drift?: OpenApiDriftResult;
}

export class Monitor {
  private config: Required<MonitorConfig>;
  private metricsBuffer: CircularBuffer<RequestMetrics>;
  private securityBuffer: CircularBuffer<SecurityAlert>;
  private threatDetector: ThreatDetector;
  private isServerless: boolean;
  private worker: Worker | null = null;
  private startTime: number;
  private eventLoopLag: number = 0;
  private lastEventLoopTime: number = Date.now();
  private discoveredRoutes: Array<{ path: string; method: string }> = [];
  private streamSubscribers: Set<(event: any) => void> = new Set();
  private openApiManager: OpenApiManager;

  constructor(config: MonitorConfig = {}) {
    this.startTime = Date.now();
    this.config = {
      maxBufferSize: config.maxBufferSize ?? 1000,
      enableThreatDetection: config.enableThreatDetection ?? true,
      databaseUrl: config.databaseUrl ?? '',
      whitelistIps: config.whitelistIps ?? [],
      dashboardEndpoint: config.dashboardEndpoint ?? '/pulse',
      authSecret: config.authSecret ?? '',
      logBodies: config.logBodies ?? true,
      maxBodySizeKb: config.maxBodySizeKb ?? 64,
      serviceName: config.serviceName ?? 'Pulse API Service',
      openApiSpecUrl: config.openApiSpecUrl ?? '',
      openApiSpec: config.openApiSpec ?? null,
    };

    this.metricsBuffer = new CircularBuffer<RequestMetrics>(this.config.maxBufferSize);
    this.securityBuffer = new CircularBuffer<SecurityAlert>(this.config.maxBufferSize);
    this.threatDetector = new ThreatDetector();
    this.openApiManager = new OpenApiManager(this.config.openApiSpec);

    // Auto-detect serverless environment
    this.isServerless = !!(
      process.env.VERCEL ||
      process.env.NETLIFY ||
      process.env.LAMBDA_TASK_ROOT ||
      process.env.FUNCTIONS_SIGNATURE
    );

    if (this.isServerless) {
      console.log('ℹ️ [PulseMonitor] Serverless environment detected. Processing logs synchronously.');
    } else {
      this.initWorker();
      this.startEventLoopMonitoring();
    }
  }

  /**
   * Initializes a single persistent background worker thread to process metrics asynchronously.
   */
  private initWorker(): void {
    const workerCode = `
      const { parentPort } = require('worker_threads');

      function inferJsonType(obj) {
        if (obj === null || obj === undefined) return 'null';
        if (typeof obj !== 'object') return typeof obj;
        if (Array.isArray(obj)) {
          if (obj.length === 0) return 'any[]';
          return inferJsonType(obj[0]) + '[]';
        }
        const keys = Object.keys(obj);
        if (keys.length > 50) return '{ [key: string]: any }';
        const fields = keys.map(key => {
          const cleanKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
          return cleanKey + ': ' + inferJsonType(obj[key]);
        });
        return '{ ' + fields.join('; ') + ' }';
      }

      parentPort.on('message', (msg) => {
        try {
          if (msg.type === 'record') {
            const { payload, reqBody, resBody } = msg;
            
            let inferredReqType = 'any';
            let inferredResType = 'any';

            if (reqBody) {
              try {
                const parsed = typeof reqBody === 'string' ? JSON.parse(reqBody) : reqBody;
                inferredReqType = inferJsonType(parsed);
              } catch (e) {}
            }

            if (resBody) {
              try {
                const parsed = typeof resBody === 'string' ? JSON.parse(resBody) : resBody;
                inferredResType = inferJsonType(parsed);
              } catch (e) {}
            }

            parentPort.postMessage({
              type: 'processed',
              timestamp: payload.timestamp,
              inferredReqType,
              inferredResType,
              reqBody: typeof reqBody === 'object' ? JSON.stringify(reqBody) : reqBody,
              resBody: typeof resBody === 'object' ? JSON.stringify(resBody) : resBody
            });
          }
        } catch (err) {
          console.error('[PulseMonitor Worker Error]:', err);
        }
      });
    `;

    try {
      this.worker = new Worker(workerCode, { eval: true });
      this.worker.on('message', (msg: any) => {
        if (msg.type === 'processed') {
          this.updateRecordWithInferredTypes(msg);
        }
      });
      this.worker.unref(); // Allow the main thread to exit cleanly
    } catch (err) {
      console.error('⚠️ [PulseMonitor] Failed to initialize worker thread, falling back to synchronous processing.', err);
      this.worker = null;
    }
  }

  private updateRecordWithInferredTypes(msg: {
    timestamp: number;
    inferredReqType: string;
    inferredResType: string;
    reqBody?: string;
    resBody?: string;
  }): void {
    const records = this.metricsBuffer.toArray();
    const record = records.find(r => r.timestamp === msg.timestamp);
    if (record) {
      record.inferredReqType = msg.inferredReqType;
      record.inferredResType = msg.inferredResType;
      if (this.config.logBodies) {
        const limit = this.config.maxBodySizeKb * 1024;
        if (msg.reqBody) record.reqBody = msg.reqBody.substring(0, limit);
        if (msg.resBody) record.resBody = msg.resBody.substring(0, limit);
      }
    }
  }

  private inferTypeSync(body: any): string {
    if (body === null || body === undefined) return 'null';
    if (typeof body !== 'object') return typeof body;
    if (Array.isArray(body)) {
      if (body.length === 0) return 'any[]';
      return `${this.inferTypeSync(body[0])}[]`;
    }
    const keys = Object.keys(body);
    if (keys.length > 50) return '{ [key: string]: any }';
    const fields = keys.map(key => {
      const cleanKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
      return `${cleanKey}: ${this.inferTypeSync(body[key])}`;
    });
    return `{ ${fields.join('; ')} }`;
  }

  public sanitizeHeaders(headers: Record<string, any> = {}): Record<string, any> {
    const sensitive = ['authorization', 'cookie', 'set-cookie', 'x-api-key', 'jwt', 'token'];
    const sanitized: Record<string, any> = {};
    for (const [k, v] of Object.entries(headers)) {
      if (sensitive.includes(k.toLowerCase())) {
        sanitized[k] = '[REDACTED]';
      } else {
        sanitized[k] = v;
      }
    }
    return sanitized;
  }

  public sanitizePayload(body: any): any {
    if (!body) return body;
    if (typeof body === 'string') {
      try {
        const parsed = JSON.parse(body);
        return JSON.stringify(this.sanitizePayload(parsed));
      } catch {
        return body;
      }
    }
    if (typeof body !== 'object') return body;
    if (Array.isArray(body)) {
      return body.map(item => this.sanitizePayload(item));
    }
    const sensitive = ['password', 'passwd', 'secret', 'credit_card', 'cvv', 'token', 'ssn', 'apikey', 'api_key'];
    const sanitized: Record<string, any> = {};
    for (const [k, v] of Object.entries(body)) {
      if (sensitive.some(s => k.toLowerCase().includes(s))) {
        sanitized[k] = '[REDACTED]';
      } else {
        sanitized[k] = this.sanitizePayload(v);
      }
    }
    return sanitized;
  }

  public subscribeStream(subscriber: (event: any) => void): () => void {
    this.streamSubscribers.add(subscriber);
    return () => {
      this.streamSubscribers.delete(subscriber);
    };
  }

  public broadcastEvent(event: any): void {
    for (const sub of this.streamSubscribers) {
      try {
        sub(event);
      } catch {
        this.streamSubscribers.delete(sub);
      }
    }
  }

  /**
   * Main entrypoint to record a request and check for security threats.
   */
  public recordRequest(
    reqMetrics: Omit<RequestMetrics, 'timestamp'>,
    reqDetails?: {
      headers: Record<string, string | string[] | undefined>;
      query: Record<string, any>;
      body?: any;
      resBody?: string;
    }
  ): void {
    const timestamp = Date.now();
    const metrics: RequestMetrics = { ...reqMetrics, timestamp };

    // 1. Process threats if enabled
    if (this.config.enableThreatDetection && reqDetails) {
      const alert = this.threatDetector.detectThreat({
        ip: metrics.ip,
        path: metrics.path,
        method: metrics.method,
        headers: reqDetails.headers,
        query: reqDetails.query,
        body: reqDetails.body,
      });

      if (alert) {
        this.securityBuffer.push(alert);
        console.warn(`⚠️ [PulseMonitor Security Alert] ${alert.attackType} from ${alert.ip} on ${alert.method} ${alert.path} (Severity: ${alert.severity})`);
        this.broadcastEvent({
          id: `thr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          type: 'threat',
          timestamp: alert.timestamp,
          threatType: alert.attackType,
          severity: alert.severity,
          targetField: 'request',
          matchedPattern: alert.details,
          clientIp: alert.ip,
          userAgent: reqDetails.headers?.['user-agent'] as string | undefined,
        });
      }
    }

    // 2. Validate OpenAPI contract drift
    let parsedResBody: any = undefined;
    if (reqDetails?.resBody) {
      try {
        parsedResBody = typeof reqDetails.resBody === 'string' ? JSON.parse(reqDetails.resBody) : reqDetails.resBody;
      } catch {}
    }
    const driftResult = this.openApiManager.validateTraffic(
      metrics.method,
      metrics.path,
      metrics.statusCode,
      parsedResBody
    );
    metrics.drift = driftResult;

    if (driftResult.hasSchemaMismatch) {
      this.broadcastEvent({
        id: `drf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'drift',
        timestamp: metrics.timestamp,
        ...driftResult,
      });
    }

    // 3. Offload metrics depending on environment
    this.metricsBuffer.push(metrics);

    // 4. Broadcast to real-time subscribers (SSE)
    this.broadcastEvent({
      id: `req_${metrics.timestamp}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'request',
      timestamp: metrics.timestamp,
      request: {
        method: metrics.method,
        path: metrics.path,
        ip: metrics.ip,
        userAgent: metrics.userAgent,
      },
      response: {
        statusCode: metrics.statusCode,
        durationMs: metrics.durationMs,
      },
      drift: metrics.drift,
    });

    if (this.isServerless) {
      if (reqDetails && this.config.logBodies) {
        try {
          const limit = this.config.maxBodySizeKb * 1024;
          const reqBodyStr = typeof reqDetails.body === 'object' ? JSON.stringify(reqDetails.body) : String(reqDetails.body || '');
          const resBodyStr = reqDetails.resBody || '';

          metrics.inferredReqType = this.inferTypeSync(reqDetails.body);
          metrics.inferredResType = resBodyStr ? this.inferTypeSync(JSON.parse(resBodyStr)) : 'any';

          metrics.reqBody = reqBodyStr.substring(0, limit);
          metrics.resBody = resBodyStr.substring(0, limit);
        } catch (e) {
          metrics.inferredResType = 'any';
        }
      }
      this.saveSynchronously(metrics);
    } else {
      if (this.worker) {
        this.worker.postMessage({
          type: 'record',
          payload: metrics,
          reqBody: reqDetails?.body,
          resBody: reqDetails?.resBody
        });
      }
    }
  }

  private saveSynchronously(metrics: RequestMetrics): void {
    if (this.config.databaseUrl) {
      // Stub for optional database persistence in serverless logs
    } else {
      // Output to stdout for hosting platform log collectors
      console.log(`[PulseMonitor Metrics]: ${JSON.stringify(metrics)}`);
    }
  }

  public registerDiscoveredRoutes(routes: Array<{ path: string; method: string }>): void {
    const endpoint = this.config.dashboardEndpoint;
    this.discoveredRoutes = routes.filter(
      (route, index, self) =>
        !route.path.startsWith(endpoint) &&
        index === self.findIndex(r => r.path === route.path && r.method === route.method)
    );
  }

  public setOpenApiSpec(spec: any): void {
    this.openApiManager.loadSpec(spec);
    const documented = this.openApiManager.getDocumentedEndpoints();
    if (documented.length > 0) {
      this.registerDiscoveredRoutes(documented.map(d => ({ path: d.path, method: d.method })));
    }
  }

  public getOpenApiManager(): OpenApiManager {
    return this.openApiManager;
  }

  /**
   * Helper to retrieve current system metrics (CPU, memory, uptime).
   */
  public getSystemMetrics() {
    const memory = process.memoryUsage();
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const cpu = process.cpuUsage();
    const loadAvg = os.loadavg();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    return {
      memory: {
        rss: Math.round(memory.rss / (1024 * 1024) * 100) / 100, // MB
        heapUsed: Math.round(memory.heapUsed / (1024 * 1024) * 100) / 100, // MB
        heapTotal: Math.round(memory.heapTotal / (1024 * 1024) * 100) / 100, // MB
        systemTotal: Math.round(totalMem / (1024 * 1024) * 100) / 100, // MB
        systemFree: Math.round(freeMem / (1024 * 1024) * 100) / 100, // MB
      },
      uptime,
      cpuUsage: cpu,
      cpuCount: os.cpus().length,
      loadAvg: [
        Math.round(loadAvg[0] * 100) / 100,
        Math.round(loadAvg[1] * 100) / 100,
        Math.round(loadAvg[2] * 100) / 100,
      ],
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid,
      eventLoopLag: Math.round(this.eventLoopLag * 100) / 100,
    };
  }

  private startEventLoopMonitoring() {
    if (this.isServerless) return;
    const check = () => {
      const now = Date.now();
      this.eventLoopLag = Math.max(0, now - this.lastEventLoopTime - 1000);
      this.lastEventLoopTime = now;
      setTimeout(check, 1000).unref();
    };
    setTimeout(check, 1000).unref();
  }

  /**
   * Retrives the serialized buffer data.
   */
  public getDashboardData() {
    return {
      system: this.getSystemMetrics(),
      requests: this.metricsBuffer.toArray(),
      threats: this.securityBuffer.toArray(),
      discoveredRoutes: this.discoveredRoutes,
      documentedRoutes: this.openApiManager.getDocumentedEndpoints(),
      hasOpenApiSpec: this.openApiManager.hasSpec(),
      config: {
        enableThreatDetection: this.config.enableThreatDetection,
        maxBufferSize: this.config.maxBufferSize,
        isServerless: this.isServerless,
        dashboardEndpoint: this.config.dashboardEndpoint,
        hasAuth: !!this.config.authSecret,
        logBodies: this.config.logBodies,
        serviceName: this.config.serviceName,
        openApiSpecUrl: this.config.openApiSpecUrl,
      },
    };
  }

  /**
   * Returns host and runtime metadata compliant with SPEC.md
   */
  public getProtocolMeta() {
    return {
      protocolVersion: '0.1.0',
      runtime: {
        language: 'node',
        framework: 'express',
        version: process.version,
      },
      serviceName: this.config.serviceName,
      bufferSize: this.config.maxBufferSize,
      features: {
        threatDetection: this.config.enableThreatDetection,
        openApiDrift: !!this.config.openApiSpecUrl,
        payloadInspection: this.config.logBodies,
      },
      openApiSpecUrl: this.config.openApiSpecUrl || undefined,
    };
  }

  /**
   * Returns canonical events array compliant with SPEC.md
   */
  public getCanonicalEvents(options: { limit?: number; since?: number; type?: string } = {}) {
    const limit = options.limit ? Math.min(Number(options.limit), 1000) : 100;
    const since = options.since ? Number(options.since) : 0;
    const filterType = options.type || 'all';

    const events: any[] = [];

    if (filterType === 'all' || filterType === 'request') {
      const requests = this.metricsBuffer.toArray()
        .filter(r => r.timestamp >= since)
        .map(r => ({
          id: `req_${r.timestamp}_${Math.random().toString(36).substring(2, 7)}`,
          type: 'request',
          timestamp: r.timestamp,
          request: {
            method: r.method,
            path: r.path,
            ip: r.ip,
            userAgent: r.userAgent,
            body: r.reqBody,
            inferredSchema: r.inferredReqType,
          },
          response: {
            statusCode: r.statusCode,
            durationMs: r.durationMs,
            body: r.resBody,
            inferredSchema: r.inferredResType,
          },
        }));
      events.push(...requests);
    }

    if (filterType === 'all' || filterType === 'threat') {
      const threats = this.securityBuffer.toArray()
        .filter(t => t.timestamp >= since)
        .map(t => ({
          id: `thr_${t.timestamp}_${Math.random().toString(36).substring(2, 7)}`,
          type: 'threat',
          timestamp: t.timestamp,
          threatType: t.attackType,
          severity: t.severity,
          targetField: 'request',
          matchedPattern: t.details,
          clientIp: t.ip,
        }));
      events.push(...threats);
    }

    events.sort((a, b) => b.timestamp - a.timestamp);
    return events.slice(0, limit);
  }

  /**
   * Validates if a given IP is whitelisted (if whitelist configured).
   */
  public isIpAllowed(ip: string): boolean {
    if (this.config.whitelistIps.length === 0) return true;
    return this.config.whitelistIps.includes(ip);
  }

  /**
   * Validates auth secret if configured.
   */
  public validateAuth(secret: string): boolean {
    if (!this.config.authSecret) return true;
    return this.config.authSecret === secret;
  }

  /**
   * Loads the built single-file dashboard HTML content.
   */
  public getDashboardHtml(): string {
    const pathsToTry = [
      path.join(__dirname, 'ui', 'index.html'),
      path.join(__dirname, '../ui', 'index.html'),
      path.join(__dirname, '../dist/ui', 'index.html'),
      path.join(process.cwd(), 'dist', 'ui', 'index.html'),
    ];

    const configScript = `<script>window.__PULSE_CONFIG__ = ${JSON.stringify({
      apiPrefix: `${this.config.dashboardEndpoint}/api`,
      streamPrefix: `${this.config.dashboardEndpoint}/api/stream`,
      openApiUrl: this.config.openApiSpecUrl || undefined,
      serviceName: this.config.serviceName,
    })};</script>`;

    for (const p of pathsToTry) {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        return raw.includes('</head>')
          ? raw.replace('</head>', `${configScript}</head>`)
          : `${configScript}${raw}`;
      }
    }

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Pulse Monitor - Error</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; color: #f3f4f6; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #111827; border: 1px solid #1f2937; padding: 2rem; border-radius: 12px; max-width: 500px; text-align: center; }
            h1 { color: #f87171; margin-top: 0; }
            p { color: #9ca3af; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Dashboard UI Asset Not Found</h1>
            <p>The dashboard static assets (index.html) could not be located. Please make sure that you built the UI before starting the application (e.g., run <code>npm run build</code>).</p>
          </div>
        </body>
      </html>
    `;
  }
}
