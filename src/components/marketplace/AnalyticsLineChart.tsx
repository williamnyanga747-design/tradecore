import React, { useEffect, useRef } from 'react';
import { loadChartJs } from '../../utils/chartLoader';

interface AnalyticsLineChartProps {
  labels: string[]; // e.g. day labels '2026-08-01'
  series: Array<{ label: string; values: number[]; color: string }>;
  height?: number;
  emptyText?: string;
}

/**
 * Dual-line analytics chart rendered with Chart.js (CDN). If Chart.js cannot
 * load (offline / blocked CDN), falls back to a dependency-free SVG line chart
 * so the dashboard never breaks.
 */
export default function AnalyticsLineChart({ labels, series, height = 220, emptyText = 'No data yet' }: AnalyticsLineChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<any>(null);
  const [failed, setFailed] = React.useState(false);

  useEffect(() => {
    let cancelled = false;
    let Chart: any = null;
    loadChartJs()
      .then((mod: any) => {
        if (cancelled) return;
        Chart = mod;
        const canvas = canvasRef.current;
        if (!canvas) return;
        try {
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          chartRef.current?.destroy?.();
          chartRef.current = new Chart(ctx, {
            type: 'line',
            data: {
              labels,
              datasets: series.map(s => ({
                label: s.label,
                data: s.values,
                borderColor: s.color,
                backgroundColor: s.color + '22',
                borderWidth: 2,
                tension: 0.35,
                pointRadius: 2.5,
                pointBackgroundColor: s.color,
                fill: false
              }))
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { labels: { boxWidth: 12, font: { size: 10 } } }
              },
              scales: {
                y: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 } } },
                x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10, font: { size: 9 } } }
              }
            }
          });
        } catch (e) {
          if (!cancelled) setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      try { chartRef.current?.destroy?.(); } catch (e) {}
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labels, series]);

  if (failed) {
    return <SvgFallback labels={labels} series={series} height={height} emptyText={emptyText} />;
  }

  const hasData = series.some(s => s.values.some(v => v > 0));
  if (!hasData) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-[11px] font-semibold text-gray-400">
        {emptyText}
      </div>
    );
  }

  return (
    <div style={{ height }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

/** Dependency-free SVG fallback: same dual-line chart, no network required. */
function SvgFallback({ labels, series, height, emptyText }: AnalyticsLineChartProps & { height: number }) {
  const W = 600;
  const H = height || 220;
  const pad = { top: 18, right: 18, bottom: 30, left: 34 };
  const iw = W - pad.left - pad.right;
  const ih = H - pad.top - pad.bottom;

  const maxVal = Math.max(1, ...series.flatMap(s => s.values));
  const n = Math.max(1, labels.length);
  const x = (i: number) => pad.left + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v: number) => pad.top + ih - (v / maxVal) * ih;

  const pathFor = (values: number[]) =>
    values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');

  const gridLines = 4;
  const labelStep = Math.ceil(n / 8);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height }} className="block">
      {Array.from({ length: gridLines + 1 }).map((_, g) => {
        const gy = pad.top + (g * ih) / gridLines;
        const val = maxVal - (g * maxVal) / gridLines;
        return (
          <g key={g}>
            <line x1={pad.left} x2={W - pad.right} y1={gy} y2={gy} stroke="#e5e7eb" strokeWidth={1} />
            <text x={pad.left - 6} y={gy + 3} textAnchor="end" fontSize={9} fill="#9ca3af">
              {Math.round(val)}
            </text>
          </g>
        );
      })}
      {labels.map((l, i) =>
        i % labelStep === 0 || i === labels.length - 1 ? (
          <text key={l + i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={8.5} fill="#9ca3af">
            {shortDate(l)}
          </text>
        ) : null
      )}
      {series.map((s, si) => (
        <path key={s.label} d={pathFor(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {series.map((s, si) => (
        <g key={s.label + '-points'}>
          {s.values.map((v, i) =>
            v > 0 ? <circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill={s.color} /> : null
          )}
        </g>
      ))}
      {maxVal === 1 && !series.some(s => s.values.some(v => v > 0)) && (
        <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={11} fill="#9ca3af" fontWeight={600}>
          {emptyText}
        </text>
      )}
    </svg>
  );
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
