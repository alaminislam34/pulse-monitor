"use strict";var A=Object.create;var y=Object.defineProperty;var R=Object.getOwnPropertyDescriptor;var B=Object.getOwnPropertyNames;var E=Object.getPrototypeOf,I=Object.prototype.hasOwnProperty;var M=(o,e)=>{for(var r in e)y(o,r,{get:e[r],enumerable:!0})},v=(o,e,r,i)=>{if(e&&typeof e=="object"||typeof e=="function")for(let t of B(e))!I.call(o,t)&&t!==r&&y(o,t,{get:()=>e[t],enumerable:!(i=R(e,t))||i.enumerable});return o};var S=(o,e,r)=>(r=o!=null?A(E(o)):{},v(e||!o||!o.__esModule?y(r,"default",{value:o,enumerable:!0}):r,o)),k=o=>v(y({},"__esModule",{value:!0}),o);var q={};M(q,{CircularBuffer:()=>d,Monitor:()=>m,ThreatDetector:()=>u});module.exports=k(q);var b=S(require("fs")),h=S(require("path")),l=S(require("os")),T=require("worker_threads");var d=class{buffer;capacity;head=0;tail=0;size=0;constructor(e){if(e<=0)throw new Error("Capacity must be greater than 0");this.capacity=e,this.buffer=new Array(e).fill(null)}push(e){this.buffer[this.tail]=e,this.size<this.capacity?(this.tail=(this.tail+1)%this.capacity,this.size++):(this.tail=(this.tail+1)%this.capacity,this.head=(this.head+1)%this.capacity)}toArray(){let e=[],r=this.head;for(let i=0;i<this.size;i++){let t=this.buffer[r];t!==null&&e.push(t),r=(r+1)%this.capacity}return e}getSize(){return this.size}getCapacity(){return this.capacity}clear(){this.buffer.fill(null),this.head=0,this.tail=0,this.size=0}};var u=class o{static SQL_INJECTION_REGEX=/(\b(union\s+select|select\s+.*\s+from|insert\s+into|update\s+.*\s+set|delete\s+from|drop\s+table)\b|--|\/\*|\*\/|'\s*(or|and)\s+\d+\s*=\s*\d+|"\s*(or|and)\s+\d+\s*=\s*\d+)/i;static XSS_REGEX=/(<script|javascript:|onload|onerror|onclick|alert\(|<img\s+src)/i;static PATH_TRAVERSAL_REGEX=/(\.\.\/|\.\.\\|etc\/passwd|boot\.ini|win\.ini)/i;static SUSPICIOUS_USER_AGENTS=/(sqlmap|nikto|dirbuster|nmap|hydra|acunetix|w3af)/i;constructor(){}detectThreat(e){let{ip:r,path:i,method:t,headers:s,query:a,body:n}=e;if(o.PATH_TRAVERSAL_REGEX.test(i))return this.createAlert(r,i,t,"Path Traversal","HIGH",`Suspicious path traversal pattern in URL: ${i}`);if(o.SQL_INJECTION_REGEX.test(i))return this.createAlert(r,i,t,"SQL Injection","HIGH",`SQL injection signature detected in URL path: ${i}`);if(o.XSS_REGEX.test(i))return this.createAlert(r,i,t,"XSS","HIGH",`XSS signature detected in URL path: ${i}`);for(let[c,g]of Object.entries(a)){let p=typeof g=="string"?g:JSON.stringify(g);if(o.SQL_INJECTION_REGEX.test(p))return this.createAlert(r,i,t,"SQL Injection","HIGH",`SQL injection signature detected in query param '${c}': ${p}`);if(o.XSS_REGEX.test(p))return this.createAlert(r,i,t,"XSS","HIGH",`XSS signature detected in query param '${c}': ${p}`);if(o.PATH_TRAVERSAL_REGEX.test(p))return this.createAlert(r,i,t,"Path Traversal","HIGH",`Path traversal signature detected in query param '${c}': ${p}`)}let f=s["user-agent"];if(f&&typeof f=="string"&&o.SUSPICIOUS_USER_AGENTS.test(f))return this.createAlert(r,i,t,"Vulnerability Scanner","MEDIUM",`Suspicious User-Agent detected: ${f}`);if(n){let c=typeof n=="string"?n:JSON.stringify(n);if(o.SQL_INJECTION_REGEX.test(c))return this.createAlert(r,i,t,"SQL Injection","CRITICAL","SQL injection signature detected in request body");if(o.XSS_REGEX.test(c))return this.createAlert(r,i,t,"XSS","CRITICAL","XSS signature detected in request body");if(o.PATH_TRAVERSAL_REGEX.test(c))return this.createAlert(r,i,t,"Path Traversal","CRITICAL","Path traversal signature detected in request body")}return null}createAlert(e,r,i,t,s,a){return{timestamp:Date.now(),ip:e,path:r,method:i,attackType:t,severity:s,details:a}}};var m=class{config;metricsBuffer;securityBuffer;threatDetector;isServerless;worker=null;startTime;eventLoopLag=0;lastEventLoopTime=Date.now();discoveredRoutes=[];streamSubscribers=new Set;constructor(e={}){this.startTime=Date.now(),this.config={maxBufferSize:e.maxBufferSize??1e3,enableThreatDetection:e.enableThreatDetection??!0,databaseUrl:e.databaseUrl??"",whitelistIps:e.whitelistIps??[],dashboardEndpoint:e.dashboardEndpoint??"/pulse",authSecret:e.authSecret??"",logBodies:e.logBodies??!0,maxBodySizeKb:e.maxBodySizeKb??64,serviceName:e.serviceName??"Pulse API Service",openApiSpecUrl:e.openApiSpecUrl??""},this.metricsBuffer=new d(this.config.maxBufferSize),this.securityBuffer=new d(this.config.maxBufferSize),this.threatDetector=new u,this.isServerless=!!(process.env.VERCEL||process.env.NETLIFY||process.env.LAMBDA_TASK_ROOT||process.env.FUNCTIONS_SIGNATURE),this.isServerless?console.log("\u2139\uFE0F [PulseMonitor] Serverless environment detected. Processing logs synchronously."):(this.initWorker(),this.startEventLoopMonitoring())}initWorker(){let e=`
      const { parentPort } = require('worker_threads');

      function inferJsonType(obj) {
        if (obj === null || obj === undefined) return 'null';
        if (typeof obj !== 'object') return typeof obj;
        if (Array.isArray(obj)) {
          if (obj.length === 0) return 'any[]';
          return inferJsonType(obj[0]) + '[]';
        }
        const keys = Object.keys(obj);
        if (keys.length > 50) return '{ [key: string]: any }';
        const fields = keys.map(key => {
          const cleanKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
          return cleanKey + ': ' + inferJsonType(obj[key]);
        });
        return '{ ' + fields.join('; ') + ' }';
      }

      parentPort.on('message', (msg) => {
        try {
          if (msg.type === 'record') {
            const { payload, reqBody, resBody } = msg;
            
            let inferredReqType = 'any';
            let inferredResType = 'any';

            if (reqBody) {
              try {
                const parsed = typeof reqBody === 'string' ? JSON.parse(reqBody) : reqBody;
                inferredReqType = inferJsonType(parsed);
              } catch (e) {}
            }

            if (resBody) {
              try {
                const parsed = typeof resBody === 'string' ? JSON.parse(resBody) : resBody;
                inferredResType = inferJsonType(parsed);
              } catch (e) {}
            }

            parentPort.postMessage({
              type: 'processed',
              timestamp: payload.timestamp,
              inferredReqType,
              inferredResType,
              reqBody: typeof reqBody === 'object' ? JSON.stringify(reqBody) : reqBody,
              resBody: typeof resBody === 'object' ? JSON.stringify(resBody) : resBody
            });
          }
        } catch (err) {
          console.error('[PulseMonitor Worker Error]:', err);
        }
      });
    `;try{this.worker=new T.Worker(e,{eval:!0}),this.worker.on("message",r=>{r.type==="processed"&&this.updateRecordWithInferredTypes(r)}),this.worker.unref()}catch(r){console.error("\u26A0\uFE0F [PulseMonitor] Failed to initialize worker thread, falling back to synchronous processing.",r),this.worker=null}}updateRecordWithInferredTypes(e){let i=this.metricsBuffer.toArray().find(t=>t.timestamp===e.timestamp);if(i&&(i.inferredReqType=e.inferredReqType,i.inferredResType=e.inferredResType,this.config.logBodies)){let t=this.config.maxBodySizeKb*1024;e.reqBody&&(i.reqBody=e.reqBody.substring(0,t)),e.resBody&&(i.resBody=e.resBody.substring(0,t))}}inferTypeSync(e){if(e==null)return"null";if(typeof e!="object")return typeof e;if(Array.isArray(e))return e.length===0?"any[]":`${this.inferTypeSync(e[0])}[]`;let r=Object.keys(e);return r.length>50?"{ [key: string]: any }":`{ ${r.map(t=>`${/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(t)?t:JSON.stringify(t)}: ${this.inferTypeSync(e[t])}`).join("; ")} }`}sanitizeHeaders(e={}){let r=["authorization","cookie","set-cookie","x-api-key","jwt","token"],i={};for(let[t,s]of Object.entries(e))r.includes(t.toLowerCase())?i[t]="[REDACTED]":i[t]=s;return i}sanitizePayload(e){if(!e)return e;if(typeof e=="string")try{let t=JSON.parse(e);return JSON.stringify(this.sanitizePayload(t))}catch{return e}if(typeof e!="object")return e;if(Array.isArray(e))return e.map(t=>this.sanitizePayload(t));let r=["password","passwd","secret","credit_card","cvv","token","ssn","apikey","api_key"],i={};for(let[t,s]of Object.entries(e))r.some(a=>t.toLowerCase().includes(a))?i[t]="[REDACTED]":i[t]=this.sanitizePayload(s);return i}subscribeStream(e){return this.streamSubscribers.add(e),()=>{this.streamSubscribers.delete(e)}}broadcastEvent(e){for(let r of this.streamSubscribers)try{r(e)}catch{this.streamSubscribers.delete(r)}}recordRequest(e,r){let i=Date.now(),t={...e,timestamp:i};if(this.config.enableThreatDetection&&r){let s=this.threatDetector.detectThreat({ip:t.ip,path:t.path,method:t.method,headers:r.headers,query:r.query,body:r.body});s&&(this.securityBuffer.push(s),console.warn(`\u26A0\uFE0F [PulseMonitor Security Alert] ${s.attackType} from ${s.ip} on ${s.method} ${s.path} (Severity: ${s.severity})`),this.broadcastEvent({id:`thr_${Date.now()}_${Math.random().toString(36).substring(2,6)}`,type:"threat",timestamp:s.timestamp,threatType:s.attackType,severity:s.severity,targetField:"request",matchedPattern:s.details,clientIp:s.ip,userAgent:r.headers?.["user-agent"]}))}if(this.metricsBuffer.push(t),this.broadcastEvent({id:`req_${t.timestamp}_${Math.random().toString(36).substring(2,6)}`,type:"request",timestamp:t.timestamp,request:{method:t.method,path:t.path,ip:t.ip,userAgent:t.userAgent},response:{statusCode:t.statusCode,durationMs:t.durationMs}}),this.isServerless){if(r&&this.config.logBodies)try{let s=this.config.maxBodySizeKb*1024,a=typeof r.body=="object"?JSON.stringify(r.body):String(r.body||""),n=r.resBody||"";t.inferredReqType=this.inferTypeSync(r.body),t.inferredResType=n?this.inferTypeSync(JSON.parse(n)):"any",t.reqBody=a.substring(0,s),t.resBody=n.substring(0,s)}catch{t.inferredResType="any"}this.saveSynchronously(t)}else this.worker&&this.worker.postMessage({type:"record",payload:t,reqBody:r?.body,resBody:r?.resBody})}saveSynchronously(e){this.config.databaseUrl||console.log(`[PulseMonitor Metrics]: ${JSON.stringify(e)}`)}registerDiscoveredRoutes(e){let r=this.config.dashboardEndpoint;this.discoveredRoutes=e.filter((i,t,s)=>!i.path.startsWith(r)&&t===s.findIndex(a=>a.path===i.path&&a.method===i.method))}getSystemMetrics(){let e=process.memoryUsage(),r=Math.floor((Date.now()-this.startTime)/1e3),i=process.cpuUsage(),t=l.default.loadavg(),s=l.default.totalmem(),a=l.default.freemem();return{memory:{rss:Math.round(e.rss/(1024*1024)*100)/100,heapUsed:Math.round(e.heapUsed/(1024*1024)*100)/100,heapTotal:Math.round(e.heapTotal/(1024*1024)*100)/100,systemTotal:Math.round(s/(1024*1024)*100)/100,systemFree:Math.round(a/(1024*1024)*100)/100},uptime:r,cpuUsage:i,cpuCount:l.default.cpus().length,loadAvg:[Math.round(t[0]*100)/100,Math.round(t[1]*100)/100,Math.round(t[2]*100)/100],nodeVersion:process.version,platform:process.platform,pid:process.pid,eventLoopLag:Math.round(this.eventLoopLag*100)/100}}startEventLoopMonitoring(){if(this.isServerless)return;let e=()=>{let r=Date.now();this.eventLoopLag=Math.max(0,r-this.lastEventLoopTime-1e3),this.lastEventLoopTime=r,setTimeout(e,1e3).unref()};setTimeout(e,1e3).unref()}getDashboardData(){return{system:this.getSystemMetrics(),requests:this.metricsBuffer.toArray(),threats:this.securityBuffer.toArray(),discoveredRoutes:this.discoveredRoutes,config:{enableThreatDetection:this.config.enableThreatDetection,maxBufferSize:this.config.maxBufferSize,isServerless:this.isServerless,dashboardEndpoint:this.config.dashboardEndpoint,hasAuth:!!this.config.authSecret,logBodies:this.config.logBodies,serviceName:this.config.serviceName,openApiSpecUrl:this.config.openApiSpecUrl}}}getProtocolMeta(){return{protocolVersion:"0.1.0",runtime:{language:"node",framework:"express",version:process.version},serviceName:this.config.serviceName,bufferSize:this.config.maxBufferSize,features:{threatDetection:this.config.enableThreatDetection,openApiDrift:!!this.config.openApiSpecUrl,payloadInspection:this.config.logBodies},openApiSpecUrl:this.config.openApiSpecUrl||void 0}}getCanonicalEvents(e={}){let r=e.limit?Math.min(Number(e.limit),1e3):100,i=e.since?Number(e.since):0,t=e.type||"all",s=[];if(t==="all"||t==="request"){let a=this.metricsBuffer.toArray().filter(n=>n.timestamp>=i).map(n=>({id:`req_${n.timestamp}_${Math.random().toString(36).substring(2,7)}`,type:"request",timestamp:n.timestamp,request:{method:n.method,path:n.path,ip:n.ip,userAgent:n.userAgent,body:n.reqBody,inferredSchema:n.inferredReqType},response:{statusCode:n.statusCode,durationMs:n.durationMs,body:n.resBody,inferredSchema:n.inferredResType}}));s.push(...a)}if(t==="all"||t==="threat"){let a=this.securityBuffer.toArray().filter(n=>n.timestamp>=i).map(n=>({id:`thr_${n.timestamp}_${Math.random().toString(36).substring(2,7)}`,type:"threat",timestamp:n.timestamp,threatType:n.attackType,severity:n.severity,targetField:"request",matchedPattern:n.details,clientIp:n.ip}));s.push(...a)}return s.sort((a,n)=>n.timestamp-a.timestamp),s.slice(0,r)}isIpAllowed(e){return this.config.whitelistIps.length===0?!0:this.config.whitelistIps.includes(e)}validateAuth(e){return this.config.authSecret?this.config.authSecret===e:!0}getDashboardHtml(){let e=[h.default.join(__dirname,"ui","index.html"),h.default.join(__dirname,"../ui","index.html"),h.default.join(__dirname,"../dist/ui","index.html"),h.default.join(process.cwd(),"dist","ui","index.html")],r=`<script>window.__PULSE_CONFIG__ = ${JSON.stringify({apiPrefix:`${this.config.dashboardEndpoint}/api`,streamPrefix:`${this.config.dashboardEndpoint}/api/stream`,openApiUrl:this.config.openApiSpecUrl||void 0,serviceName:this.config.serviceName})};</script>`;for(let i of e)if(b.default.existsSync(i)){let t=b.default.readFileSync(i,"utf8");return t.includes("</head>")?t.replace("</head>",`${r}</head>`):`${r}${t}`}return`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Pulse Monitor - Error</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; color: #f3f4f6; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #111827; border: 1px solid #1f2937; padding: 2rem; border-radius: 12px; max-width: 500px; text-align: center; }
            h1 { color: #f87171; margin-top: 0; }
            p { color: #9ca3af; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Dashboard UI Asset Not Found</h1>
            <p>The dashboard static assets (index.html) could not be located. Please make sure that you built the UI before starting the application (e.g., run <code>npm run build</code>).</p>
          </div>
        </body>
      </html>
    `}};0&&(module.exports={CircularBuffer,Monitor,ThreatDetector});
//# sourceMappingURL=index.js.map