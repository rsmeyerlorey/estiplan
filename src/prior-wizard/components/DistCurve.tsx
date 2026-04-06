import { useMemo } from 'react';
import {
  normalCurvePoints,
  exponentialCurvePoints,
  normalInterval95,
  fmt,
} from '../lib/distributions';

interface Props {
  type: 'normal' | 'exponential';
  /** For normal: mean */
  mean?: number;
  /** For normal: sd; for exponential: rate */
  param?: number;
  /** Alias for param when type='normal' — sd is preferred for clarity */
  sd?: number;
  /** Width of the SVG */
  width?: number;
  /** Height of the SVG */
  height?: number;
  /** Label below the curve */
  label?: string;
  /** Show 95% interval shading (normal only) */
  showInterval?: boolean;
  /** Compact mode: smaller size for inline use in cards */
  compact?: boolean;
  /** X-axis label (units/scale): e.g. "log-odds", "log units", "SD units", "value" */
  xAxisLabel?: string;
}

const PADDING = { top: 8, right: 16, bottom: 28, left: 16 };
const COMPACT_PADDING = { top: 4, right: 8, bottom: 16, left: 8 };

export function DistCurve({
  type,
  mean = 0,
  param,
  sd,
  width: widthProp,
  height: heightProp,
  label,
  showInterval = true,
  compact = false,
  xAxisLabel,
}: Props) {
  // sd prop is an alias for param when type='normal'; param is used for exponential rate
  const effectiveParam = sd ?? param ?? 1;
  const width = widthProp ?? (compact ? 160 : 400);
  const height = heightProp ?? (compact ? 80 : (xAxisLabel ? 156 : 140));
  const pad = compact
    ? COMPACT_PADDING
    : xAxisLabel
      ? { ...PADDING, bottom: 42 }
      : PADDING;
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const { path, areaPath, intervalPath, xTicks, intervalLabel } = useMemo(() => {
    const points =
      type === 'normal'
        ? normalCurvePoints(mean, effectiveParam)
        : exponentialCurvePoints(effectiveParam);

    if (points.length === 0) return { path: '', areaPath: '', intervalPath: '', xTicks: [] as { value: number; x: number }[], intervalLabel: '' };

    const xMin = points[0].x;
    const xMax = points[points.length - 1].x;
    const yMax = Math.max(...points.map((p) => p.y)) * 1.1;

    const toSvgX = (x: number) => pad.left + ((x - xMin) / (xMax - xMin)) * plotW;
    const toSvgY = (y: number) => pad.top + plotH - (y / yMax) * plotH;

    // Main curve path
    const pathStr = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toSvgX(p.x)} ${toSvgY(p.y)}`)
      .join(' ');

    // Filled area path
    const areaStr =
      pathStr +
      ` L ${toSvgX(xMax)} ${toSvgY(0)} L ${toSvgX(xMin)} ${toSvgY(0)} Z`;

    // 95% interval shading (normal only)
    let intPath = '';
    let intLabel = '';
    if (type === 'normal' && showInterval) {
      const [lo, hi] = normalInterval95(mean, effectiveParam);
      const intPoints = points.filter((p) => p.x >= lo && p.x <= hi);
      if (intPoints.length > 1) {
        intPath =
          intPoints
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toSvgX(p.x)} ${toSvgY(p.y)}`)
            .join(' ') +
          ` L ${toSvgX(intPoints[intPoints.length - 1].x)} ${toSvgY(0)} L ${toSvgX(intPoints[0].x)} ${toSvgY(0)} Z`;
        intLabel = `95%: ${fmt(lo)} to ${fmt(hi)}`;
      }
    }

    // X-axis ticks (skip in compact mode)
    const ticks: number[] = [];
    if (!compact) {
      if (type === 'normal') {
        ticks.push(mean - 2 * effectiveParam, mean - effectiveParam, mean, mean + effectiveParam, mean + 2 * effectiveParam);
      } else {
        const step = (xMax - xMin) / 4;
        for (let i = 0; i <= 4; i++) ticks.push(xMin + i * step);
      }
    }

    return {
      path: pathStr,
      areaPath: areaStr,
      intervalPath: intPath,
      xTicks: ticks.map((t) => ({ value: t, x: toSvgX(t) })),
      intervalLabel: intLabel,
    };
  }, [type, mean, effectiveParam, plotW, plotH, pad, showInterval, compact]);

  const baselineY = pad.top + plotH;
  const strokeWidth = compact ? 1.5 : 2;
  const tickFontSize = compact ? 7 : 9;

  return (
    <div className="dist-preview">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Filled area (light) */}
        <path d={areaPath} fill="rgba(91, 138, 245, 0.08)" />

        {/* 95% interval shading */}
        {intervalPath && (
          <path d={intervalPath} fill="rgba(91, 138, 245, 0.2)" />
        )}

        {/* Curve */}
        <path d={path} fill="none" stroke="#5b8af5" strokeWidth={strokeWidth} />

        {/* Baseline */}
        <line
          x1={pad.left}
          y1={baselineY}
          x2={width - pad.right}
          y2={baselineY}
          stroke="rgba(224, 221, 213, 0.15)"
          strokeWidth={1}
        />

        {/* X-axis label (units/scale) */}
        {xAxisLabel && !compact && (
          <text
            x={pad.left + plotW / 2}
            y={height - 2}
            textAnchor="middle"
            fontSize={9}
            fill="rgba(128, 128, 128, 0.9)"
            fontFamily="var(--pw-font, sans-serif)"
            fontStyle="italic"
          >
            {xAxisLabel}
          </text>
        )}

        {/* X-axis ticks */}
        {xTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={t.x}
              y1={baselineY}
              x2={t.x}
              y2={baselineY + 4}
              stroke="rgba(224, 221, 213, 0.3)"
              strokeWidth={1}
            />
            <text
              x={t.x}
              y={baselineY + (compact ? 12 : 16)}
              textAnchor="middle"
              fontSize={tickFontSize}
              fill="rgba(224, 221, 213, 0.4)"
              fontFamily="'Fira Code', monospace"
            >
              {fmt(t.value, 1)}
            </text>
          </g>
        ))}
      </svg>
      {!compact && (label || intervalLabel) && (
        <div className="dist-label">
          {intervalLabel && <div>{intervalLabel}</div>}
          {label && <div>{label}</div>}
        </div>
      )}
    </div>
  );
}
