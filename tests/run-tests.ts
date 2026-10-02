import assert from 'assert';
import { CircularBuffer } from '../src/core/CircularBuffer';
import { ThreatDetector } from '../src/security/ThreatDetector';
import { Monitor } from '../src/core/Monitor';

console.log('🧪 Running Pulse Monitor unit tests...');

// 1. Test CircularBuffer
try {
  console.log('  - Testing CircularBuffer...');
  const buffer = new CircularBuffer<number>(3);
  
  assert.strictEqual(buffer.getSize(), 0);
  assert.strictEqual(buffer.getCapacity(), 3);

  buffer.push(1);
  buffer.push(2);
  buffer.push(3);
  assert.strictEqual(buffer.getSize(), 3);
  assert.deepStrictEqual(buffer.toArray(), [1, 2, 3]);

  // Push 4th item, should overwrite 1 (the oldest)
  buffer.push(4);
  assert.strictEqual(buffer.getSize(), 3);
  assert.deepStrictEqual(buffer.toArray(), [2, 3, 4]);

  // Push 5th item, should overwrite 2
  buffer.push(5);
  assert.deepStrictEqual(buffer.toArray(), [3, 4, 5]);

  buffer.clear();
  assert.strictEqual(buffer.getSize(), 0);
  assert.deepStrictEqual(buffer.toArray(), []);
  console.log('  ✅ CircularBuffer tests passed!');
} catch (err) {
  console.error('  ❌ CircularBuffer tests failed:', err);
  process.exit(1);
}

// 2. Test ThreatDetector
try {
  console.log('  - Testing ThreatDetector...');
  const detector = new ThreatDetector();

  // Test safe request
  const safeReq = {
    ip: '127.0.0.1',
    path: '/api/v1/users',
    method: 'GET',
    headers: { 'user-agent': 'Mozilla/5.0' },
    query: { page: '1' }
  };
  assert.strictEqual(detector.detectThreat(safeReq), null);

  // Test SQL injection in query
  const sqlReq = {
    ip: '192.168.1.5',
    path: '/api/v1/search',
    method: 'GET',
    headers: { 'user-agent': 'Mozilla/5.0' },
    query: { q: "1' UNION SELECT username, password FROM users --" }
  };
  const sqlAlert = detector.detectThreat(sqlReq);
  assert.ok(sqlAlert);
  assert.strictEqual(sqlAlert.attackType, 'SQL Injection');
  assert.strictEqual(sqlAlert.severity, 'HIGH');

  // Test XSS in path
  const xssReq = {
    ip: '10.0.0.4',
    path: '/<script>alert(1)</script>',
    method: 'GET',
    headers: {},
    query: {}
  };
  const xssAlert = detector.detectThreat(xssReq);
  assert.ok(xssAlert);
  assert.strictEqual(xssAlert.attackType, 'XSS');

  // Test Path Traversal in body
  const traversalReq = {
    ip: '8.8.8.8',
    path: '/upload',
    method: 'POST',
    headers: {},
    query: {},
    body: { filename: '../../../../etc/passwd' }
  };
  const traversalAlert = detector.detectThreat(traversalReq);
  assert.ok(traversalAlert);
  assert.strictEqual(traversalAlert.attackType, 'Path Traversal');
  assert.strictEqual(traversalAlert.severity, 'CRITICAL');

  console.log('  ✅ ThreatDetector tests passed!');
} catch (err) {
  console.error('  ❌ ThreatDetector tests failed:', err);
  process.exit(1);
}

// 3. Test Monitor Config
try {
  console.log('  - Testing Monitor configurations...');
  const monitor = new Monitor({
    maxBufferSize: 5,
    enableThreatDetection: true,
    whitelistIps: ['127.0.0.1'],
    dashboardEndpoint: '/observability'
  });

  // Verify Whitelist
  assert.strictEqual(monitor.isIpAllowed('127.0.0.1'), true);
  assert.strictEqual(monitor.isIpAllowed('192.168.1.1'), false);

  // Verify Auth Secret (disabled by default)
  assert.strictEqual(monitor.validateAuth('any-password'), true);

  console.log('  ✅ Monitor configuration tests passed!');
} catch (err) {
  console.error('  ❌ Monitor configuration tests failed:', err);
  process.exit(1);
}

// 4. Test Route Discovery and Type Inference
(async () => {
  try {
    console.log('  - Testing Route Discovery and Type Inference...');
    const monitor = new Monitor({
      maxBufferSize: 5,
      logBodies: true,
    });

    // Test route registration
    const dummyRoutes = [
      { path: '/api/v1/users', method: 'GET' },
      { path: '/api/v1/users/:id', method: 'DELETE' },
      { path: '/pulse', method: 'GET' } // should be filtered out because it is the dashboard endpoint
    ];
    monitor.registerDiscoveredRoutes(dummyRoutes);

    const data = monitor.getDashboardData();
    assert.strictEqual(data.discoveredRoutes.length, 2);
    assert.strictEqual(data.discoveredRoutes[0].path, '/api/v1/users');
    assert.strictEqual(data.discoveredRoutes[1].path, '/api/v1/users/:id');

    // Test type inference (via recordRequest)
    const bodyPayload = {
      username: 'johndoe',
      age: 30,
      tags: ['admin', 'moderator'],
      meta: {
        active: true
      }
    };

    monitor.recordRequest({
      path: '/api/v1/login',
      method: 'POST',
      statusCode: 200,
      durationMs: 12.5,
      ip: '127.0.0.1'
    }, {
      headers: {},
      query: {},
      body: bodyPayload,
      resBody: JSON.stringify({ success: true, token: 'xyz123' })
    });

    // Wait a brief moment for worker thread to process the payload
    await new Promise(resolve => setTimeout(resolve, 500));

    const updatedData = monitor.getDashboardData();
    const reqLog = updatedData.requests[0];
    assert.ok(reqLog);
    assert.strictEqual(reqLog.reqBody, JSON.stringify(bodyPayload));
    assert.strictEqual(reqLog.resBody, JSON.stringify({ success: true, token: 'xyz123' }));
    assert.strictEqual(reqLog.inferredReqType, '{ username: string; age: number; tags: string[]; meta: { active: boolean } }');
    assert.strictEqual(reqLog.inferredResType, '{ success: boolean; token: string }');

    console.log('  ✅ Route Discovery and Type Inference tests passed!');

    // 5. Test Wire Protocol, Sanitization & Stream
    console.log('  - Testing Wire Protocol Compliance, Sanitization & SSE Stream...');
    const protoMonitor = new Monitor({
      serviceName: 'Test Service',
      openApiSpecUrl: '/openapi.json',
    });

    // Sanitization test
    const sanitizedHeaders = protoMonitor.sanitizeHeaders({
      'content-type': 'application/json',
      'authorization': 'Bearer secret-jwt-token',
      'cookie': 'session=abc',
    });
    assert.strictEqual(sanitizedHeaders['content-type'], 'application/json');
    assert.strictEqual(sanitizedHeaders['authorization'], '[REDACTED]');
    assert.strictEqual(sanitizedHeaders['cookie'], '[REDACTED]');

    const sanitizedPayload = protoMonitor.sanitizePayload({
      user: 'alice',
      password: 'mypassword123',
      nested: {
        token: 'secret-token-xyz',
        publicNote: 'hello',
      },
    });
    assert.strictEqual(sanitizedPayload.user, 'alice');
    assert.strictEqual(sanitizedPayload.password, '[REDACTED]');
    assert.strictEqual(sanitizedPayload.nested.token, '[REDACTED]');
    assert.strictEqual(sanitizedPayload.nested.publicNote, 'hello');

    // Protocol meta test
    const meta = protoMonitor.getProtocolMeta();
    assert.strictEqual(meta.protocolVersion, '0.1.0');
    assert.strictEqual(meta.serviceName, 'Test Service');
    assert.strictEqual(meta.openApiSpecUrl, '/openapi.json');
    assert.strictEqual(meta.features.openApiDrift, true);

    // Stream & canonical events test
    const receivedEvents: any[] = [];
    const unsubscribe = protoMonitor.subscribeStream((ev) => {
      receivedEvents.push(ev);
    });

    protoMonitor.recordRequest({
      path: '/api/v1/test',
      method: 'GET',
      statusCode: 200,
      durationMs: 5.2,
      ip: '127.0.0.1',
    });

    assert.ok(receivedEvents.length >= 1);
    assert.strictEqual(receivedEvents[0].type, 'request');
    assert.strictEqual(receivedEvents[0].request.path, '/api/v1/test');

    unsubscribe();

    const canonicalEvents = protoMonitor.getCanonicalEvents({ type: 'request' });
    assert.strictEqual(canonicalEvents.length, 1);
    assert.strictEqual(canonicalEvents[0].type, 'request');
    assert.strictEqual(canonicalEvents[0].response.statusCode, 200);

    console.log('  ✅ Wire Protocol Compliance, Sanitization & SSE Stream tests passed!');

    // 6. Test OpenAPI Ingestion & Contract Drift Detection
    console.log('  - Testing OpenAPI Ingestion & Contract Drift Detection...');
    const sampleOpenApi = {
      openapi: '3.0.0',
      info: { title: 'User Service', version: '1.0.0' },
      paths: {
        '/api/v1/users/{id}': {
          get: {
            summary: 'Get user by ID',
            responses: {
              '200': {
                description: 'User found',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['id', 'email'],
                      properties: {
                        id: { type: 'string' },
                        email: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const driftMonitor = new Monitor({
      openApiSpec: sampleOpenApi,
    });

    assert.strictEqual(driftMonitor.getOpenApiManager().hasSpec(), true);
    const documented = driftMonitor.getOpenApiManager().getDocumentedEndpoints();
    assert.strictEqual(documented.length, 1);
    assert.strictEqual(documented[0].path, '/api/v1/users/{id}');
    assert.strictEqual(documented[0].method, 'GET');

    // Case 1: Valid documented call
    driftMonitor.recordRequest({
      path: '/api/v1/users/100',
      method: 'GET',
      statusCode: 200,
      durationMs: 8.1,
      ip: '127.0.0.1',
    }, {
      headers: {},
      query: {},
      resBody: JSON.stringify({ id: '100', email: 'alice@example.com' }),
    });

    const requests1 = driftMonitor.getDashboardData().requests;
    const validReq = requests1[requests1.length - 1];
    assert.ok(validReq.drift);
    assert.strictEqual(validReq.drift.isDocumented, true);
    assert.strictEqual(validReq.drift.hasSchemaMismatch, false);

    // Case 2: Undocumented route
    driftMonitor.recordRequest({
      path: '/api/v1/legacy-admin',
      method: 'POST',
      statusCode: 200,
      durationMs: 4.2,
      ip: '127.0.0.1',
    });

    const requests2 = driftMonitor.getDashboardData().requests;
    const undocumentedReq = requests2[requests2.length - 1];
    assert.ok(undocumentedReq.drift);
    assert.strictEqual(undocumentedReq.drift.isDocumented, false);
    assert.strictEqual(undocumentedReq.drift.driftCategory, 'UNDOCUMENTED_ROUTE');

    // Case 3: Undocumented status code
    driftMonitor.recordRequest({
      path: '/api/v1/users/100',
      method: 'GET',
      statusCode: 500,
      durationMs: 12.0,
      ip: '127.0.0.1',
    });

    const requests3 = driftMonitor.getDashboardData().requests;
    const statusMismatchReq = requests3[requests3.length - 1];
    assert.ok(statusMismatchReq.drift);
    assert.strictEqual(statusMismatchReq.drift.isDocumented, true);
    assert.strictEqual(statusMismatchReq.drift.driftCategory, 'UNDOCUMENTED_STATUS');

    // Case 4: Schema mismatch (missing required 'email')
    driftMonitor.recordRequest({
      path: '/api/v1/users/100',
      method: 'GET',
      statusCode: 200,
      durationMs: 6.5,
      ip: '127.0.0.1',
    }, {
      headers: {},
      query: {},
      resBody: JSON.stringify({ id: '100', nickname: 'Ali' }), // missing email!
    });

    const requests4 = driftMonitor.getDashboardData().requests;
    const schemaMismatchReq = requests4[requests4.length - 1];
    assert.ok(schemaMismatchReq.drift);
    assert.strictEqual(schemaMismatchReq.drift.hasSchemaMismatch, true);
    assert.strictEqual(schemaMismatchReq.drift.driftCategory, 'SCHEMA_MISMATCH');
    assert.ok(schemaMismatchReq.drift.diff?.missingRequired?.includes('email'));

    console.log('  ✅ OpenAPI Ingestion & Contract Drift Detection tests passed!');

    console.log('\n🎉 All Pulse Monitor unit tests completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('  ❌ Tests failed:', err);
    process.exit(1);
  }
})();
