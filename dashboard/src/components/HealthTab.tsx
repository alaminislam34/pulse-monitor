import { SystemMetrics } from '../types';

interface HealthTabProps {
  system: SystemMetrics;
}

export function HealthTab({ system }: HealthTabProps) {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="card">
        <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.25rem' }}>Process Resource Footprint</h4>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Deep hardware capacity, thread responsiveness, and VM heap details</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }} className="middle-cards-grid">
          
          {/* Performance Indicators */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="card" style={{ padding: '1rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Node processor count</span>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem' }}>{system.cpuCount} Cores</h3>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Host environment platform: {system.platform}</p>
            </div>

            <div className="card" style={{ padding: '1rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Main thread lag delay</span>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem', color: system.eventLoopLag > 40 ? 'var(--accent-danger)' : 'var(--text-main)' }}>
                {system.eventLoopLag.toFixed(1)} ms
              </h3>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Execution queue intervals</p>
            </div>

            {system.loadAvg && (
              <div className="card" style={{ padding: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Load Averages (1m, 5m, 15m)</span>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                  {system.loadAvg.join(', ')}
                </h3>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Standard Unix physical thread levels</p>
              </div>
            )}
          </div>

          {/* Memory gauges */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Node Heap Used</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{system.memory.heapUsed.toFixed(0)}MB / {system.memory.heapTotal.toFixed(0)}MB</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${(system.memory.heapUsed / system.memory.heapTotal) * 100}%`, height: '100%', background: 'var(--accent-primary)', borderRadius: '4px' }}></div>
              </div>
            </div>

            {system.memory.systemTotal && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Host System RAM</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{(system.memory.systemTotal - system.memory.systemFree).toFixed(0)}MB / {system.memory.systemTotal.toFixed(0)}MB</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${((system.memory.systemTotal - system.memory.systemFree) / system.memory.systemTotal) * 100}%`, height: '100%', background: 'var(--accent-success)', borderRadius: '4px' }}></div>
                </div>
              </div>
            )}

            <div style={{ background: 'var(--bg-input)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: '1.4' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>RSS Footprint: </span>
              {system.memory.rss.toFixed(0)}MB total physical memory mapped to the host node.js process.
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
