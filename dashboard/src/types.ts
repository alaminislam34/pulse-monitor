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

export interface OpenApiDriftResult {
  isDocumented: boolean;
  matchedOpenApiPath?: string;
  hasSchemaMismatch: boolean;
  driftCategory?: 'UNDOCUMENTED_ROUTE' | 'UNDOCUMENTED_STATUS' | 'SCHEMA_MISMATCH';
  description?: string;
  diff?: {
    missingRequired?: string[];
    undocumentedFields?: string[];
  };
}

export interface DiscoveredEndpoint {
  path: string;
  method: string;
  summary?: string;
  tags?: string[];
  operationId?: string;
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
  documentedRoutes?: DiscoveredEndpoint[];
  hasOpenApiSpec?: boolean;
  config: {
    enableThreatDetection: boolean;
    maxBufferSize: number;
    isServerless: boolean;
    dashboardEndpoint: string;
    hasAuth: boolean;
    logBodies?: boolean;
    serviceName?: string;
    openApiSpecUrl?: string;
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
