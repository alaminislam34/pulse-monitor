# ⚡ Pulse Monitor

A zero-latency-impact backend performance and security monitoring tool for both **Express.js** and **NestJS** applications. It bundles a premium, interactive real-time dashboard into a single self-contained HTML asset and auto-adapts to Serverless (Vercel, Netlify, AWS Lambda) and Stateful (Node.js daemon) runtimes.

---

## ✨ Features

- **🚀 Zero-Impact Observability:** Offloads telemetry aggregation to background Worker Threads in stateful environments.
- **🛡️ Intrusion Detection System (IDS):** Auto-inspects path traversal, SQL Injection (SQLi), Cross-Site Scripting (XSS), and malicious User-Agent signatures.
- **☁️ Serverless Native:** Automatically detects serverless execution environments and shifts from background thread queuing to zero-loss synchronous logs or database flushes.
- **🎛️ Single-File Dashboard:** React UI compiled into a single, inline HTML file (`dist/ui/index.html`) using `vite-plugin-singlefile` to completely bypass 404 static asset paths and CORS problems.
- **🔐 Stealth Mode & Security:** Configurable IP whitelists and access secrets. Hide the dashboard completely (return 404/next) for unwhitelisted clients.
- **📊 Premium Visual Analytics:** Responsive, beautiful dark-themed dashboard with real-time SVG charting, sorting, filtering, and deep request inspection.

---

## 📦 Installation

Install the package via your preferred package manager:

```bash
# npm
npm install @alaminislam34/server-monitor

# pnpm
pnpm add @alaminislam34/server-monitor

# yarn
yarn add @alaminislam34/server-monitor

# bun
bun add @alaminislam34/server-monitor
```

---

## 🚀 Quick Start

### 1. Express.js Integration

```typescript
import express from 'express';
import { Monitor, expressPulseMiddleware } from '@alaminislam34/server-monitor';

const app = express();
app.use(express.json());

// Initialize the Monitor instance
const monitor = new Monitor({
  serviceName: 'Production API',
  maxBufferSize: 1000,
  enableThreatDetection: true,
  dashboardEndpoint: '/pulse',              // Dashboard URL: http://localhost:port/pulse
  openApiSpecUrl: '/openapi.json',          // Auto-load Swagger/OpenAPI spec
  authSecret: 'your-secure-password',       // Optional password protection
});

// Register the Pulse middleware
app.use(expressPulseMiddleware(monitor));

app.get('/api/users', (req, res) => {
  res.json([{ id: 1, name: 'Alice' }]);
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
  console.log('Dashboard is available at http://localhost:3000/pulse');
});
```

---

### 2. NestJS Integration

#### Step 1: Create a global Module or Provider for the Monitor instance

```typescript
// pulse.module.ts
import { Module, Global } from '@nestjs/common';
import { Monitor } from '@alaminislam34/server-monitor';

@Global()
@Module({
  providers: [
    {
      provide: Monitor,
      useValue: new Monitor({
        serviceName: 'NestJS Service',
        maxBufferSize: 1000,
        enableThreatDetection: true,
        dashboardEndpoint: '/pulse',
        authSecret: 'secret-key',
      }),
    },
  ],
  exports: [Monitor],
})
export class PulseModule {}
```

#### Step 2: Bind the Interceptor & Middleware

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Monitor, NestJSPulseInterceptor, expressPulseMiddleware } from '@alaminislam34/server-monitor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Resolve the Monitor instance
  const monitor = app.get(Monitor);
  
  // Use Express middleware to handle dashboard routes
  app.use(expressPulseMiddleware(monitor));
  
  // Use the NestJS interceptor to capture route performance & metrics
  app.useGlobalInterceptors(new NestJSPulseInterceptor(monitor));

  await app.listen(3000);
}
bootstrap();
```

---

## ⚙️ Configuration Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `maxBufferSize` | `number` | `1000` | Limits the maximum request logs and threat alerts kept in the in-memory circular buffer. |
| `enableThreatDetection` | `boolean` | `true` | Enables/disables the real-time intrusion signature scanner. |
| `whitelistIps` | `string[]` | `[]` | List of client IPs authorized to view the dashboard. If populated, unwhitelisted IPs will be ignored (Stealth Mode). |
| `dashboardEndpoint` | `string` | `'/pulse'` | Route path where the dashboard will be served. |
| `authSecret` | `string` | `''` | Passcode required to view the dashboard. Prompts a secure login page if set. |
| `databaseUrl` | `string` | `''` | Optional database persistence endpoint (useful in serverless environments). |

---

## 🛠️ Build and Development

To build the package locally for production or npm publishing:

```bash
# 1. Install dependencies
pnpm install

# 2. Build backend and frontend assets
pnpm run build
```

This will:
1. Compile TypeScript source files using `tsup` into `dist/index.js` (ES Modules) and `dist/index.cjs` (CommonJS).
2. Install dashboard dependencies and bundle the React code into a single self-contained HTML page at `dist/ui/index.html`.

---

## 📄 License

MIT © [Pulse Monitor](https://github.com/user/pulse-monitor)
