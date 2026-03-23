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

type DonutChartProps = {
  data: Array<{
    label: string;
    value: number;
    colorClassName: string;
  }>;
  totalLabel?: string;
  totalValue?: string;
  className?: string;
};

type FunnelChartProps = {
  stages: Array<{
    label: string;
    value: number;
    helper?: string;
    color: string;
  }>;
  className?: string;
};

type MultiSeriesTrendChartProps = {
  labels: string[];
  series: Array<{
    label: string;
    color: string;
    values: number[];
  }>;
  className?: string;
  valueFormatter?: (value: number) => string;
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
    <div
      className={`admin-lift rounded-2xl border border-white/10 bg-white/[0.02] p-3 ${className}`}
    >
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
              className={`admin-bar-fill h-full rounded-full ${colorClassName}`}
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

export function DonutChart({
  data,
  totalLabel = "Total",
  totalValue,
  className = "",
}: DonutChartProps) {
  const normalized = data.filter((segment) => segment.value > 0);
  const total = normalized.reduce((sum, segment) => sum + segment.value, 0);

  if (total <= 0) {
    return (
      <div
        className={`flex h-48 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] text-sm text-slate-500 ${className}`}
      >
        No ratio data
      </div>
    );
  }

  const gradientStops = normalized
    .reduce<{ cursor: number; stops: string[] }>(
      (acc, segment) => {
        const start = (acc.cursor / total) * 100;
        const nextCursor = acc.cursor + segment.value;
        const end = (nextCursor / total) * 100;
        acc.stops.push(
          `${segment.colorClassName} ${start.toFixed(2)}% ${end.toFixed(2)}%`
        );
        return { cursor: nextCursor, stops: acc.stops };
      },
      { cursor: 0, stops: [] }
    )
    .stops.join(", ");

  const conicGradient = `conic-gradient(${gradientStops})`;

  return (
    <div
      className={`admin-lift flex flex-col gap-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4 ${className}`}
    >
      <div className="flex items-center justify-center">
        <div
          className="relative flex h-40 w-40 items-center justify-center rounded-full"
          style={{ backgroundImage: conicGradient }}
        >
          <div className="absolute inset-[18%] rounded-full border border-white/10 bg-[#090d12]" />
          <div className="relative z-10 text-center">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
              {totalLabel}
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">
              {totalValue ?? String(total)}
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {normalized.map((segment) => (
          <div
            key={segment.label}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
          >
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: segment.colorClassName }}
                />
                <span className="text-slate-200">{segment.label}</span>
              </div>
              <span className="font-medium text-slate-400">
                {segment.value}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FunnelChart({ stages, className = "" }: FunnelChartProps) {
  const visibleStages = stages.filter((stage) => stage.value >= 0);
  const maxValue = Math.max(...visibleStages.map((stage) => stage.value), 1);

  if (visibleStages.length === 0) {
    return (
      <div
        className={`flex h-48 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] text-sm text-slate-500 ${className}`}
      >
        No funnel data
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {visibleStages.map((stage, index) => {
        const width = Math.max(18, Math.round((stage.value / maxValue) * 100));
        return (
          <div key={stage.label} className="space-y-2">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-100">{stage.label}</div>
                {stage.helper ? (
                  <div className="text-xs text-slate-500">{stage.helper}</div>
                ) : null}
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-white">{stage.value}</div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                  Stage {index + 1}
                </div>
              </div>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${width}%`,
                  background: `linear-gradient(90deg, ${stage.color}, ${stage.color}cc)`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MultiSeriesTrendChart({
  labels,
  series,
  className = "",
  valueFormatter = (value) => String(Math.round(value)),
}: MultiSeriesTrendChartProps) {
  const validSeries = series.filter((entry) => entry.values.length > 0);
  const maxValue = Math.max(
    ...validSeries.flatMap((entry) => entry.values),
    1,
  );

  if (labels.length === 0 || validSeries.length === 0) {
    return (
      <div
        className={`flex h-56 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] text-sm text-slate-500 ${className}`}
      >
        No trend data
      </div>
    );
  }

  const width = 360;
  const height = 180;
  const paddingX = 10;
  const paddingY = 14;
  const step = labels.length === 1 ? 0 : (width - paddingX * 2) / (labels.length - 1);

  const buildPath = (values: number[]) =>
    values
      .map((value, index) => {
        const x = paddingX + step * index;
        const y = height - paddingY - (Math.max(value, 0) / maxValue) * (height - paddingY * 2);
        return `${index === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");

  return (
    <div className={`admin-lift rounded-2xl border border-white/10 bg-white/[0.02] p-4 ${className}`}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full">
        {[0.25, 0.5, 0.75].map((ratio) => {
          const y = height - paddingY - ratio * (height - paddingY * 2);
          return (
            <line
              key={ratio}
              x1={paddingX}
              x2={width - paddingX}
              y1={y}
              y2={y}
              stroke="rgba(148, 163, 184, 0.18)"
              strokeDasharray="4 4"
            />
          );
        })}
        {validSeries.map((entry) => (
          <path
            key={entry.label}
            d={buildPath(entry.values)}
            fill="none"
            stroke={entry.color}
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="grid grid-cols-7 gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">
        {labels.slice(-7).map((label) => (
          <span key={label} className="truncate text-center">
            {label}
          </span>
        ))}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {validSeries.map((entry) => {
          const latest = entry.values.at(-1) ?? 0;
          return (
            <div
              key={entry.label}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
            >
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.label}
              </div>
              <div className="mt-2 text-lg font-semibold text-white">
                {valueFormatter(latest)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type AdminChartPoint = Point;
