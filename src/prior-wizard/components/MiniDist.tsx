import type { OutcomeFamily } from '../lib/types';

const W = 80;
const H = 32;
const STROKE = 'rgba(91, 138, 245, 0.7)';
const FILL = 'rgba(91, 138, 245, 0.1)';

/**
 * Tiny inline distribution shape thumbnails for the family picker.
 * These are hand-crafted SVG paths that show the typical shape,
 * not computed from actual PDFs (keeps it simple and fast).
 */
export function MiniDist({ family }: { family: OutcomeFamily }) {
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ display: 'block', marginTop: 6, opacity: 0.8 }}
    >
      {family === 'gaussian' && <GaussianShape />}
      {family === 'lognormal' && <LogNormalShape />}
      {family === 'beta' && <BetaShape />}
      {family === 'bernoulli' && <BernoulliShape />}
      {family === 'categorical' && <CategoricalShape />}
      {family === 'cumulative' && <OrdinalShape />}
      {family === 'poisson' && <PoissonShape />}
    </svg>
  );
}

/** Bell curve — symmetric, extends both sides of center */
function GaussianShape() {
  return (
    <>
      {/* Dashed zero line in the middle showing it can go negative */}
      <line x1={40} y1={2} x2={40} y2={H} stroke="rgba(224,221,213,0.15)" strokeWidth={1} strokeDasharray="2,2" />
      <text x={14} y={H - 1} fontSize={7} fill="rgba(224,221,213,0.25)" fontFamily="var(--pw-font-mono)">&minus;</text>
      <text x={62} y={H - 1} fontSize={7} fill="rgba(224,221,213,0.25)" fontFamily="var(--pw-font-mono)">+</text>
      <path
        d="M 4,28 C 12,28 18,26 24,20 C 28,16 32,6 40,4 C 48,6 52,16 56,20 C 62,26 68,28 76,28 Z"
        fill={FILL}
        stroke={STROKE}
        strokeWidth={1.5}
      />
    </>
  );
}

/** Right-skewed, starts at zero, long right tail */
function LogNormalShape() {
  return (
    <>
      {/* Hard wall at zero */}
      <line x1={6} y1={2} x2={6} y2={H} stroke="rgba(245,91,91,0.3)" strokeWidth={1.5} />
      <text x={9} y={H - 1} fontSize={7} fill="rgba(224,221,213,0.25)" fontFamily="var(--pw-font-mono)">0</text>
      <path
        d="M 6,28 C 8,28 10,24 14,14 C 18,5 20,4 24,4 C 30,6 36,16 44,22 C 54,27 66,28 76,28 Z"
        fill={FILL}
        stroke={STROKE}
        strokeWidth={1.5}
      />
    </>
  );
}

/** U-shape or hump between 0 and 1 */
function BetaShape() {
  return (
    <>
      {/* Walls at 0 and 1 */}
      <line x1={6} y1={2} x2={6} y2={H} stroke="rgba(245,91,91,0.3)" strokeWidth={1.5} />
      <line x1={74} y1={2} x2={74} y2={H} stroke="rgba(245,91,91,0.3)" strokeWidth={1.5} />
      <text x={9} y={H - 1} fontSize={7} fill="rgba(224,221,213,0.25)" fontFamily="var(--pw-font-mono)">0</text>
      <text x={63} y={H - 1} fontSize={7} fill="rgba(224,221,213,0.25)" fontFamily="var(--pw-font-mono)">1</text>
      <path
        d="M 6,28 C 10,28 16,22 24,12 C 30,6 34,4 40,4 C 46,4 50,6 56,12 C 64,22 70,28 74,28 Z"
        fill={FILL}
        stroke={STROKE}
        strokeWidth={1.5}
      />
    </>
  );
}

/** Two bars */
function BernoulliShape() {
  return (
    <>
      <rect x={14} y={10} width={20} height={18} rx={2} fill={FILL} stroke={STROKE} strokeWidth={1.5} />
      <rect x={46} y={4} width={20} height={24} rx={2} fill={FILL} stroke={STROKE} strokeWidth={1.5} />
      <text x={20} y={H - 1} fontSize={7} fill="rgba(224,221,213,0.25)" fontFamily="var(--pw-font-mono)">0</text>
      <text x={52} y={H - 1} fontSize={7} fill="rgba(224,221,213,0.25)" fontFamily="var(--pw-font-mono)">1</text>
    </>
  );
}

/** Multiple bars of varying height, unordered */
function CategoricalShape() {
  const bars = [
    { x: 6, h: 16 },
    { x: 22, h: 22 },
    { x: 38, h: 10 },
    { x: 54, h: 18 },
  ];
  return (
    <>
      {bars.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={H - b.h}
          width={12}
          height={b.h}
          rx={2}
          fill={FILL}
          stroke={STROKE}
          strokeWidth={1.5}
        />
      ))}
    </>
  );
}

/** Ascending/descending staircase pattern */
function OrdinalShape() {
  const bars = [
    { x: 4, h: 8 },
    { x: 18, h: 16 },
    { x: 32, h: 24 },
    { x: 46, h: 14 },
    { x: 60, h: 6 },
  ];
  return (
    <>
      {bars.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={H - b.h}
          width={10}
          height={b.h}
          rx={1}
          fill={FILL}
          stroke={STROKE}
          strokeWidth={1.5}
        />
      ))}
    </>
  );
}

/** Discrete bars with decreasing height from zero, with hard wall at 0 */
function PoissonShape() {
  const bars = [
    { x: 6, h: 24 },
    { x: 20, h: 18 },
    { x: 34, h: 12 },
    { x: 48, h: 6 },
    { x: 62, h: 3 },
  ];
  return (
    <>
      {bars.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={H - b.h}
          width={10}
          height={b.h}
          rx={1}
          fill={FILL}
          stroke={STROKE}
          strokeWidth={1.5}
        />
      ))}
      <text x={9} y={H - 1} fontSize={6} fill="rgba(224,221,213,0.2)" fontFamily="var(--pw-font-mono)">0</text>
      <text x={23} y={H - 1} fontSize={6} fill="rgba(224,221,213,0.2)" fontFamily="var(--pw-font-mono)">1</text>
      <text x={37} y={H - 1} fontSize={6} fill="rgba(224,221,213,0.2)" fontFamily="var(--pw-font-mono)">2</text>
    </>
  );
}
