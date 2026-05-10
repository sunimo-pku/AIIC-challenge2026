interface RadarChartProps {
  data: Record<string, number>;
  size?: number;
}

export function RadarChart({ data, size = 200 }: RadarChartProps) {
  const labels = Object.keys(data);
  const values = Object.values(data);
  const count = labels.length;
  if (count === 0) return null;

  const center = size / 2;
  const radius = size * 0.38;
  const angleStep = (Math.PI * 2) / count;

  const getPoint = (idx: number, val: number) => {
    const angle = idx * angleStep - Math.PI / 2;
    const r = (val / 100) * radius;
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  };

  const points = values.map((v, i) => getPoint(i, v));
  const polygon = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Grid lines (20%, 40%, 60%, 80%, 100%)
  const gridLevels = [20, 40, 60, 80, 100];

  return (
    <svg width={size} height={size} className="mx-auto">
      {/* Background grid */}
      {gridLevels.map((level) => {
        const gridPoints = Array.from({ length: count }, (_, i) => {
          const p = getPoint(i, level);
          return `${p.x},${p.y}`;
        }).join(" ");
        return (
          <polygon
            key={level}
            points={gridPoints}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeWidth={1}
          />
        );
      })}

      {/* Axis lines */}
      {Array.from({ length: count }, (_, i) => {
        const p = getPoint(i, 100);
        return (
          <line
            key={`axis-${i}`}
            x1={center}
            y1={center}
            x2={p.x}
            y2={p.y}
            stroke="currentColor"
            strokeOpacity={0.15}
            strokeWidth={1}
          />
        );
      })}

      {/* Data polygon */}
      <polygon
        points={polygon}
        fill="currentColor"
        fillOpacity={0.15}
        stroke="currentColor"
        strokeWidth={1.5}
      />

      {/* Data points */}
      {points.map((p, i) => (
        <circle key={`pt-${i}`} cx={p.x} cy={p.y} r={3} fill="currentColor" />
      ))}

      {/* Labels */}
      {labels.map((label, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const labelRadius = radius + 18;
        const x = center + labelRadius * Math.cos(angle);
        const y = center + labelRadius * Math.sin(angle);
        const anchor =
          Math.abs(Math.cos(angle)) < 0.3 ? "middle" : Math.cos(angle) > 0 ? "start" : "end";
        return (
          <text
            key={`lbl-${i}`}
            x={x}
            y={y}
            textAnchor={anchor}
            dominantBaseline="middle"
            className="text-[10px] fill-current opacity-60"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}
