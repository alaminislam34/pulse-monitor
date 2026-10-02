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

export class OpenApiManager {
  private spec: any = null;
  private pathRegexes: Array<{
    template: string;
    regex: RegExp;
    paramNames: string[];
    methods: Record<string, any>;
  }> = [];

  constructor(spec?: any) {
    if (spec) {
      this.loadSpec(spec);
    }
  }

  /**
   * Ingests and compiles OpenAPI 3.0 / 3.1 or Swagger 2.0 JSON schema
   */
  public loadSpec(spec: any): void {
    if (!spec || typeof spec !== 'object') return;
    this.spec = spec;
    this.pathRegexes = [];

    const paths = spec.paths || {};
    for (const [pathTemplate, pathItem] of Object.entries(paths)) {
      if (!pathItem || typeof pathItem !== 'object') continue;

      // Extract parameter names and convert {param} to regex pattern
      const paramNames: string[] = [];
      const regexStr = '^' + pathTemplate.replace(/\{([^}]+)\}/g, (_, paramName) => {
        paramNames.push(paramName);
        return '([^/]+)';
      }) + '$';

      const regex = new RegExp(regexStr, 'i');
      const methods: Record<string, any> = {};

      const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];
      for (const m of httpMethods) {
        if ((pathItem as any)[m]) {
          methods[m.toUpperCase()] = (pathItem as any)[m];
        }
      }

      this.pathRegexes.push({
        template: pathTemplate,
        regex,
        paramNames,
        methods,
      });
    }
  }

  public hasSpec(): boolean {
    return !!this.spec;
  }

  public getRawSpec(): any {
    return this.spec;
  }

  /**
   * Matches an incoming HTTP request path against the compiled OpenAPI path templates
   */
  public matchRoute(method: string, requestPath: string): { template: string; operation: any } | null {
    const cleanPath = requestPath.split('?')[0].replace(/\/$/, '') || '/';
    const upperMethod = method.toUpperCase();

    for (const entry of this.pathRegexes) {
      const match = cleanPath.match(entry.regex);
      if (match) {
        const operation = entry.methods[upperMethod];
        if (operation) {
          return { template: entry.template, operation };
        }
      }
    }

    return null;
  }

  /**
   * Validates live traffic against OpenAPI spec to detect contract drift
   */
  public validateTraffic(
    method: string,
    requestPath: string,
    statusCode: number,
    resBody?: any
  ): OpenApiDriftResult {
    if (!this.hasSpec()) {
      return { isDocumented: true, hasSchemaMismatch: false };
    }

    const matched = this.matchRoute(method, requestPath);
    if (!matched) {
      return {
        isDocumented: false,
        hasSchemaMismatch: true,
        driftCategory: 'UNDOCUMENTED_ROUTE',
        description: `Route ${method.toUpperCase()} ${requestPath} is not documented in OpenAPI spec`,
      };
    }

    const { template, operation } = matched;
    const responses = operation.responses || {};
    const statusStr = String(statusCode);
    const matchedResponse = responses[statusStr] || responses[statusStr[0] + 'XX'] || responses['default'];

    if (!matchedResponse) {
      return {
        isDocumented: true,
        matchedOpenApiPath: template,
        hasSchemaMismatch: true,
        driftCategory: 'UNDOCUMENTED_STATUS',
        description: `HTTP ${statusCode} response for ${method.toUpperCase()} ${template} is not documented in OpenAPI spec`,
      };
    }

    // Inspect schema drift if response body is JSON
    if (resBody && typeof resBody === 'object') {
      const jsonContent = matchedResponse.content?.['application/json'] || matchedResponse.schema;
      const schema = jsonContent?.schema || jsonContent;

      if (schema && schema.properties) {
        const expectedProps = Object.keys(schema.properties);
        const actualProps = Object.keys(resBody);
        const requiredProps: string[] = schema.required || [];

        const missingRequired = requiredProps.filter(p => !(p in resBody));
        const undocumentedFields = actualProps.filter(p => !expectedProps.includes(p));

        if (missingRequired.length > 0 || undocumentedFields.length > 0) {
          return {
            isDocumented: true,
            matchedOpenApiPath: template,
            hasSchemaMismatch: true,
            driftCategory: 'SCHEMA_MISMATCH',
            description: missingRequired.length > 0
              ? `Missing required properties: [${missingRequired.join(', ')}]`
              : `Found undocumented properties: [${undocumentedFields.join(', ')}]`,
            diff: {
              missingRequired: missingRequired.length > 0 ? missingRequired : undefined,
              undocumentedFields: undocumentedFields.length > 0 ? undocumentedFields : undefined,
            },
          };
        }
      }
    }

    return {
      isDocumented: true,
      matchedOpenApiPath: template,
      hasSchemaMismatch: false,
    };
  }

  /**
   * Returns a flattened list of all documented endpoints in the OpenAPI spec
   */
  public getDocumentedEndpoints(): DiscoveredEndpoint[] {
    const endpoints: DiscoveredEndpoint[] = [];
    if (!this.spec || !this.spec.paths) return endpoints;

    for (const [path, pathItem] of Object.entries(this.spec.paths as Record<string, any>)) {
      if (!pathItem) continue;
      const httpMethods = ['get', 'post', 'put', 'delete', 'patch'];
      for (const m of httpMethods) {
        if (pathItem[m]) {
          endpoints.push({
            path,
            method: m.toUpperCase(),
            summary: pathItem[m].summary,
            tags: pathItem[m].tags,
            operationId: pathItem[m].operationId,
          });
        }
      }
    }
    return endpoints;
  }
}
