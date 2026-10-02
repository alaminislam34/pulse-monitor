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
        description: 'Retrieves complete billing and fulfillment details for an order identifier.',
        tags: ['Orders'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Unique order identifier (e.g. ord_101)',
            schema: { type: 'string' }
          },
          {
            name: 'expand',
            in: 'query',
            required: false,
            description: 'Optional fields to expand (e.g. customer,charges)',
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Order found and returned successfully',
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
    '/api/orders': {
      post: {
        summary: 'Create a new customer order',
        description: 'Initiates a new payment authorization and creates an order entity.',
        tags: ['Orders'],
        requestBody: {
          description: 'Order creation payload',
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['customerId', 'items', 'currency'],
                properties: {
                  customerId: { type: 'string', description: 'Customer identifier (e.g. cus_8923)' },
                  items: { type: 'array', description: 'Array of item SKU identifiers' },
                  currency: { type: 'string', description: 'ISO 3-letter currency code (e.g. usd)' },
                  metadata: { type: 'object', description: 'Custom key-value metadata tags' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Order created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['orderId', 'status', 'created'],
                  properties: {
                    orderId: { type: 'string' },
                    status: { type: 'string' },
                    created: { type: 'number' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/customers/{customerId}': {
      get: {
        summary: 'Retrieve customer account',
        description: 'Returns customer profile details, default payment method, and billing balance.',
        tags: ['Customers'],
        parameters: [
          {
            name: 'customerId',
            in: 'path',
            required: true,
            description: 'Customer ID (e.g. cus_901)',
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Customer record retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['customerId', 'email', 'tier'],
                  properties: {
                    customerId: { type: 'string' },
                    email: { type: 'string' },
                    tier: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/system/health': {
      get: {
        summary: 'Service health check',
        description: 'Returns real-time status of service dependencies and node runtime.',
        tags: ['System'],
        responses: {
          '200': {
            description: 'Service operational',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status', 'uptime'],
                  properties: {
                    status: { type: 'string' },
                    uptime: { type: 'number' }
                  }
                }
              }
            }
          }
        }
      }
    }
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

// Route 1b: Parameterized endpoint handler
app.get('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  if (id === 'ord_broken') {
    return res.json({
      orderId: 'ord_broken',
      totalAmount: 99.0,
      legacyDiscount: 15.0, // Undocumented drift!
    });
  }
  res.json({
    orderId: id,
    totalAmount: 220.50,
    status: 'COMPLETED'
  });
});

// Route 2: Create Order POST endpoint
app.post('/api/orders', (req, res) => {
  const { customerId = 'cus_test', currency = 'USD' } = req.body || {};
  res.status(201).json({
    orderId: `ord_${Math.floor(1000 + Math.random() * 9000)}`,
    status: 'CREATED',
    currency,
    customerId,
    created: Date.now()
  });
});

// Route 3: Customer profile endpoint
app.get('/api/customers/:customerId', (req, res) => {
  res.json({
    customerId: req.params.customerId,
    email: 'alex.morgan@example.com',
    tier: 'ENTERPRISE'
  });
});

// Route 4: System health endpoint
app.get('/api/system/health', (req, res) => {
  res.json({
    status: 'UP',
    uptime: Math.floor(process.uptime())
  });
});

// Route 5: Undocumented Route (Not declared in OpenAPI spec at all)
app.get('/api/legacy/export', (req, res) => {
  res.json({ message: 'This route is not in OpenAPI spec!' });
});

// Route 6: Undocumented Status Code (Returns 500 which is not in responses spec)
app.get('/api/orders/ord_error', (req, res) => {
  res.status(500).json({ error: 'Internal failure' });
});

app.listen(port, () => {
  console.log(`\n⚡ OpenAPI Drift Demo running at http://localhost:${port}`);
  console.log(`📊 Pulse Dashboard: http://localhost:${port}/pulse`);
  console.log(`📖 OpenAPI Spec: http://localhost:${port}/openapi.json\n`);
});
