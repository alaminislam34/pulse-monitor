import express from 'express';
import { Monitor } from '../src/core/Monitor';
import { expressPulseMiddleware } from '../src/adapters/ExpressAdapter';

const app = express();
app.use(express.json());

// Initialize Pulse Monitor
const monitor = new Monitor({
  dashboardEndpoint: '/pulse',
  logBodies: true
});

// Enable Pulse Middleware
app.use(expressPulseMiddleware(monitor));

// Register some test API routes
app.get('/api/users', (req, res) => {
  res.json([
    { id: 1, name: 'Alice', role: 'Admin' },
    { id: 2, name: 'Bob', role: 'User' }
  ]);
});

app.post('/api/users', (req, res) => {
  const { name, role } = req.body;
  if (!name || !role) {
    return res.status(400).json({ error: 'Missing name or role' });
  }
  res.status(201).json({ id: 3, name, role, status: 'created' });
});

app.get('/api/users/:id', (req, res) => {
  const { id } = req.params;
  res.json({ id: Number(id), name: 'Sample User', role: 'User' });
});


app.get("/api/blogs", (req, res) => {
  res.json([
    { id: 1, title: 'Blog 1', content: 'Content 1' },
    { id: 2, title: 'Blog 2', content: 'Content 2' },
    { id: 3, title: 'Blog 3', content: 'Content 3' }
  ])
})

app.post("/api/blogs", (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'Missing title or content' });
  }
  res.status(201).json({ id: 4, title, content, status: 'created' });
})

app.get("/api/blogs/:id", (req, res) => {
  const { id } = req.params;
  res.json({ id: Number(id), title: 'Sample Blog', content: 'Sample Content' });
})

// Start the server
const port = 3000;
app.listen(port, () => {
  console.log(`🚀 Demo server running at http://localhost:${port}`);
  console.log(`📊 Pulse Dashboard available at http://localhost:${port}/pulse`);
});
