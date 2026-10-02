import express from 'express';
import { Monitor, expressPulseMiddleware } from '../src/index';

const app = express();
const port = 3001;

app.use(express.json());

// Sample OpenAPI 3.0 contract definition
const openApiContract = {
  openapi: '3.0.0',
  info: {
    title: 'Customer Orders API',
    version: '1.0.0',
    description: 'API demonstrating Pulse Monitor live contract drift detection',
  },
  paths: {
    '/api/orders/{id}': {
      get: {
        summary: 'Fetch order by ID',
        responses: {
          '200': {
            description: 'Order found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['orderId', 'totalAmount', 'status'],
                  properties: {
                    orderId: { type: 'string' },
                    totalAmount: { type: 'number' },
                    status: { type: 'string' },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Order not found',
          },
        },
      },
    },
  },
};

// 1. Initialize Pulse Monitor with OpenAPI contract
const monitor = new Monitor({
  serviceName: 'Orders Microservice',
  openApiSpecUrl: '/openapi.json',
  openApiSpec: openApiContract,
  enableThreatDetection: true,
  dashboardEndpoint: '/pulse',
});

// 2. Register Middleware
app.use(expressPulseMiddleware(monitor));

// Expose OpenAPI spec
app.get('/openapi.json', (req, res) => {
  res.json(openApiContract);
});

// Route 1: Conforms perfectly to OpenAPI contract (Verified ✓)
app.get('/api/orders/ord_101', (req, res) => {
  res.json({
    orderId: 'ord_101',
    totalAmount: 149.99,
    status: 'PAID',
  });
});

// Route 2: Schema Drift! (Missing required field 'status', has undocumented 'legacyDiscount')
app.get('/api/orders/ord_broken', (req, res) => {
  res.json({
    orderId: 'ord_broken',
    totalAmount: 99.0,
    legacyDiscount: 15.0, // Undocumented!
    // status is missing!
  });
});

// Route 3: Undocumented Route (Not declared in OpenAPI spec at all)
app.get('/api/legacy/export', (req, res) => {
  res.json({ message: 'This route is not in OpenAPI spec!' });
});

// Route 4: Undocumented Status Code (Returns 500 which is not in responses spec)
app.get('/api/orders/ord_error', (req, res) => {
  res.status(500).json({ error: 'Internal failure' });
});

app.listen(port, () => {
  console.log(`\n⚡ OpenAPI Drift Demo running at http://localhost:${port}`);
  console.log(`📊 Pulse Dashboard: http://localhost:${port}/pulse`);
  console.log(`📖 OpenAPI Spec: http://localhost:${port}/openapi.json\n`);
});
