"use client";

import { cn } from "@/lib/utils";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function Sparkline({ data, width = 100, height = 30, trend, className }: SparklineProps) {
  // Handle empty or single data point
  if (data.length < 2) {
    return <span className={cn("text-muted-foreground", className)}>—</span>;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;

  // Avoid division by zero
  if (range === 0) {
    return <span className={cn("text-muted-foreground", className)}>—</span>;
  }

  // Generate path
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(" L ")}`;

  // Determine stroke color based on trend
  const getStrokeColor = () => {
    if (trend === "up") return "hsl(142 71% 45%)";
    if (trend === "down") return "hsl(0 84% 60%)";
    return "hsl(215 20% 65%)";
  };

  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative sparkline chart
    <svg
      width={width}
      height={height}
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <path
        d={pathD}
        fill="none"
        stroke={getStrokeColor()}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
