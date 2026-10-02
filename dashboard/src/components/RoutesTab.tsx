import { useState, useMemo } from 'react';
import { 
  Play, 
  Search, 
  Layers, 
  CheckCircle, 
  ChevronDown, 
  ChevronRight, 
  Lock, 
  ShieldAlert, 
  AlertTriangle, 
  Copy, 
  Check, 
  Activity, 
  Maximize2,
  Minimize2,
  RefreshCw
} from 'lucide-react';
import { DiscoveredEndpoint, RequestMetrics, SecurityAlert } from '../types';
import { DEFAULT_SWAGGER_CATALOG, RISE_OPENAPI_METADATA } from './defaultCatalog';

interface RoutesTabProps {
  discoveredRoutes?: Array<{ path: string; method: string }>;
  documentedRoutes?: DiscoveredEndpoint[];
  hasOpenApiSpec?: boolean;
  requests?: RequestMetrics[];
  threats?: SecurityAlert[];
  onInspectEndpoint: (endpoint: DiscoveredEndpoint) => void;
  authSecret?: string;
  onRefreshData?: () => void;
}

export function RoutesTab({
  discoveredRoutes = [],
  documentedRoutes = [],
  hasOpenApiSpec = false,
  requests = [],
  threats = [],
  onInspectEndpoint: _onInspectEndpoint,
  authSecret = '',
  onRefreshData
}: RoutesTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [tagFilter, setTagFilter] = useState<string>('ALL');
  const [onlyTraffic, setOnlyTraffic] = useState<boolean>(false);
  const [onlyDrift, setOnlyDrift] = useState<boolean>(false);
  const [selectedServer, setSelectedServer] = useState<string>(RISE_OPENAPI_METADATA.servers[0]);

  // Collapsed / Expanded tags tracking
  const [collapsedTags, setCollapsedTags] = useState<Record<string, boolean>>({});

  // Inline expanded endpoints tracking
  const [expandedEndpoints, setExpandedEndpoints] = useState<Record<string, boolean>>({});

  // Inline runner execution states per endpoint key
  const [executingKeys, setExecutingKeys] = useState<Record<string, boolean>>({});
  const [executionResponses, setExecutionResponses] = useState<Record<string, {
    status: number;
    statusText: string;
    durationMs: number;
    sizeKb: number;
    headers: Record<string, string>;
    body: string;
    driftStatus?: 'VERIFIED' | 'DRIFT' | 'UNDOCUMENTED';
    driftNotes?: string;
  }>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Parameter & Body state per endpoint key
  const [endpointParamValues, setEndpointParamValues] = useState<Record<string, Record<string, string>>>({});
  const [endpointBodyValues, setEndpointBodyValues] = useState<Record<string, string>>({});

  // Active subtab inside expanded endpoint: 'runner' | 'params' | 'responses' | 'drift'
  const [expandedSubTabs, setExpandedSubTabs] = useState<Record<string, 'runner' | 'params' | 'responses' | 'drift'>>({});

  // Combine documented routes with default rich catalog & auto-discovered routes
  const allEndpoints: DiscoveredEndpoint[] = useMemo(() => {
    const map = new Map<string, DiscoveredEndpoint>();

    // 1. If backend provided documented routes via OpenAPI, use them
    if (documentedRoutes && documentedRoutes.length > 0) {
      documentedRoutes.forEach(doc => {
        const key = `${doc.method.toUpperCase()} ${doc.path}`;
        map.set(key, { ...doc });
      });
    }

    // 2. Also populate the rich Swagger catalog from defaultCatalog
    DEFAULT_SWAGGER_CATALOG.forEach(catalogItem => {
      const key = `${catalogItem.method.toUpperCase()} ${catalogItem.path}`;
      if (!map.has(key)) {
        map.set(key, { ...catalogItem });
      }
    });

    // 3. Add any runtime auto-discovered backend routes (Express / NestJS)
    discoveredRoutes.forEach(disc => {
      const key = `${disc.method.toUpperCase()} ${disc.path}`;
      if (!map.has(key)) {
        const cleanTag = disc.path.split('/')[2] 
          ? capitalize(disc.path.split('/')[2].replace(/[^a-zA-Z0-9]/g, ''))
          : 'General';

        map.set(key, {
          path: disc.path,
          method: disc.method.toUpperCase(),
          summary: `${disc.method.toUpperCase()} ${disc.path}`,
          description: 'Live auto-discovered backend route from Express/NestJS router hierarchy.',
          tags: [cleanTag || 'General'],
        });
      }
    });

    return Array.from(map.values());
  }, [discoveredRoutes, documentedRoutes]);

  // Compute live telemetry index by route (Method + Path regex or exact)
  const routeTelemetryMap = useMemo(() => {
    const tMap: Record<string, {
      count: number;
      avgDuration: number;
      errorCount: number;
      lastTimestamp: number;
      hasDrift: boolean;
      driftDescription?: string;
      threatCount: number;
    }> = {};

    requests.forEach(req => {
      const matched = allEndpoints.find(ep => {
        if (ep.method.toUpperCase() !== req.method.toUpperCase()) return false;
        const pattern = '^' + ep.path.replace(/\{[^}]+\}/g, '[^/]+') + '$';
        return new RegExp(pattern).test(req.path) || ep.path === req.path;
      });

      if (matched) {
        const key = `${matched.method.toUpperCase()} ${matched.path}`;
        if (!tMap[key]) {
          tMap[key] = {
            count: 0,
            avgDuration: 0,
            errorCount: 0,
            lastTimestamp: 0,
            hasDrift: false,
            threatCount: 0
          };
        }
        const curr = tMap[key];
        curr.count += 1;
        curr.avgDuration = Math.round(((curr.avgDuration * (curr.count - 1)) + req.durationMs) / curr.count);
        if (req.statusCode >= 400) curr.errorCount += 1;
        if (req.timestamp > curr.lastTimestamp) curr.lastTimestamp = req.timestamp;
        if (req.drift?.hasSchemaMismatch) {
          curr.hasDrift = true;
          curr.driftDescription = req.drift.description;
        }
      }
    });

    // Attach threat count
    threats.forEach(t => {
      const matched = allEndpoints.find(ep => {
        const pattern = '^' + ep.path.replace(/\{[^}]+\}/g, '[^/]+') + '$';
        return new RegExp(pattern).test(t.path) || ep.path === t.path;
      });
      if (matched) {
        const key = `${matched.method.toUpperCase()} ${matched.path}`;
        if (!tMap[key]) {
          tMap[key] = { count: 0, avgDuration: 0, errorCount: 0, lastTimestamp: 0, hasDrift: false, threatCount: 0 };
        }
        tMap[key].threatCount += 1;
      }
    });

    return tMap;
  }, [allEndpoints, requests, threats]);

  // Extract all unique tags
  const tagsList = useMemo(() => {
    const set = new Set<string>();
    allEndpoints.forEach(ep => {
      if (ep.tags && ep.tags.length > 0) {
        ep.tags.forEach(t => set.add(t));
      } else {
        set.add('General');
      }
    });
    return Array.from(set);
  }, [allEndpoints]);

  // Filter endpoints
  const filteredEndpoints = useMemo(() => {
    return allEndpoints.filter(ep => {
      const key = `${ep.method.toUpperCase()} ${ep.path}`;
      const tele = routeTelemetryMap[key];

      const matchesSearch = 
        ep.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ep.summary && ep.summary.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (ep.description && ep.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (ep.tags && ep.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));

      const matchesMethod = methodFilter === 'ALL' || ep.method.toUpperCase() === methodFilter;
      const matchesTag = tagFilter === 'ALL' || (ep.tags && ep.tags.includes(tagFilter)) || (tagFilter === 'General' && (!ep.tags || ep.tags.length === 0));

      if (onlyTraffic && (!tele || tele.count === 0)) return false;
      if (onlyDrift && (!tele || !tele.hasDrift)) return false;

      return matchesSearch && matchesMethod && matchesTag;
    });
  }, [allEndpoints, searchQuery, methodFilter, tagFilter, onlyTraffic, onlyDrift, routeTelemetryMap]);

  // Group filtered endpoints by tag
  const groupedEndpoints = useMemo(() => {
    const groups: Record<string, DiscoveredEndpoint[]> = {};
    filteredEndpoints.forEach(ep => {
      const tag = (ep.tags && ep.tags[0]) ? ep.tags[0] : 'General';
      if (!groups[tag]) groups[tag] = [];
      groups[tag].push(ep);
    });
    return groups;
  }, [filteredEndpoints]);

  // Toggle single tag
  const toggleTag = (tag: string) => {
    setCollapsedTags(prev => ({
      ...prev,
      [tag]: !prev[tag]
    }));
  };

  // Expand / Collapse all tags
  const handleToggleAllTags = (expand: boolean) => {
    const updated: Record<string, boolean> = {};
    tagsList.forEach(t => {
      updated[t] = !expand;
    });
    setCollapsedTags(updated);
  };

  // Toggle single endpoint accordion inline
  const toggleEndpointAccordion = (key: string) => {
    setExpandedEndpoints(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Pre-fill parameter default for an endpoint
  const getParamValue = (epKey: string, paramName: string, defaultValue: string = '') => {
    if (endpointParamValues[epKey] && endpointParamValues[epKey][paramName] !== undefined) {
      return endpointParamValues[epKey][paramName];
    }
    return defaultValue;
  };

  const setParamValue = (epKey: string, paramName: string, value: string) => {
    setEndpointParamValues(prev => ({
      ...prev,
      [epKey]: {
        ...(prev[epKey] || {}),
        [paramName]: value
      }
    }));
  };

  // Get JSON request body default
  const getBodyValue = (epKey: string, ep: DiscoveredEndpoint) => {
    if (endpointBodyValues[epKey] !== undefined) {
      return endpointBodyValues[epKey];
    }
    // Generate smart example
    if (ep.requestBody?.content?.['application/json']?.schema) {
      const schema = ep.requestBody.content['application/json'].schema;
      const exampleObj: Record<string, any> = {};
      if (schema.properties) {
        Object.entries(schema.properties).forEach(([k, prop]: [string, any]) => {
          if (prop.example !== undefined) {
            exampleObj[k] = prop.example;
          } else if (prop.type === 'string') {
            exampleObj[k] = `${k}_sample`;
          } else if (prop.type === 'number') {
            exampleObj[k] = 42;
          } else if (prop.type === 'boolean') {
            exampleObj[k] = true;
          } else if (prop.type === 'array') {
            exampleObj[k] = ['sample_item'];
          }
        });
      }
      return JSON.stringify(exampleObj, null, 2);
    }
    return '';
  };

  // Execute Request Inline
  const handleExecuteInline = async (ep: DiscoveredEndpoint) => {
    const key = `${ep.method.toUpperCase()} ${ep.path}`;
    setExecutingKeys(prev => ({ ...prev, [key]: true }));

    let finalPath = ep.path;
    // Replace {param}
    const matches = ep.path.match(/\{([^}]+)\}/g);
    if (matches) {
      matches.forEach(m => {
        const paramName = m.replace(/[{}]/g, '');
        const val = getParamValue(key, paramName, paramName.includes('id') ? '1' : 'sample');
        finalPath = finalPath.replace(m, encodeURIComponent(val));
      });
    }

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    if (authSecret) {
      headers['x-pulse-auth'] = authSecret;
      headers['Authorization'] = `Bearer ${authSecret}`;
    }

    const bodyContent = getBodyValue(key, ep);
    const start = performance.now();

    try {
      const fetchOpts: RequestInit = {
        method: ep.method,
        headers,
      };
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(ep.method.toUpperCase()) && bodyContent) {
        fetchOpts.body = bodyContent;
      }

      const res = await fetch(finalPath, fetchOpts);
      const durationMs = Math.round(performance.now() - start);
      const text = await res.text();

      const resHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => { resHeaders[k] = v; });

      // Formatted body
      let formatted = text;
      try {
        formatted = JSON.stringify(JSON.parse(text), null, 2);
      } catch (e) {}

      // Check schema drift
      let driftStatus: 'VERIFIED' | 'DRIFT' | 'UNDOCUMENTED' = 'VERIFIED';
      let driftNotes: string | undefined;

      if (ep.responses) {
        const statusCodeStr = String(res.status);
        if (!ep.responses[statusCodeStr] && !ep.responses['200'] && !ep.responses['201']) {
          driftStatus = 'UNDOCUMENTED';
          driftNotes = `Status ${res.status} is not defined in the OpenAPI response specification.`;
        }
      }

      setExecutionResponses(prev => ({
        ...prev,
        [key]: {
          status: res.status,
          statusText: res.statusText || 'OK',
          durationMs,
          sizeKb: Math.round((text.length / 1024) * 10) / 10,
          headers: resHeaders,
          body: formatted,
          driftStatus,
          driftNotes
        }
      }));

      // Trigger telemetry refresh
      if (onRefreshData) {
        setTimeout(onRefreshData, 400);
      }
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - start);
      setExecutionResponses(prev => ({
        ...prev,
        [key]: {
          status: 502,
          statusText: 'Network / Simulated Error',
          durationMs,
          sizeKb: 0,
          headers: {},
          body: JSON.stringify({
            error: err.message || 'Connection to backend route failed or route simulated',
            tip: 'If this is a documented spec route without an Express handler, visit /pulse to monitor live handlers.'
          }, null, 2),
          driftStatus: 'UNDOCUMENTED',
          driftNotes: 'Network exception occurred during client dispatch.'
        }
      }));
    } finally {
      setExecutingKeys(prev => ({ ...prev, [key]: false }));
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const generateCurlCommand = (ep: DiscoveredEndpoint) => {
    const key = `${ep.method.toUpperCase()} ${ep.path}`;
    let finalPath = ep.path;
    const matches = ep.path.match(/\{([^}]+)\}/g);
    if (matches) {
      matches.forEach(m => {
        const p = m.replace(/[{}]/g, '');
        const val = getParamValue(key, p, '1');
        finalPath = finalPath.replace(m, val);
      });
    }
    const fullUrl = `http://localhost:3000${finalPath}`;
    let curl = `curl -X ${ep.method.toUpperCase()} "${fullUrl}" \\\n  -H "Accept: application/json"`;
    if (authSecret) {
      curl += ` \\\n  -H "x-pulse-auth: ${authSecret}"`;
    }
    const bodyContent = getBodyValue(key, ep);
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(ep.method.toUpperCase()) && bodyContent) {
      curl += ` \\\n  -H "Content-Type: application/json" \\\n  -d '${bodyContent.replace(/\n/g, '')}'`;
    }
    return curl;
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* ════════════════════ SWAGGER HEADER COCKPIT ════════════════════ */}
      <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', boxShadow: 'var(--shadow-sm)' }}>
        
        {/* Title, Badges & Authorize Action */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
              <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.025em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {RISE_OPENAPI_METADATA.title}
              </h2>
              <span className="badge badge-success" style={{ fontSize: '0.7rem', padding: '0.2rem 0.55rem' }}>
                {RISE_OPENAPI_METADATA.version}
              </span>
              <span className="badge badge-primary" style={{ fontSize: '0.7rem', padding: '0.2rem 0.55rem' }}>
                {hasOpenApiSpec ? 'OpenAPI 3.0.3 (Live Spec)' : 'OAS 3.0.3 Compliant'}
              </span>
            </div>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '820px', lineHeight: 1.5 }}>
              {RISE_OPENAPI_METADATA.description}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.65rem', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span>Server:</span>
                <select
                  value={selectedServer}
                  onChange={(e) => setSelectedServer(e.target.value)}
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--accent-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.72rem',
                    padding: '0.15rem 0.4rem',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  {RISE_OPENAPI_METADATA.servers.map(srv => (
                    <option key={srv} value={srv}>{srv}</option>
                  ))}
                </select>
              </div>
              <span>•</span>
              <span>License: <strong style={{ color: 'var(--text-main)' }}>{RISE_OPENAPI_METADATA.license}</strong></span>
              <span>•</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span className="live-pulse-dot" /> Live Telemetry Attached
              </span>
            </div>
          </div>

          {/* Quick Actions & Authorize Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-input)', padding: '0.35rem 0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.78rem' }}>
              <Lock size={13} style={{ color: authSecret ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Auth:</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: authSecret ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                {authSecret ? '●●●●●●●●' : 'None (Public)'}
              </span>
            </div>

            <button 
              onClick={() => handleToggleAllTags(true)}
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.45rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Maximize2 size={12} />
              Expand All
            </button>
            <button 
              onClick={() => handleToggleAllTags(false)}
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.45rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Minimize2 size={12} />
              Collapse All
            </button>
          </div>
        </div>

        {/* ════════════════════ FILTER & SEARCH BAR ════════════════════ */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
          
          {/* Search Box */}
          <div style={{ position: 'relative', flexGrow: 1, minWidth: '240px' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-muted)' }} />
            <input 
              type="text"
              placeholder="Search by endpoint path, operation title, or tag (e.g. /auth, habits)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{ width: '100%', paddingLeft: '2.2rem', fontSize: '0.82rem', height: '36px' }}
            />
          </div>

          {/* HTTP Method Filters */}
          <div style={{ display: 'flex', gap: '0.2rem', background: 'var(--bg-input)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            {['ALL', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(m => (
              <button
                key={m}
                onClick={() => setMethodFilter(m)}
                style={{
                  border: 'none',
                  background: methodFilter === m ? 'var(--bg-card)' : 'transparent',
                  color: methodFilter === m ? 'var(--text-main)' : 'var(--text-muted)',
                  fontWeight: methodFilter === m ? 700 : 500,
                  fontSize: '0.72rem',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  boxShadow: methodFilter === m ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Superpower Quick Toggles (Missing in Swagger) */}
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <button
              onClick={() => setOnlyTraffic(!onlyTraffic)}
              className={`tag-pill ${onlyTraffic ? 'active' : ''}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', height: '32px' }}
            >
              <Activity size={12} color={onlyTraffic ? 'white' : '#00AA45'} />
              Active Traffic Only
            </button>

            <button
              onClick={() => setOnlyDrift(!onlyDrift)}
              className={`tag-pill ${onlyDrift ? 'active' : ''}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', height: '32px' }}
            >
              <AlertTriangle size={12} color={onlyDrift ? 'white' : '#D97706'} />
              Drifted Specs
            </button>
          </div>

        </div>

        {/* Tag selection pills row with comfortable top & bottom padding */}
        <div style={{
          display: 'flex',
          gap: '0.45rem',
          marginTop: '1.25rem',
          paddingTop: '1rem',
          paddingBottom: '0.85rem',
          borderTop: '1px solid var(--border-color)',
          overflowX: 'auto',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-light)', marginRight: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
            Tags:
          </span>
          <button
            onClick={() => setTagFilter('ALL')}
            className={`tag-pill ${tagFilter === 'ALL' ? 'active' : ''}`}
          >
            All Categories ({allEndpoints.length})
          </button>
          {tagsList.map(t => {
            const count = allEndpoints.filter(e => e.tags && e.tags.includes(t)).length;
            return (
              <button
                key={t}
                onClick={() => setTagFilter(t)}
                className={`tag-pill ${tagFilter === t ? 'active' : ''}`}
              >
                {t} ({count})
              </button>
            );
          })}
        </div>

      </div>

      {/* ════════════════════ SWAGGER TAG ACCORDIONS ════════════════════ */}
      {Object.keys(groupedEndpoints).length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
          <Layers size={40} strokeWidth={1.4} style={{ margin: '0 auto 0.85rem', opacity: 0.5 }} />
          <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary)' }}>No matching API operations found</h4>
          <p style={{ fontSize: '0.82rem', marginTop: '0.35rem' }}>Try clearing the search query or changing method filters.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {Object.entries(groupedEndpoints).map(([tag, endpoints]) => {
            const isTagCollapsed = collapsedTags[tag] || false;

            return (
              <div key={tag} className="swagger-tag-section">
                
                {/* Tag Header Accordion Bar */}
                <div 
                  className={`swagger-tag-header ${!isTagCollapsed ? 'open' : ''}`}
                  onClick={() => toggleTag(tag)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                      {isTagCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        {tag}
                        <span className="badge" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 600 }}>
                          {endpoints.length} {endpoints.length === 1 ? 'operation' : 'operations'}
                        </span>
                      </h3>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {isTagCollapsed ? 'Click to expand' : 'Click to collapse'}
                    </span>
                  </div>
                </div>

                {/* Tag Endpoints Content */}
                {!isTagCollapsed && (
                  <div style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', background: 'var(--bg-card)' }}>
                    {endpoints.map((ep, eIdx) => {
                      const epKey = `${ep.method.toUpperCase()} ${ep.path}`;
                      const isExpanded = expandedEndpoints[epKey] || false;
                      const tele = routeTelemetryMap[epKey];
                      const execResp = executionResponses[epKey];
                      const isExecuting = executingKeys[epKey] || false;
                      const activeSubTab = expandedSubTabs[epKey] || 'runner';

                      return (
                        <div 
                          key={eIdx} 
                          className={`swagger-endpoint-item ${ep.method.toLowerCase()}`}
                        >
                          {/* Endpoint Summary Bar */}
                          <div 
                            className="swagger-endpoint-bar"
                            onClick={() => toggleEndpointAccordion(epKey)}
                          >
                            {/* Left: Method Badge + Path + Summary */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flexGrow: 1, minWidth: 0 }}>
                              <span className={`swagger-badge-method ${ep.method.toLowerCase()}`}>
                                {ep.method}
                              </span>

                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                {renderHighlightedPath(ep.path)}
                              </span>

                              {ep.summary && (
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  — {ep.summary}
                                </span>
                              )}
                            </div>

                            {/* Right: Live Telemetry + Superpowers (Missing in Swagger) */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                              
                              {/* 1. Live Telemetry Badge (RPM + Latency) */}
                              {tele && tele.count > 0 ? (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(0, 170, 69, 0.08)', border: '1px solid rgba(0, 170, 69, 0.25)', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 600, color: '#00AA45' }}>
                                  <span className="live-pulse-dot" />
                                  <span>{tele.count} hits</span>
                                  <span>·</span>
                                  <span>{tele.avgDuration}ms avg</span>
                                </div>
                              ) : (
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-light)', fontFamily: 'var(--font-mono)' }}>
                                  idle
                                </span>
                              )}

                              {/* 2. Security Threat Alert Pill */}
                              {tele && tele.threatCount > 0 && (
                                <span className="badge badge-danger" style={{ fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <ShieldAlert size={10} /> {tele.threatCount} Threats Blocked
                                </span>
                              )}

                              {/* 3. Schema Drift Badge */}
                              {tele && tele.hasDrift ? (
                                <span className="badge badge-warning" style={{ fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <AlertTriangle size={10} /> Schema Drift
                                </span>
                              ) : (
                                <span className="badge badge-success" style={{ fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <CheckCircle size={10} /> Spec OK
                                </span>
                              )}

                              {/* 4. Action: Inline Expand Toggle */}
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '0.22rem 0.6rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600, color: isExpanded ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                <span>{isExpanded ? 'Close' : 'Try it out'}</span>
                                {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                              </div>
                            </div>
                          </div>

                          {/* ════════════════════ EXPANDED INLINE WORKBENCH ════════════════════ */}
                          {isExpanded && (
                            <div className="swagger-endpoint-expanded">
                              
                              {/* Sub Navigation Bar inside endpoint */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.65rem', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', gap: '0.35rem' }}>
                                  <button
                                    onClick={() => setExpandedSubTabs(prev => ({ ...prev, [epKey]: 'runner' }))}
                                    style={{
                                      border: 'none',
                                      background: activeSubTab === 'runner' ? 'var(--bg-input)' : 'transparent',
                                      color: activeSubTab === 'runner' ? 'var(--text-main)' : 'var(--text-muted)',
                                      fontWeight: activeSubTab === 'runner' ? 700 : 500,
                                      fontSize: '0.75rem',
                                      padding: '0.35rem 0.75rem',
                                      borderRadius: '6px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    ⚡ Try It Out (Live Runner)
                                  </button>
                                  <button
                                    onClick={() => setExpandedSubTabs(prev => ({ ...prev, [epKey]: 'params' }))}
                                    style={{
                                      border: 'none',
                                      background: activeSubTab === 'params' ? 'var(--bg-input)' : 'transparent',
                                      color: activeSubTab === 'params' ? 'var(--text-main)' : 'var(--text-muted)',
                                      fontWeight: activeSubTab === 'params' ? 700 : 500,
                                      fontSize: '0.75rem',
                                      padding: '0.35rem 0.75rem',
                                      borderRadius: '6px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    📋 Parameters & Schemas
                                  </button>
                                  <button
                                    onClick={() => setExpandedSubTabs(prev => ({ ...prev, [epKey]: 'responses' }))}
                                    style={{
                                      border: 'none',
                                      background: activeSubTab === 'responses' ? 'var(--bg-input)' : 'transparent',
                                      color: activeSubTab === 'responses' ? 'var(--text-main)' : 'var(--text-muted)',
                                      fontWeight: activeSubTab === 'responses' ? 700 : 500,
                                      fontSize: '0.75rem',
                                      padding: '0.35rem 0.75rem',
                                      borderRadius: '6px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    📦 Responses Spec
                                  </button>
                                </div>

                                <button
                                  onClick={() => copyToClipboard(generateCurlCommand(ep), `curl_${epKey}`)}
                                  className="btn-secondary"
                                  style={{ fontSize: '0.7rem', padding: '0.25rem 0.6rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                                >
                                  {copiedKey === `curl_${epKey}` ? <Check size={11} color="#00AA45" /> : <Copy size={11} />}
                                  <span>{copiedKey === `curl_${epKey}` ? 'Copied cURL!' : 'Copy cURL'}</span>
                                </button>
                              </div>

                              {/* TAB 1: LIVE TEST RUNNER */}
                              {activeSubTab === 'runner' && (
                                <div style={{ display: 'grid', gridTemplateColumns: execResp ? '1fr 1fr' : '1fr', gap: '1.25rem' }}>
                                  
                                  {/* Request Inputs */}
                                  <div>
                                    {ep.description && (
                                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
                                        {ep.description}
                                      </p>
                                    )}

                                    {/* Path Parameters Inputs */}
                                    {ep.path.includes('{') && (
                                      <div style={{ marginBottom: '0.85rem' }}>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                                          Path Parameters
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                          {(ep.path.match(/\{([^}]+)\}/g) || []).map(m => {
                                            const pName = m.replace(/[{}]/g, '');
                                            const defaultVal = pName.includes('id') ? '101' : 'sample';
                                            return (
                                              <div key={pName} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ width: '90px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#7C3AED', fontWeight: 600 }}>
                                                  {pName}*:
                                                </span>
                                                <input
                                                  type="text"
                                                  value={getParamValue(epKey, pName, defaultVal)}
                                                  onChange={(e) => setParamValue(epKey, pName, e.target.value)}
                                                  className="form-input"
                                                  style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
                                                  placeholder={`Enter ${pName}...`}
                                                />
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    {/* Request Body Editor */}
                                    {['POST', 'PUT', 'PATCH'].includes(ep.method.toUpperCase()) && (
                                      <div style={{ marginBottom: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
                                            Request Body (application/json)
                                          </div>
                                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                            Pre-filled with OpenAPI mock example
                                          </span>
                                        </div>
                                        <textarea
                                          value={getBodyValue(epKey, ep)}
                                          onChange={(e) => setEndpointBodyValues(prev => ({ ...prev, [epKey]: e.target.value }))}
                                          className="form-input"
                                          rows={6}
                                          style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '0.76rem', lineHeight: 1.45, resize: 'vertical' }}
                                        />
                                      </div>
                                    )}

                                    {/* Execute Button */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                      <button
                                        onClick={() => handleExecuteInline(ep)}
                                        disabled={isExecuting}
                                        className="btn-primary"
                                        style={{ fontSize: '0.8rem', padding: '0.55rem 1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                                      >
                                        {isExecuting ? <RefreshCw className="animate-spin" size={13} /> : <Play size={13} fill="white" />}
                                        <span>{isExecuting ? 'Sending Request...' : 'Execute Request'}</span>
                                      </button>

                                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                        Executes against {selectedServer}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Response Panel */}
                                  {execResp && (
                                    <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                          <span className={`badge ${execResp.status < 400 ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                                            {execResp.status} {execResp.statusText}
                                          </span>
                                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                            ⏱️ {execResp.durationMs}ms
                                          </span>
                                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                            📦 {execResp.sizeKb} KB
                                          </span>
                                        </div>

                                        <button
                                          onClick={() => copyToClipboard(execResp.body, `resp_${epKey}`)}
                                          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem' }}
                                        >
                                          {copiedKey === `resp_${epKey}` ? <Check size={11} color="#00AA45" /> : <Copy size={11} />}
                                          <span>{copiedKey === `resp_${epKey}` ? 'Copied' : 'Copy'}</span>
                                        </button>
                                      </div>

                                      {/* Drift Sentinel Result */}
                                      {execResp.driftNotes && (
                                        <div style={{ background: 'rgba(217, 119, 6, 0.08)', border: '1px solid rgba(217, 119, 6, 0.25)', padding: '0.4rem 0.65rem', borderRadius: '6px', fontSize: '0.72rem', color: '#D97706', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                          <AlertTriangle size={12} />
                                          <span>{execResp.driftNotes}</span>
                                        </div>
                                      )}

                                      {/* Formatted JSON output */}
                                      <div style={{ flexGrow: 1, maxHeight: '220px', overflowY: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.65rem' }}>
                                        <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-main)', lineHeight: 1.45 }}>
                                          {execResp.body}
                                        </pre>
                                      </div>
                                    </div>
                                  )}

                                </div>
                              )}

                              {/* TAB 2: PARAMETERS & SCHEMAS */}
                              {activeSubTab === 'params' && (
                                <div>
                                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                    Defined Parameters
                                  </div>
                                  {ep.parameters && ep.parameters.length > 0 ? (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                      <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                                          <th style={{ padding: '0.4rem' }}>Name</th>
                                          <th style={{ padding: '0.4rem' }}>In</th>
                                          <th style={{ padding: '0.4rem' }}>Type</th>
                                          <th style={{ padding: '0.4rem' }}>Required</th>
                                          <th style={{ padding: '0.4rem' }}>Description</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {ep.parameters.map((p, pIdx) => (
                                          <tr key={pIdx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                            <td style={{ padding: '0.45rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-main)' }}>{p.name}</td>
                                            <td style={{ padding: '0.45rem', color: 'var(--text-muted)' }}>{p.in}</td>
                                            <td style={{ padding: '0.45rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>{p.schema?.type || 'string'}</td>
                                            <td style={{ padding: '0.45rem' }}>
                                              {p.required ? <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>required</span> : <span style={{ color: 'var(--text-light)' }}>optional</span>}
                                            </td>
                                            <td style={{ padding: '0.45rem', color: 'var(--text-secondary)' }}>{p.description || '—'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  ) : (
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No explicit query or header parameters required.</p>
                                  )}
                                </div>
                              )}

                              {/* TAB 3: RESPONSES SPEC */}
                              {activeSubTab === 'responses' && (
                                <div>
                                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                    Expected HTTP Status Responses
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    {Object.entries(ep.responses || { '200': { description: 'Successful standard response' } }).map(([code, rObj]: [string, any]) => (
                                      <div key={code} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', background: 'var(--bg-input)', borderRadius: '6px' }}>
                                        <span className={`badge ${code.startsWith('2') ? 'badge-success' : 'badge-danger'}`} style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.72rem' }}>
                                          {code}
                                        </span>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>
                                          {rObj.description || 'Operation returned'}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                            </div>
                          )}

                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

function capitalize(str: string) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function renderHighlightedPath(path: string) {
  const parts = path.split(/(\{[^}]+\})/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('{') && p.endsWith('}')) {
          return (
            <span key={i} style={{ color: '#7C3AED', background: 'rgba(124, 58, 237, 0.1)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
              {p}
            </span>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}
