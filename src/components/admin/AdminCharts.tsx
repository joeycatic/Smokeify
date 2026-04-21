"use client";

import { useState } from "react";

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
  valueFormatter?: (value: number) => string;
};

type BarsChartProps = {
  data: Point[];
  valueFormatter?: (value: number) => string;
  colorClassName?: string;
  selectedLabel?: string;
  onSelect?: (label: string) => void;
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
  selectedLabel?: string;
  onSelect?: (label: string) => void;
};

type FunnelChartProps = {
  stages: Array<{
    label: string;
    value: number;
    helper?: string;
    color: string;
  }>;
  className?: string;
  selectedLabel?: string;
  onSelect?: (label: string) => void;
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
  valueFormatter = (value) => String(Math.round(value)),
}: SparklineChartProps) {
  const [activeIndex, setActiveIndex] = useState(data.length - 1);

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
  const boundedActiveIndex = Math.min(Math.max(activeIndex, 0), data.length - 1);
  const activePoint = data[boundedActiveIndex];
  const activeCoordinates = coordinates[boundedActiveIndex];

  return (
    <div
      className={`admin-lift rounded-2xl border border-white/10 bg-white/[0.02] p-3 ${className}`}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-28 w-full"
        onMouseLeave={() => setActiveIndex(data.length - 1)}
      >
        <path d={areaPath} className={fillClassName} />
        {activeCoordinates ? (
          <line
            x1={activeCoordinates.x}
            x2={activeCoordinates.x}
            y1={padding}
            y2={height - padding}
            stroke="rgba(148, 163, 184, 0.28)"
            strokeDasharray="4 4"
          />
        ) : null}
        <path
          d={linePath}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={strokeClassName}
          vectorEffect="non-scaling-stroke"
        />
        {coordinates.map((point, index) => (
          <g key={`${point.x}-${point.y}`}>
            <circle
              cx={point.x}
              cy={point.y}
              r={index === boundedActiveIndex ? "5.5" : "2.5"}
              className={strokeClassName.replace("stroke-", "fill-")}
              opacity={index === boundedActiveIndex ? 1 : 0.8}
            />
            <circle
              cx={point.x}
              cy={point.y}
              r="10"
              fill="transparent"
              onMouseEnter={() => setActiveIndex(index)}
            />
          </g>
        ))}
      </svg>
      <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs">
        <div className="min-w-0">
          <div className="truncate font-semibold uppercase tracking-[0.18em] text-slate-500">
            {activePoint?.label ?? "Point"}
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-100">
            {activePoint ? valueFormatter(activePoint.value) : "0"}
          </div>
        </div>
        <div className="text-right text-[11px] text-slate-500">
          {boundedActiveIndex + 1} / {data.length}
        </div>
      </div>
      <div className="admin-scroll-x mt-2">
        <div className="grid min-w-[22rem] grid-cols-7 gap-2 text-[9px] uppercase tracking-[0.14em] text-slate-500 sm:min-w-0 sm:text-[10px] sm:tracking-[0.2em]">
          {data.slice(-7).map((point) => (
            <span key={point.label} className="truncate text-center">
              {point.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HorizontalBarsChart({
  data,
  valueFormatter = (value) => String(value),
  colorClassName = "bg-cyan-400",
  selectedLabel,
  onSelect,
}: BarsChartProps) {
  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const [internalSelectedLabel, setInternalSelectedLabel] = useState<string | null>(
    data[0]?.label ?? null,
  );
  const resolvedSelectedLabel = selectedLabel ?? internalSelectedLabel;

  return (
    <div className="space-y-3">
      {data.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-slate-500">
          No data available.
        </div>
      ) : null}
      {data.map((item) => {
        const active = resolvedSelectedLabel === item.label;
        const handleSelect = () => {
          setInternalSelectedLabel(item.label);
          onSelect?.(item.label);
        };

        return (
          <button
            key={item.label}
            type="button"
            onClick={handleSelect}
            className={`block w-full space-y-1.5 rounded-2xl border px-3 py-3 text-left transition ${
              active
                ? "border-cyan-400/25 bg-cyan-400/10"
                : "border-white/10 bg-transparent hover:border-white/15 hover:bg-white/[0.03]"
            }`}
          >
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
          </button>
        );
      })}
    </div>
  );
}

export function DonutChart({
  data,
  totalLabel = "Total",
  totalValue,
  className = "",
  selectedLabel,
  onSelect,
}: DonutChartProps) {
  const normalized = data.filter((segment) => segment.value > 0);
  const total = normalized.reduce((sum, segment) => sum + segment.value, 0);
  const [internalSelectedLabel, setInternalSelectedLabel] = useState<string | null>(
    normalized[0]?.label ?? null,
  );

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
  const resolvedSelectedLabel = selectedLabel ?? internalSelectedLabel;
  const activeSegment =
    normalized.find((segment) => segment.label === resolvedSelectedLabel) ?? normalized[0];

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
            {activeSegment ? (
              <div className="mt-2 text-xs text-slate-400">
                {activeSegment.label} · {Math.round((activeSegment.value / total) * 100)}%
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {normalized.map((segment) => (
          <button
            key={segment.label}
            type="button"
            onClick={() => {
              setInternalSelectedLabel(segment.label);
              onSelect?.(segment.label);
            }}
            className={`rounded-xl border px-3 py-2 text-left transition ${
              activeSegment?.label === segment.label
                ? "border-cyan-400/25 bg-cyan-400/10"
                : "border-white/10 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]"
            }`}
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
          </button>
        ))}
      </div>
    </div>
  );
}

export function FunnelChart({
  stages,
  className = "",
  selectedLabel,
  onSelect,
}: FunnelChartProps) {
  const visibleStages = stages.filter((stage) => stage.value >= 0);
  const maxValue = Math.max(...visibleStages.map((stage) => stage.value), 1);
  const [internalSelectedLabel, setInternalSelectedLabel] = useState<string | null>(
    visibleStages[0]?.label ?? null,
  );

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
        const active = (selectedLabel ?? internalSelectedLabel) === stage.label;
        return (
          <button
            key={stage.label}
            type="button"
            onClick={() => {
              setInternalSelectedLabel(stage.label);
              onSelect?.(stage.label);
            }}
            className={`block w-full space-y-2 rounded-2xl border px-3 py-3 text-left transition ${
              active
                ? "border-cyan-400/25 bg-cyan-400/10"
                : "border-white/10 bg-transparent hover:border-white/15 hover:bg-white/[0.03]"
            }`}
          >
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
          </button>
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
  const [activeIndex, setActiveIndex] = useState(labels.length - 1);
  const maxValue = Math.max(
    ...validSeries.flatMap((entry) => entry.values),
    1,
  );
  const boundedActiveIndex = Math.min(Math.max(activeIndex, 0), labels.length - 1);
  const activeValues = validSeries.map((entry) => ({
    ...entry,
    activeValue: entry.values[boundedActiveIndex] ?? 0,
  }));

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
  const activeX = paddingX + step * boundedActiveIndex;

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
      <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          {labels[boundedActiveIndex] ?? "Trend point"}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          {activeValues.map((entry) => (
            <div key={entry.label} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-slate-400">{entry.label}</span>
              <span className="font-semibold text-slate-100">
                {valueFormatter(entry.activeValue)}
              </span>
            </div>
          ))}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-44 w-full"
        onMouseLeave={() => setActiveIndex(labels.length - 1)}
      >
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
        <line
          x1={activeX}
          x2={activeX}
          y1={paddingY}
          y2={height - paddingY}
          stroke="rgba(148, 163, 184, 0.24)"
          strokeDasharray="4 4"
        />
        {validSeries.map((entry) => (
          <g key={entry.label}>
            <path
              d={buildPath(entry.values)}
              fill="none"
              stroke={entry.color}
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
            />
            {entry.values[boundedActiveIndex] !== undefined ? (
              <circle
                cx={activeX}
                cy={
                  height -
                  paddingY -
                  (Math.max(entry.values[boundedActiveIndex] ?? 0, 0) / maxValue) *
                    (height - paddingY * 2)
                }
                r="4"
                fill={entry.color}
              />
            ) : null}
          </g>
        ))}
        {labels.map((label, index) => {
          const x = paddingX + step * index;
          return (
            <rect
              key={label}
              x={x - Math.max(step / 2, 10)}
              y={0}
              width={Math.max(step, 20)}
              height={height}
              fill="transparent"
              onMouseEnter={() => setActiveIndex(index)}
            />
          );
        })}
      </svg>
      <div className="admin-scroll-x">
        <div className="grid min-w-[22rem] grid-cols-7 gap-2 text-[9px] uppercase tracking-[0.14em] text-slate-500 sm:min-w-0 sm:text-[10px] sm:tracking-[0.2em]">
          {labels.slice(-7).map((label) => (
            <span key={label} className="truncate text-center">
              {label}
            </span>
          ))}
        </div>
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
