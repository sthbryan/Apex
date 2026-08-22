import { cn } from "@/lib/cn";

export type SparkTone = "neutral" | "accent" | "working" | "done" | "blocked" | "failed";

export interface SparkProps {
  points: number[];
  tone?: SparkTone;
  height?: number;
  max?: number;
  area?: boolean;
  label?: string;
  class?: string;
}

const WIDTH = 300;

function path(points: number[], height: number, max: number) {
  const step = points.length > 1 ? WIDTH / (points.length - 1) : WIDTH;
  const y = (v: number) => height - Math.min(Math.max(v / max, 0), 1) * height;
  let d = `M0 ${y(points[0])}`;
  for (let i = 1; i < points.length; i++) {
    const px = (i - 1) * step;
    const cx = i * step;
    d += ` Q${px} ${y(points[i - 1])} ${(px + cx) / 2} ${(y(points[i - 1]) + y(points[i])) / 2}`;
  }
  d += ` L${(points.length - 1) * step} ${y(points[points.length - 1])}`;
  return d;
}

export function Spark({
  points,
  tone = "working",
  height = 54,
  max,
  area = true,
  label,
  class: className,
}: SparkProps) {
  if (points.length === 0) return null;
  const ceiling = max ?? Math.max(...points, 1);
  const line = path(points, height, ceiling);
  return (
    <svg
      class={cn("ui-spark", className)}
      data-tone={tone}
      style={{ "--ui-spark-height": `${height}px` }}
      viewBox={`0 0 ${WIDTH} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      {area ? <path class="ui-spark-area" d={`${line} L${WIDTH} ${height} L0 ${height} Z`} /> : null}
      <path class="ui-spark-line" d={line} />
    </svg>
  );
}
