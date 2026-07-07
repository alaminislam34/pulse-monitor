import express from 'express';
import { Monitor, expressPulseMiddleware } from '../src/index';

const app = express();
const port = 3000;

// Enable body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 1. Initialize Pulse Monitor
const monitor = new Monitor({
  maxBufferSize: 500,
  enableThreatDetection: true,
  dashboardEndpoint: '/pulse',
  authSecret: 'admin123', // Admin secret for dashboard auth
});

// 2. Register Middleware
app.use(expressPulseMiddleware(monitor));

// 3. Regular routes
app.get('/', (req, res) => {
  res.send('⚡ Pulse Monitor Demo Server is running! Visit /pulse to open the dashboard.');
});

app.get('/api/users', (req, res) => {
  const users = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ];
  res.json(users);
});

app.post('/api/feedback', (req, res) => {
  res.status(201).json({ message: 'Feedback received!', data: req.body });
});

// 4. Simulate a slower route (random latency)
app.get('/api/slow', async (req, res) => {
  const delay = Math.floor(Math.random() * 800) + 100;
  await new Promise(resolve => setTimeout(resolve, delay));
  res.json({ status: 'done', latencyMs: delay });
});

// 5. Error simulation route
app.get('/api/error', (req, res) => {
  res.status(500).json({ error: 'Database connection failed simulation!' });
});

// Start server
app.listen(port, () => {
  console.log(`\n🚀 Express Demo running at http://localhost:${port}`);
  console.log(`📊 Pulse Dashboard available at http://localhost:${port}/pulse`);
  console.log(`🔑 Auth Secret is: admin123\n`);
});
