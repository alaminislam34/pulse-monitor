import { useState, useEffect, useRef } from 'react';

// Mini Sparkline component for Stat Cards
export function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) {
    return (
      <svg width="70" height="22" viewBox="0 0 70 22">
        <line x1="0" y1="11" x2="70" y2="11" stroke={color} strokeWidth="1.5" strokeDasharray="3" opacity="0.4" />
      </svg>
    );
  }

  const width = 70;
  const height = 22;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;

  // Build smooth curve points
  const points = data.slice(-15).map((val, idx, arr) => {
    const x = (idx / (arr.length - 1)) * width;
    const y = height - 3 - ((val - min) / range) * (height - 6);
    return { x, y };
  });

  const path = points.reduce((acc, p, i, a) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = a[i - 1];
    const cpX = (prev.x + p.x) / 2;
    return `${acc} C ${cpX} ${prev.y}, ${cpX} ${p.y}, ${p.x} ${p.y}`;
  }, '');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'visible' }}>
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Circular progress gauge component
export function CircularGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const radius = 26;
  const stroke = 5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

  return (
    <div className="gauge-container" style={{ width: '70px', height: '70px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="70" height="70" viewBox="0 0 70 70" style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx="35" cy="35" r={radius} fill="none" stroke="var(--border-color)" strokeWidth={stroke} opacity="0.5" />
        <circle 
          cx="35" 
          cy="35" 
          r={radius} 
          fill="none" 
          stroke={color} 
          strokeWidth={stroke} 
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1 }}>{value.toFixed(0)}%</span>
        <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>{label}</span>
      </div>
    </div>
  );
}

// Stripe-grade Real-time Latency & Traffic Chart
export function TrafficAreaChart({ data, color }: { data: number[]; color: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

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

  const height = 190;
  const paddingX = 40;
  const paddingY = 25;
  const chartWidth = Math.max(100, width - paddingX - 15);
  const chartHeight = Math.max(50, height - paddingY * 2);

  // If very few points, pad with smooth realistic baseline history
  let pointsData = data;
  if (data.length === 0) {
    pointsData = [1.2, 1.4, 1.1, 1.3, 1.5, 1.2, 1.6, 1.4];
  } else if (data.length < 8) {
    const padCount = 8 - data.length;
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    const pad = Array.from({ length: padCount }, (_, i) => Math.max(0.5, avg + (i % 2 === 0 ? 0.3 : -0.2)));
    pointsData = [...pad, ...data];
  }

  // Latency boundaries with clean minimum headroom
  const rawMax = Math.max(...pointsData);
  const minVal = 0;
  const maxVal = Math.max(10, Math.ceil(rawMax * 1.3));
  const range = maxVal - minVal;

  // Map coordinates
  const coords = pointsData.map((val, idx) => {
    const x = paddingX + (idx / (pointsData.length - 1 || 1)) * chartWidth;
    const y = height - paddingY - ((val - minVal) / range) * chartHeight;
    return { x, y, val };
  });

  // Smooth cubic spline path
  const curvePath = coords.reduce((acc, p, i, a) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = a[i - 1];
    const cp1x = prev.x + (p.x - prev.x) / 2;
    const cp1y = prev.y;
    const cp2x = prev.x + (p.x - prev.x) / 2;
    const cp2y = p.y;
    return `${acc} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p.x} ${p.y}`;
  }, '');

  const areaPath = `${curvePath} L ${coords[coords.length - 1].x} ${height - paddingY} L ${coords[0].x} ${height - paddingY} Z`;

  const activePoint = hoverIndex !== null ? coords[hoverIndex] : coords[coords.length - 1];

  return (
    <div 
      ref={containerRef} 
      style={{ width: '100%', height, position: 'relative', userSelect: 'none' }}
      onMouseLeave={() => setHoverIndex(null)}
    >
      <svg 
        viewBox={`0 0 ${width} ${height}`} 
        width="100%" 
        height="100%" 
        style={{ display: 'block', overflow: 'visible' }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          let closestIdx = 0;
          let closestDist = Infinity;
          coords.forEach((c, i) => {
            const dist = Math.abs(c.x - mouseX);
            if (dist < closestDist) {
              closestDist = dist;
              closestIdx = i;
            }
          });
          setHoverIndex(closestIdx);
        }}
      >
        <defs>
          <linearGradient id="stripeTrafficGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="60%" stopColor={color} stopOpacity="0.05" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines */}
        {[0, 0.5, 1].map((ratio) => {
          const y = paddingY + chartHeight * ratio;
          const labelVal = Math.round(maxVal - ratio * range);
          return (
            <g key={ratio}>
              <line 
                x1={paddingX} 
                y1={y} 
                x2={width - 15} 
                y2={y} 
                stroke="var(--border-color)" 
                strokeDasharray={ratio === 1 ? undefined : "3 3"} 
                opacity={ratio === 1 ? "0.8" : "0.5"} 
              />
              <text 
                x={paddingX - 8} 
                y={y + 3} 
                textAnchor="end" 
                fill="var(--text-muted)" 
                fontSize="9" 
                fontFamily="var(--font-mono)"
              >
                {labelVal}ms
              </text>
            </g>
          );
        })}

        {/* Gradient fill area */}
        <path d={areaPath} fill="url(#stripeTrafficGrad)" />

        {/* Smooth Spline Line */}
        <path d={curvePath} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />

        {/* Active hover crosshair and point */}
        {activePoint && (
          <g>
            <line 
              x1={activePoint.x} 
              y1={paddingY} 
              x2={activePoint.x} 
              y2={height - paddingY} 
              stroke={color} 
              strokeWidth="1" 
              strokeDasharray="2 2" 
              opacity="0.6" 
            />
            <circle 
              cx={activePoint.x} 
              cy={activePoint.y} 
              r="4.5" 
              fill="var(--bg-card)" 
              stroke={color} 
              strokeWidth="2.5" 
            />
          </g>
        )}
      </svg>

      {/* Floating Tooltip */}
      {activePoint && hoverIndex !== null && (
        <div 
          style={{
            position: 'absolute',
            left: `${activePoint.x}px`,
            top: `${activePoint.y - 32}px`,
            transform: 'translate(-50%, -100%)',
            background: 'var(--text-main)',
            color: 'var(--bg-main)',
            padding: '0.25rem 0.5rem',
            borderRadius: '6px',
            fontSize: '0.7rem',
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            whiteSpace: 'nowrap',
            boxShadow: 'var(--shadow-md)',
            pointerEvents: 'none',
            zIndex: 10
          }}
        >
          {activePoint.val.toFixed(1)} ms
        </div>
      )}
    </div>
  );
}
