export interface SecurityAlert {
  timestamp: number;
  ip: string;
  path: string;
  method: string;
  attackType: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  details: string;
}

export class ThreatDetector {
  // Common attack patterns
  private static SQL_INJECTION_REGEX = /(\b(union\s+select|select\s+.*\s+from|insert\s+into|update\s+.*\s+set|delete\s+from|drop\s+table)\b|--|\/\*|\*\/|'\s*(or|and)\s+\d+\s*=\s*\d+|"\s*(or|and)\s+\d+\s*=\s*\d+)/i;
  private static XSS_REGEX = /(<script|javascript:|onload|onerror|onclick|alert\(|<img\s+src)/i;
  private static PATH_TRAVERSAL_REGEX = /(\.\.\/|\.\.\\|etc\/passwd|boot\.ini|win\.ini)/i;
  private static SUSPICIOUS_USER_AGENTS = /(sqlmap|nikto|dirbuster|nmap|hydra|acunetix|w3af)/i;

  constructor() {}

  /**
   * Evaluates a request for potential security threats.
   * If a threat is detected, it returns a SecurityAlert object, otherwise null.
   */
  public detectThreat(req: {
    ip: string;
    path: string;
    method: string;
    headers: Record<string, string | string[] | undefined>;
    query: Record<string, any>;
    body?: any;
  }): SecurityAlert | null {
    const { ip, path, method, headers, query, body } = req;

    // 1. Check URL Path for Path Traversal or SQLi
    if (ThreatDetector.PATH_TRAVERSAL_REGEX.test(path)) {
      return this.createAlert(ip, path, method, "Path Traversal", "HIGH", `Suspicious path traversal pattern in URL: ${path}`);
    }

    if (ThreatDetector.SQL_INJECTION_REGEX.test(path)) {
      return this.createAlert(ip, path, method, "SQL Injection", "HIGH", `SQL injection signature detected in URL path: ${path}`);
    }

    if (ThreatDetector.XSS_REGEX.test(path)) {
      return this.createAlert(ip, path, method, "XSS", "HIGH", `XSS signature detected in URL path: ${path}`);
    }

    // 2. Check Query Parameters
    for (const [key, value] of Object.entries(query)) {
      const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
      
      if (ThreatDetector.SQL_INJECTION_REGEX.test(valueStr)) {
        return this.createAlert(
          ip, path, method, "SQL Injection", "HIGH", 
          `SQL injection signature detected in query param '${key}': ${valueStr}`
        );
      }
      
      if (ThreatDetector.XSS_REGEX.test(valueStr)) {
        return this.createAlert(
          ip, path, method, "XSS", "HIGH", 
          `XSS signature detected in query param '${key}': ${valueStr}`
        );
      }
      
      if (ThreatDetector.PATH_TRAVERSAL_REGEX.test(valueStr)) {
        return this.createAlert(
          ip, path, method, "Path Traversal", "HIGH", 
          `Path traversal signature detected in query param '${key}': ${valueStr}`
        );
      }
    }

    // 3. Check Headers (User-Agent, etc.)
    const userAgent = headers['user-agent'];
    if (userAgent && typeof userAgent === 'string') {
      if (ThreatDetector.SUSPICIOUS_USER_AGENTS.test(userAgent)) {
        return this.createAlert(
          ip, path, method, "Vulnerability Scanner", "MEDIUM", 
          `Suspicious User-Agent detected: ${userAgent}`
        );
      }
    }

    // 4. Check Request Body (if provided)
    if (body) {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      
      if (ThreatDetector.SQL_INJECTION_REGEX.test(bodyStr)) {
        return this.createAlert(
          ip, path, method, "SQL Injection", "CRITICAL", 
          `SQL injection signature detected in request body`
        );
      }
      
      if (ThreatDetector.XSS_REGEX.test(bodyStr)) {
        return this.createAlert(
          ip, path, method, "XSS", "CRITICAL", 
          `XSS signature detected in request body`
        );
      }
      
      if (ThreatDetector.PATH_TRAVERSAL_REGEX.test(bodyStr)) {
        return this.createAlert(
          ip, path, method, "Path Traversal", "CRITICAL", 
          `Path traversal signature detected in request body`
        );
      }
    }

    return null;
  }

  private createAlert(
    ip: string,
    path: string,
    method: string,
    attackType: string,
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
    details: string
  ): SecurityAlert {
    return {
      timestamp: Date.now(),
      ip,
      path,
      method,
      attackType,
      severity,
      details
    };
  }
}
