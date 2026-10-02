import { useState, useMemo } from 'react';
import { Play, Search, Layers, CheckCircle } from 'lucide-react';
import { DiscoveredEndpoint } from '../types';

interface RoutesTabProps {
  discoveredRoutes: Array<{ path: string; method: string }> | undefined;
  documentedRoutes?: DiscoveredEndpoint[];
  hasOpenApiSpec?: boolean;
  onInspectEndpoint: (endpoint: DiscoveredEndpoint) => void;
}

export function RoutesTab({
  discoveredRoutes = [],
  documentedRoutes = [],
  hasOpenApiSpec = false,
  onInspectEndpoint
}: RoutesTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [tagFilter, setTagFilter] = useState<string>('ALL');

  // Build unified endpoints list by combining documented routes with any router discovered routes
  const allEndpoints: DiscoveredEndpoint[] = useMemo(() => {
    const map = new Map<string, DiscoveredEndpoint>();

    // 1. Add documented routes first (with rich summaries, parameters, schemas)
    documentedRoutes.forEach(doc => {
      const key = `${doc.method.toUpperCase()} ${doc.path}`;
      map.set(key, { ...doc });
    });

    // 2. Add any discovered routes not yet documented
    discoveredRoutes.forEach(disc => {
      const key = `${disc.method.toUpperCase()} ${disc.path}`;
      if (!map.has(key)) {
        // Try to match path with parameterized route (e.g. /api/orders/ord_101 matching /api/orders/{id})
        const isAlreadyCoveredByTemplate = documentedRoutes.some(doc => {
          if (doc.method.toUpperCase() !== disc.method.toUpperCase()) return false;
          const regexStr = '^' + doc.path.replace(/\{[^}]+\}/g, '[^/]+') + '$';
          return new RegExp(regexStr).test(disc.path);
        });

        if (!isAlreadyCoveredByTemplate) {
          map.set(key, {
            path: disc.path,
            method: disc.method.toUpperCase(),
            summary: `${disc.method.toUpperCase()} ${disc.path}`,
            tags: [disc.path.split('/')[2] ? capitalize(disc.path.split('/')[2]) : 'General'],
          });
        }
      }
    });

    return Array.from(map.values());
  }, [discoveredRoutes, documentedRoutes]);

  // Extract all unique tags
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    allEndpoints.forEach(ep => {
      if (ep.tags && ep.tags.length > 0) {
        ep.tags.forEach(t => tags.add(t));
      }
    });
    return Array.from(tags);
  }, [allEndpoints]);

  // Filtered endpoints
  const filteredEndpoints = useMemo(() => {
    return allEndpoints.filter(ep => {
      const matchesSearch = 
        ep.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ep.summary && ep.summary.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (ep.description && ep.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesMethod = methodFilter === 'ALL' || ep.method.toUpperCase() === methodFilter;
      const matchesTag = tagFilter === 'ALL' || (ep.tags && ep.tags.includes(tagFilter));

      return matchesSearch && matchesMethod && matchesTag;
    });
  }, [allEndpoints, searchQuery, methodFilter, tagFilter]);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Top Banner: Service Spec & Stats */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                Pre-defined API Catalog
              </h3>
              <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>
                {allEndpoints.length} Active Endpoints
              </span>
              {hasOpenApiSpec && (
                <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>
                  OpenAPI 3.0 Compliant
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Interactive catalog of all pre-defined service contracts, routing endpoints, parameter schemas, and live test runners.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Click any API to inspect parameters, send live requests, or check drift.
            </span>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          
          {/* Search Box */}
          <div style={{ position: 'relative', flexGrow: 1, minWidth: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
            <input 
              type="text"
              placeholder="Search by endpoint path, operation or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{ width: '100%', paddingLeft: '2rem', fontSize: '0.8rem' }}
            />
          </div>

          {/* HTTP Method Filters */}
          <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--bg-input)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            {['ALL', 'GET', 'POST', 'PUT', 'DELETE'].map(m => (
              <button
                key={m}
                onClick={() => setMethodFilter(m)}
                style={{
                  border: 'none',
                  background: methodFilter === m ? 'var(--bg-card)' : 'transparent',
                  color: methodFilter === m ? 'var(--text-main)' : 'var(--text-muted)',
                  fontWeight: methodFilter === m ? 600 : 500,
                  fontSize: '0.7rem',
                  padding: '0.25rem 0.6rem',
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

          {/* Tag Filter Pills */}
          {availableTags.length > 0 && (
            <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: '0.2rem' }}>Tag:</span>
              <button
                onClick={() => setTagFilter('ALL')}
                className={`tag-pill ${tagFilter === 'ALL' ? 'active' : ''}`}
              >
                All ({allEndpoints.length})
              </button>
              {availableTags.map(t => (
                <button
                  key={t}
                  onClick={() => setTagFilter(t)}
                  className={`tag-pill ${tagFilter === t ? 'active' : ''}`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* Endpoints List */}
      {filteredEndpoints.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-muted)' }}>
          <Layers size={36} strokeWidth={1.5} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)' }}>No matching endpoints found</h4>
          <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Try clearing your search query or method filter.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {filteredEndpoints.map((ep, idx) => {
            const isDocumented = documentedRoutes.some(d => d.path === ep.path && d.method.toUpperCase() === ep.method.toUpperCase());
            const hasPathParams = ep.path.includes('{');

            return (
              <div 
                key={idx} 
                className="endpoint-row-card"
                onClick={() => onInspectEndpoint(ep)}
              >
                {/* Method & Path */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flexGrow: 1 }}>
                  <span className={`method-badge ${ep.method.toLowerCase()}`}>
                    {ep.method}
                  </span>
                  
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    {renderHighlightedPath(ep.path)}
                  </span>

                  {ep.summary && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                      — {ep.summary}
                    </span>
                  )}
                </div>

                {/* Badges and Action Button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                  {ep.tags && ep.tags.map((t, tidx) => (
                    <span key={tidx} className="badge" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                      {t}
                    </span>
                  ))}

                  {hasPathParams && (
                    <span className="badge" style={{ background: 'rgba(124, 58, 237, 0.08)', color: '#7C3AED', fontSize: '0.65rem' }}>
                      Parameterized
                    </span>
                  )}

                  {isDocumented ? (
                    <span className="badge badge-success" style={{ fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <CheckCircle size={10} /> Verified Spec
                    </span>
                  ) : (
                    <span className="badge" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                      Discovered Route
                    </span>
                  )}

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onInspectEndpoint(ep);
                    }}
                    className="btn-try-endpoint"
                  >
                    <Play size={10} fill="#00AA45" color="#00AA45" />
                    <span>Try API</span>
                  </button>
                </div>
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
            <span key={i} style={{ color: '#7C3AED', background: 'rgba(124, 58, 237, 0.08)', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>
              {p}
            </span>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}
