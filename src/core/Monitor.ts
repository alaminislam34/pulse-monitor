import fs from 'fs';
import path from 'path';
import os from 'os';
import { Worker } from 'worker_threads';
import { CircularBuffer } from './CircularBuffer';
import { ThreatDetector, SecurityAlert } from '../security/ThreatDetector';

export interface MonitorConfig {
  maxBufferSize?: number;
  enableThreatDetection?: boolean;
  databaseUrl?: string;
  whitelistIps?: string[];
  dashboardEndpoint?: string;
  authSecret?: string;
  logBodies?: boolean;
  maxBodySizeKb?: number;
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
  public hasScannedRoutes: boolean = false;

  constructor(config: MonitorConfig = {}) {
    this.startTime = Date.now();
    this.config = {
      maxBufferSize: config.maxBufferSize ?? 1000,
      enableThreatDetection: config.enableThreatDetection ?? true,
      databaseUrl: config.databaseUrl ?? '',
      whitelistIps: config.whitelistIps ?? [],
      dashboardEndpoint: config.dashboardEndpoint ?? '/pulse',
      authSecret: config.authSecret ?? '',
      logBodies: config.logBodies ?? false,
      maxBodySizeKb: config.maxBodySizeKb ?? 64,
    };

    this.metricsBuffer = new CircularBuffer<RequestMetrics>(this.config.maxBufferSize);
    this.securityBuffer = new CircularBuffer<SecurityAlert>(this.config.maxBufferSize);
    this.threatDetector = new ThreatDetector();

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
      }
    }

    // 2. Offload metrics depending on environment
    this.metricsBuffer.push(metrics);

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
      config: {
        enableThreatDetection: this.config.enableThreatDetection,
        maxBufferSize: this.config.maxBufferSize,
        isServerless: this.isServerless,
        dashboardEndpoint: this.config.dashboardEndpoint,
        hasAuth: !!this.config.authSecret,
        logBodies: this.config.logBodies,
      },
    };
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

    for (const p of pathsToTry) {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p, 'utf8');
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
