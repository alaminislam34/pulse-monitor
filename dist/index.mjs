import"./chunk-L4L36JCS.mjs";import m from"fs";import l from"path";import f from"os";import{Worker as b}from"worker_threads";var u=class{buffer;capacity;head=0;tail=0;size=0;constructor(e){if(e<=0)throw new Error("Capacity must be greater than 0");this.capacity=e,this.buffer=new Array(e).fill(null)}push(e){this.buffer[this.tail]=e,this.size<this.capacity?(this.tail=(this.tail+1)%this.capacity,this.size++):(this.tail=(this.tail+1)%this.capacity,this.head=(this.head+1)%this.capacity)}toArray(){let e=[],t=this.head;for(let i=0;i<this.size;i++){let r=this.buffer[t];r!==null&&e.push(r),t=(t+1)%this.capacity}return e}getSize(){return this.size}getCapacity(){return this.capacity}clear(){this.buffer.fill(null),this.head=0,this.tail=0,this.size=0}};var p=class n{static SQL_INJECTION_REGEX=/(\b(union\s+select|select\s+.*\s+from|insert\s+into|update\s+.*\s+set|delete\s+from|drop\s+table)\b|--|\/\*|\*\/|'\s*(or|and)\s+\d+\s*=\s*\d+|"\s*(or|and)\s+\d+\s*=\s*\d+)/i;static XSS_REGEX=/(<script|javascript:|onload|onerror|onclick|alert\(|<img\s+src)/i;static PATH_TRAVERSAL_REGEX=/(\.\.\/|\.\.\\|etc\/passwd|boot\.ini|win\.ini)/i;static SUSPICIOUS_USER_AGENTS=/(sqlmap|nikto|dirbuster|nmap|hydra|acunetix|w3af)/i;constructor(){}detectThreat(e){let{ip:t,path:i,method:r,headers:s,query:o,body:a}=e;if(n.PATH_TRAVERSAL_REGEX.test(i))return this.createAlert(t,i,r,"Path Traversal","HIGH",`Suspicious path traversal pattern in URL: ${i}`);if(n.SQL_INJECTION_REGEX.test(i))return this.createAlert(t,i,r,"SQL Injection","HIGH",`SQL injection signature detected in URL path: ${i}`);if(n.XSS_REGEX.test(i))return this.createAlert(t,i,r,"XSS","HIGH",`XSS signature detected in URL path: ${i}`);for(let[c,y]of Object.entries(o)){let d=typeof y=="string"?y:JSON.stringify(y);if(n.SQL_INJECTION_REGEX.test(d))return this.createAlert(t,i,r,"SQL Injection","HIGH",`SQL injection signature detected in query param '${c}': ${d}`);if(n.XSS_REGEX.test(d))return this.createAlert(t,i,r,"XSS","HIGH",`XSS signature detected in query param '${c}': ${d}`);if(n.PATH_TRAVERSAL_REGEX.test(d))return this.createAlert(t,i,r,"Path Traversal","HIGH",`Path traversal signature detected in query param '${c}': ${d}`)}let h=s["user-agent"];if(h&&typeof h=="string"&&n.SUSPICIOUS_USER_AGENTS.test(h))return this.createAlert(t,i,r,"Vulnerability Scanner","MEDIUM",`Suspicious User-Agent detected: ${h}`);if(a){let c=typeof a=="string"?a:JSON.stringify(a);if(n.SQL_INJECTION_REGEX.test(c))return this.createAlert(t,i,r,"SQL Injection","CRITICAL","SQL injection signature detected in request body");if(n.XSS_REGEX.test(c))return this.createAlert(t,i,r,"XSS","CRITICAL","XSS signature detected in request body");if(n.PATH_TRAVERSAL_REGEX.test(c))return this.createAlert(t,i,r,"Path Traversal","CRITICAL","Path traversal signature detected in request body")}return null}createAlert(e,t,i,r,s,o){return{timestamp:Date.now(),ip:e,path:t,method:i,attackType:r,severity:s,details:o}}};var g=class{config;metricsBuffer;securityBuffer;threatDetector;isServerless;worker=null;startTime;eventLoopLag=0;lastEventLoopTime=Date.now();discoveredRoutes=[];hasScannedRoutes=!1;constructor(e={}){this.startTime=Date.now(),this.config={maxBufferSize:e.maxBufferSize??1e3,enableThreatDetection:e.enableThreatDetection??!0,databaseUrl:e.databaseUrl??"",whitelistIps:e.whitelistIps??[],dashboardEndpoint:e.dashboardEndpoint??"/pulse",authSecret:e.authSecret??"",logBodies:e.logBodies??!1,maxBodySizeKb:e.maxBodySizeKb??64},this.metricsBuffer=new u(this.config.maxBufferSize),this.securityBuffer=new u(this.config.maxBufferSize),this.threatDetector=new p,this.isServerless=!!(process.env.VERCEL||process.env.NETLIFY||process.env.LAMBDA_TASK_ROOT||process.env.FUNCTIONS_SIGNATURE),this.isServerless?console.log("\u2139\uFE0F [PulseMonitor] Serverless environment detected. Processing logs synchronously."):(this.initWorker(),this.startEventLoopMonitoring())}initWorker(){let e=`
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
    `;try{this.worker=new b(e,{eval:!0}),this.worker.on("message",t=>{t.type==="processed"&&this.updateRecordWithInferredTypes(t)}),this.worker.unref()}catch(t){console.error("\u26A0\uFE0F [PulseMonitor] Failed to initialize worker thread, falling back to synchronous processing.",t),this.worker=null}}updateRecordWithInferredTypes(e){let i=this.metricsBuffer.toArray().find(r=>r.timestamp===e.timestamp);if(i&&(i.inferredReqType=e.inferredReqType,i.inferredResType=e.inferredResType,this.config.logBodies)){let r=this.config.maxBodySizeKb*1024;e.reqBody&&(i.reqBody=e.reqBody.substring(0,r)),e.resBody&&(i.resBody=e.resBody.substring(0,r))}}inferTypeSync(e){if(e==null)return"null";if(typeof e!="object")return typeof e;if(Array.isArray(e))return e.length===0?"any[]":`${this.inferTypeSync(e[0])}[]`;let t=Object.keys(e);return t.length>50?"{ [key: string]: any }":`{ ${t.map(r=>`${/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(r)?r:JSON.stringify(r)}: ${this.inferTypeSync(e[r])}`).join("; ")} }`}recordRequest(e,t){let i=Date.now(),r={...e,timestamp:i};if(this.config.enableThreatDetection&&t){let s=this.threatDetector.detectThreat({ip:r.ip,path:r.path,method:r.method,headers:t.headers,query:t.query,body:t.body});s&&(this.securityBuffer.push(s),console.warn(`\u26A0\uFE0F [PulseMonitor Security Alert] ${s.attackType} from ${s.ip} on ${s.method} ${s.path} (Severity: ${s.severity})`))}if(this.metricsBuffer.push(r),this.isServerless){if(t&&this.config.logBodies)try{let s=this.config.maxBodySizeKb*1024,o=typeof t.body=="object"?JSON.stringify(t.body):String(t.body||""),a=t.resBody||"";r.inferredReqType=this.inferTypeSync(t.body),r.inferredResType=a?this.inferTypeSync(JSON.parse(a)):"any",r.reqBody=o.substring(0,s),r.resBody=a.substring(0,s)}catch{r.inferredResType="any"}this.saveSynchronously(r)}else this.worker&&this.worker.postMessage({type:"record",payload:r,reqBody:t?.body,resBody:t?.resBody})}saveSynchronously(e){this.config.databaseUrl||console.log(`[PulseMonitor Metrics]: ${JSON.stringify(e)}`)}registerDiscoveredRoutes(e){let t=this.config.dashboardEndpoint;this.discoveredRoutes=e.filter((i,r,s)=>!i.path.startsWith(t)&&r===s.findIndex(o=>o.path===i.path&&o.method===i.method))}getSystemMetrics(){let e=process.memoryUsage(),t=Math.floor((Date.now()-this.startTime)/1e3),i=process.cpuUsage(),r=f.loadavg(),s=f.totalmem(),o=f.freemem();return{memory:{rss:Math.round(e.rss/(1024*1024)*100)/100,heapUsed:Math.round(e.heapUsed/(1024*1024)*100)/100,heapTotal:Math.round(e.heapTotal/(1024*1024)*100)/100,systemTotal:Math.round(s/(1024*1024)*100)/100,systemFree:Math.round(o/(1024*1024)*100)/100},uptime:t,cpuUsage:i,cpuCount:f.cpus().length,loadAvg:[Math.round(r[0]*100)/100,Math.round(r[1]*100)/100,Math.round(r[2]*100)/100],nodeVersion:process.version,platform:process.platform,pid:process.pid,eventLoopLag:Math.round(this.eventLoopLag*100)/100}}startEventLoopMonitoring(){if(this.isServerless)return;let e=()=>{let t=Date.now();this.eventLoopLag=Math.max(0,t-this.lastEventLoopTime-1e3),this.lastEventLoopTime=t,setTimeout(e,1e3).unref()};setTimeout(e,1e3).unref()}getDashboardData(){return{system:this.getSystemMetrics(),requests:this.metricsBuffer.toArray(),threats:this.securityBuffer.toArray(),discoveredRoutes:this.discoveredRoutes,config:{enableThreatDetection:this.config.enableThreatDetection,maxBufferSize:this.config.maxBufferSize,isServerless:this.isServerless,dashboardEndpoint:this.config.dashboardEndpoint,hasAuth:!!this.config.authSecret,logBodies:this.config.logBodies}}}isIpAllowed(e){return this.config.whitelistIps.length===0?!0:this.config.whitelistIps.includes(e)}validateAuth(e){return this.config.authSecret?this.config.authSecret===e:!0}getDashboardHtml(){let e=[l.join(__dirname,"ui","index.html"),l.join(__dirname,"../ui","index.html"),l.join(__dirname,"../dist/ui","index.html"),l.join(process.cwd(),"dist","ui","index.html")];for(let t of e)if(m.existsSync(t))return m.readFileSync(t,"utf8");return`
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
    `}};export{u as CircularBuffer,g as Monitor,p as ThreatDetector};
//# sourceMappingURL=index.mjs.map