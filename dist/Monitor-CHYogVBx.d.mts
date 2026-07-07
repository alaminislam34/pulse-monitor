interface SecurityAlert {
    timestamp: number;
    ip: string;
    path: string;
    method: string;
    attackType: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    details: string;
}
declare class ThreatDetector {
    private static SQL_INJECTION_REGEX;
    private static XSS_REGEX;
    private static PATH_TRAVERSAL_REGEX;
    private static SUSPICIOUS_USER_AGENTS;
    constructor();
    /**
     * Evaluates a request for potential security threats.
     * If a threat is detected, it returns a SecurityAlert object, otherwise null.
     */
    detectThreat(req: {
        ip: string;
        path: string;
        method: string;
        headers: Record<string, string | string[] | undefined>;
        query: Record<string, any>;
        body?: any;
    }): SecurityAlert | null;
    private createAlert;
}

interface MonitorConfig {
    maxBufferSize?: number;
    enableThreatDetection?: boolean;
    databaseUrl?: string;
    whitelistIps?: string[];
    dashboardEndpoint?: string;
    authSecret?: string;
    logBodies?: boolean;
    maxBodySizeKb?: number;
}
interface RequestMetrics {
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
declare class Monitor {
    private config;
    private metricsBuffer;
    private securityBuffer;
    private threatDetector;
    private isServerless;
    private worker;
    private startTime;
    private eventLoopLag;
    private lastEventLoopTime;
    private discoveredRoutes;
    hasScannedRoutes: boolean;
    constructor(config?: MonitorConfig);
    /**
     * Initializes a single persistent background worker thread to process metrics asynchronously.
     */
    private initWorker;
    private updateRecordWithInferredTypes;
    private inferTypeSync;
    /**
     * Main entrypoint to record a request and check for security threats.
     */
    recordRequest(reqMetrics: Omit<RequestMetrics, 'timestamp'>, reqDetails?: {
        headers: Record<string, string | string[] | undefined>;
        query: Record<string, any>;
        body?: any;
        resBody?: string;
    }): void;
    private saveSynchronously;
    registerDiscoveredRoutes(routes: Array<{
        path: string;
        method: string;
    }>): void;
    /**
     * Helper to retrieve current system metrics (CPU, memory, uptime).
     */
    getSystemMetrics(): {
        memory: {
            rss: number;
            heapUsed: number;
            heapTotal: number;
            systemTotal: number;
            systemFree: number;
        };
        uptime: number;
        cpuUsage: NodeJS.CpuUsage;
        cpuCount: number;
        loadAvg: number[];
        nodeVersion: string;
        platform: NodeJS.Platform;
        pid: number;
        eventLoopLag: number;
    };
    private startEventLoopMonitoring;
    /**
     * Retrives the serialized buffer data.
     */
    getDashboardData(): {
        system: {
            memory: {
                rss: number;
                heapUsed: number;
                heapTotal: number;
                systemTotal: number;
                systemFree: number;
            };
            uptime: number;
            cpuUsage: NodeJS.CpuUsage;
            cpuCount: number;
            loadAvg: number[];
            nodeVersion: string;
            platform: NodeJS.Platform;
            pid: number;
            eventLoopLag: number;
        };
        requests: RequestMetrics[];
        threats: SecurityAlert[];
        discoveredRoutes: {
            path: string;
            method: string;
        }[];
        config: {
            enableThreatDetection: boolean;
            maxBufferSize: number;
            isServerless: boolean;
            dashboardEndpoint: string;
            hasAuth: boolean;
            logBodies: boolean;
        };
    };
    /**
     * Validates if a given IP is whitelisted (if whitelist configured).
     */
    isIpAllowed(ip: string): boolean;
    /**
     * Validates auth secret if configured.
     */
    validateAuth(secret: string): boolean;
    /**
     * Loads the built single-file dashboard HTML content.
     */
    getDashboardHtml(): string;
}

export { Monitor as M, type RequestMetrics as R, type SecurityAlert as S, ThreatDetector as T, type MonitorConfig as a };
