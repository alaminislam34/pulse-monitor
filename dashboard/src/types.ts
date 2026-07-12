export interface SystemMetrics {
  memory: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    systemTotal: number;
    systemFree: number;
  };
  uptime: number;
  cpuUsage: {
    user: number;
    system: number;
  };
  cpuCount: number;
  loadAvg: [number, number, number];
  nodeVersion: string;
  platform: string;
  pid: number;
  eventLoopLag: number;
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

export interface SecurityAlert {
  timestamp: number;
  ip: string;
  path: string;
  method: string;
  attackType: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  details: string;
}

export interface MonitorData {
  system: SystemMetrics;
  requests: RequestMetrics[];
  threats: SecurityAlert[];
  discoveredRoutes?: Array<{ path: string; method: string }>;
  config: {
    enableThreatDetection: boolean;
    maxBufferSize: number;
    isServerless: boolean;
    dashboardEndpoint: string;
    hasAuth: boolean;
    logBodies?: boolean;
  };
}

export interface Recommendation {
  id: string;
  type: 'security' | 'performance' | 'capacity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  action: string;
}
