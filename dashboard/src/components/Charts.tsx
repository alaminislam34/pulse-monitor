import { useState, useEffect, useRef } from 'react';

// Mini Sparkline component for Stat Cards
export function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) {
    return (
      <svg width="70" height="20" viewBox="0 0 70 20">
        <line x1="0" y1="10" x2="70" y2="10" stroke={color} strokeWidth="1" strokeDasharray="2" />
      </svg>
    );
  }
  const width = 70;
  const height = 20;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;
  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = height - 2 - ((val - min) / range) * (height - 4);
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'visible' }}>
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

// Circular progress gauge component
export function CircularGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const radius = 30;
  const stroke = 5;
  const circumference = 2 * Math.PI * radius; // ~188.5
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

  return (
    <div className="gauge-container" style={{ width: '80px', height: '80px' }}>
      <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx="40" cy="40" r={radius} fill="none" stroke="var(--bg-input)" strokeWidth={stroke} />
        <circle 
          cx="40" 
          cy="40" 
          r={radius} 
          fill="none" 
          stroke={color} 
          strokeWidth={stroke} 
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
        />
      </svg>
      <div className="gauge-center-text">
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>{value.toFixed(0)}%</span>
        <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
      </div>
    </div>
  );
}

// Real-time Traffic Area Chart component
export function TrafficAreaChart({ data, color }: { data: number[]; color: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    resizeObserver.observe(containerRef.current);
    setWidth(containerRef.current.clientWidth);
    return () => resizeObserver.disconnect();
  }, []);

  const height = 220;
  if (data.length === 0) {
    return (
      <div ref={containerRef} className="flex-center" style={{ height, color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
        Awaiting transaction flow...
      </div>
    );
  }

  const padding = 15;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;

  const points = data.map((val, idx) => {
    const x = padding + (idx / (data.length - 1 || 1)) * chartWidth;
    const y = height - padding - ((val - min) / range) * chartHeight;
    return { x, y };
  });

  const linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <div ref={containerRef} style={{ width: '100%', height, position: 'relative' }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="trafficGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="var(--border-color)" strokeDasharray="3" />
        <line x1={padding} y1={padding + chartHeight / 2} x2={width - padding} y2={padding + chartHeight / 2} stroke="var(--border-color)" strokeDasharray="3" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--border-color)" />

        <path d={areaPath} fill="url(#trafficGrad)" />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {points.map((p, idx) => (
          <circle key={idx} cx={p.x} cy={p.y} r="3.5" fill="var(--bg-card)" stroke={color} strokeWidth="2" />
        ))}

        <text x={padding} y={padding - 4} fill="var(--text-muted)" fontSize="8.5" fontFamily="var(--font-mono)">
          Peak: {max.toFixed(0)} ms
        </text>
        <text x={padding} y={height - padding + 12} fill="var(--text-muted)" fontSize="8.5" fontFamily="var(--font-mono)">
          Min: {min.toFixed(0)} ms
        </text>
      </svg>
    </div>
  );
}
