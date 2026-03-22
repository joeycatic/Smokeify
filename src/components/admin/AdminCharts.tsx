"use client";

type Point = {
  label: string;
  value: number;
  secondaryValue?: number;
};

type SparklineChartProps = {
  data: Point[];
  className?: string;
  strokeClassName?: string;
  fillClassName?: string;
};

type BarsChartProps = {
  data: Point[];
  valueFormatter?: (value: number) => string;
  colorClassName?: string;
};

const DEFAULT_STROKE = "stroke-cyan-300";
const DEFAULT_FILL = "fill-cyan-400/10";

export function SparklineChart({
  data,
  className = "",
  strokeClassName = DEFAULT_STROKE,
  fillClassName = DEFAULT_FILL,
}: SparklineChartProps) {
  if (data.length === 0) {
    return (
      <div
        className={`flex h-28 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] text-xs text-slate-500 ${className}`}
      >
        No trend data
      </div>
    );
  }

  const width = 320;
  const height = 112;
  const padding = 8;
  const maxValue = Math.max(...data.map((point) => point.value), 1);
  const step = data.length === 1 ? 0 : (width - padding * 2) / (data.length - 1);

  const coordinates = data.map((point, index) => {
    const x = padding + step * index;
    const y =
      height - padding - ((point.value <= 0 ? 0 : point.value) / maxValue) * (height - padding * 2);
    return { x, y };
  });

  const linePath = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const areaPath = `${linePath} L ${coordinates.at(-1)?.x ?? width - padding} ${height - padding} L ${coordinates[0]?.x ?? padding} ${height - padding} Z`;

  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.02] p-3 ${className}`}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-28 w-full">
        <path d={areaPath} className={fillClassName} />
        <path
          d={linePath}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={strokeClassName}
          vectorEffect="non-scaling-stroke"
        />
        {coordinates.map((point) => (
          <circle
            key={`${point.x}-${point.y}`}
            cx={point.x}
            cy={point.y}
            r="2.5"
            className={strokeClassName.replace("stroke-", "fill-")}
          />
        ))}
      </svg>
      <div className="mt-2 grid grid-cols-7 gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">
        {data.slice(-7).map((point) => (
          <span key={point.label} className="truncate text-center">
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function HorizontalBarsChart({
  data,
  valueFormatter = (value) => String(value),
  colorClassName = "bg-cyan-400",
}: BarsChartProps) {
  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="space-y-3">
      {data.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-slate-500">
          No data available.
        </div>
      ) : null}
      {data.map((item) => (
        <div key={item.label} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-slate-200">{item.label}</span>
            <span className="shrink-0 font-medium text-slate-400">
              {valueFormatter(item.value)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={`h-full rounded-full ${colorClassName}`}
              style={{
                width: `${Math.max(8, Math.round((item.value / maxValue) * 100))}%`,
              }}
            />
          </div>
          {typeof item.secondaryValue === "number" ? (
            <div className="text-xs text-slate-500">{valueFormatter(item.secondaryValue)}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export type AdminChartPoint = Point;
