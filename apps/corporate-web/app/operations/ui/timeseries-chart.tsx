"use client";

import { useState, useMemo, useRef, MouseEvent } from "react";
import type { PayoutBatch } from "../../../lib/types";

interface TimeseriesChartProps {
  transactions: PayoutBatch[];
}

type ChartDataPoint = {
  dateLabel: string;
  fullDateLabel: string;
  amount: number; // in INR (Rupees)
  count: number;
};

export function TimeseriesChart({ transactions }: TimeseriesChartProps) {
  const [rangeFilter, setRangeFilter] = useState<"7d" | "30d" | "90d">("7d");
  const [hoveredPoint, setHoveredPoint] = useState<ChartDataPoint | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Filter and aggregate transactions day-by-day
  const chartData = useMemo(() => {
    const now = new Date();
    const daysToGenerate = rangeFilter === "7d" ? 7 : rangeFilter === "30d" ? 30 : 90;
    
    // Create base data structure for the last N days
    const datesList: ChartDataPoint[] = [];
    for (let i = daysToGenerate - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);

      // Date labels
      const dateLabel = d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short"
      });
      const fullDateLabel = d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });

      datesList.push({
        dateLabel,
        fullDateLabel,
        amount: 0,
        count: 0
      });
    }

    // Filter valid transactions: "paid", "sent_to_bank", "approved" states
    const validTxns = transactions.filter(t => 
      t.createdAt && ["paid", "sent_to_bank", "approved"].includes(t.state)
    );

    // Map transactions to date buckets
    validTxns.forEach(txn => {
      const txnDate = new Date(txn.createdAt!);
      txnDate.setHours(0, 0, 0, 0);
      
      const diffTime = now.getTime() - txnDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays >= 0 && diffDays < daysToGenerate) {
        // Find matching date bucket (daysToGenerate - 1 - diffDays)
        const bucketIndex = daysToGenerate - 1 - diffDays;
        if (datesList[bucketIndex]) {
          datesList[bucketIndex].amount += (txn.totalAmount.value / 100);
          datesList[bucketIndex].count += 1;
        }
      }
    });

    return datesList;
  }, [transactions, rangeFilter]);

  // Max value calculation for Y scaling
  const maxVolume = useMemo(() => {
    const maxVal = Math.max(...chartData.map(d => d.amount), 0);
    // Fallback if no volume, prevents divide by zero
    return maxVal === 0 ? 1000 : maxVal * 1.15; 
  }, [chartData]);

  // Dimension details for scaling SVG
  const width = 800;
  const height = 240;
  const paddingLeft = 60;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 35;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Compute SVG coordinates for data points
  const points = useMemo(() => {
    return chartData.map((d, i) => {
      const x = paddingLeft + (i * chartWidth) / (chartData.length - 1 || 1);
      const y = height - paddingBottom - (d.amount * chartHeight) / maxVolume;
      return { x, y, data: d };
    });
  }, [chartData, maxVolume, chartWidth, chartHeight]);

  // Build SVG Path strings
  const { linePath, areaPath } = useMemo(() => {
    if (points.length === 0) return { linePath: "", areaPath: "" };

    const linePointsStr = points.map(p => `${p.x},${p.y}`).join(" L ");
    const linePath = `M ${linePointsStr}`;
    const areaPath = `M ${points[0].x},${height - paddingBottom} L ${linePointsStr} L ${points[points.length - 1].x},${height - paddingBottom} Z`;

    return { linePath, areaPath };
  }, [points]);

  // Formatter for metric details
  const formatTooltipAmount = (val: number) => {
    return val.toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Formatter for Y-axis labels
  const formatYAxisLabel = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}k`;
    return `₹${val.toFixed(0)}`;
  };

  // Handle hover movements over chart area
  const handleMouseMove = (e: MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current || points.length === 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    
    // Scale clientX relative to SVG viewBox width
    const svgX = (clientX / rect.width) * width;
    
    // Find closest point by X coordinate
    const xRatio = (svgX - paddingLeft) / chartWidth;
    let closestIndex = Math.round(xRatio * (chartData.length - 1));
    
    // Clamp index boundaries
    closestIndex = Math.max(0, Math.min(chartData.length - 1, closestIndex));
    
    const p = points[closestIndex];
    if (p) {
      setHoveredPoint(p.data);
      setHoveredIndex(closestIndex);
      
      // Calculate tooltip position (absolute values in browser)
      const containerRect = containerRef.current.getBoundingClientRect();
      const pointScreenX = (p.x / width) * containerRect.width;
      const pointScreenY = (p.y / height) * containerRect.height;

      setTooltipPos({
        x: pointScreenX,
        y: pointScreenY
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
    setHoveredIndex(null);
  };

  // Generates 4 horizontal gridlines
  const yTicks = [0, maxVolume * 0.33, maxVolume * 0.66, maxVolume];

  // Generates logical X-axis date intervals to prevent cluttering
  const xTicks = useMemo(() => {
    const interval = rangeFilter === "7d" ? 1 : rangeFilter === "30d" ? 5 : 15;
    return points.filter((_, i) => i % interval === 0 || i === points.length - 1);
  }, [points, rangeFilter]);

  return (
    <div 
      ref={containerRef}
      className="ops-chart-card"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-xl)",
        padding: "24px",
        boxShadow: "var(--shadow-sm)",
        marginBottom: "28px",
        position: "relative"
      }}
    >
      {/* Header section */}
      <div 
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px"
        }}
      >
        <div>
          <h3 
            style={{
              margin: 0,
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--text-primary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em"
            }}
          >
            Transaction Volume History
          </h3>
          <p 
            style={{
              margin: "4px 0 0 0",
              fontSize: "12px",
              color: "var(--text-secondary)"
            }}
          >
            Aggregated daily processed payout totals across authorized subscriptions.
          </p>
        </div>

        {/* Chart Filter Select */}
        <div style={{ display: "flex", gap: "6px" }}>
          {(["7d", "30d", "90d"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setRangeFilter(range)}
              type="button"
              style={{
                fontSize: "11px",
                fontWeight: 600,
                padding: "6px 12px",
                borderRadius: "var(--radius-md)",
                border: rangeFilter === range ? "1px solid var(--action-border)" : "1px solid var(--border)",
                background: rangeFilter === range ? "var(--action-hover-bg)" : "var(--surface)",
                color: rangeFilter === range ? "var(--action-text)" : "var(--text-secondary)",
                cursor: "pointer",
                transition: "all 120ms ease"
              }}
            >
              {range === "7d" ? "7 Days" : range === "30d" ? "30 Days" : "90 Days (Quarter)"}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Timeseries Graph */}
      <div style={{ position: "relative", width: "100%", height: `${height}px` }}>
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height}`}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ display: "block", overflow: "visible", cursor: "crosshair" }}
        >
          {/* Gradients definitions */}
          <defs>
            <linearGradient id="chartAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--action-text)" stopOpacity="0.14" />
              <stop offset="100%" stopColor="var(--action-text)" stopOpacity="0.00" />
            </linearGradient>
            <linearGradient id="chartLineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--action-text)" />
              <stop offset="100%" stopColor="var(--action-text)" />
            </linearGradient>
            <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="var(--action-text)" floodOpacity="0.08" />
            </filter>
          </defs>

          {/* Grid lines (horizontal) */}
          {yTicks.map((tick, i) => {
            const tickY = height - paddingBottom - (tick * chartHeight) / maxVolume;
            return (
              <g key={`grid-${i}`}>
                <line
                  x1={paddingLeft}
                  y1={tickY}
                  x2={width - paddingRight}
                  y2={tickY}
                  stroke="var(--border)"
                  strokeWidth="1"
                  strokeDasharray="4,4"
                />
                <text
                  x={paddingLeft - 10}
                  y={tickY + 4}
                  textAnchor="end"
                  fill="var(--text-tertiary)"
                  style={{ fontSize: "10px", fontFamily: "inherit", fontWeight: 500 }}
                >
                  {formatYAxisLabel(tick)}
                </text>
              </g>
            );
          })}

          {/* Timeseries paths */}
          {points.length > 0 && (
            <>
              {/* Gradient Filled Area */}
              <path d={areaPath} fill="url(#chartAreaGradient)" />

              {/* Volume Line */}
              <path
                d={linePath}
                fill="none"
                stroke="url(#chartLineGradient)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#shadow)"
              />
            </>
          )}

          {/* X Axis Labels */}
          {xTicks.map((pt, i) => (
            <text
              key={`x-label-${i}`}
              x={pt.x}
              y={height - 12}
              textAnchor="middle"
              fill="var(--text-tertiary)"
              style={{ fontSize: "10px", fontFamily: "inherit", fontWeight: 500 }}
            >
              {pt.data.dateLabel}
            </text>
          ))}

          {/* Hover highlight line and point */}
          {hoveredIndex !== null && points[hoveredIndex] && (
            <g>
              <line
                x1={points[hoveredIndex].x}
                y1={paddingTop}
                x2={points[hoveredIndex].x}
                y2={height - paddingBottom}
                stroke="var(--action-text)"
                strokeWidth="1.5"
                opacity="0.3"
              />
              <circle
                cx={points[hoveredIndex].x}
                cx-shadow="true"
                cy={points[hoveredIndex].y}
                r="6"
                fill="var(--action-text)"
                stroke="var(--surface)"
                strokeWidth="2"
                style={{ filter: "drop-shadow(0px 2px 4px rgba(0,0,0,0.12))" }}
              />
            </g>
          )}
        </svg>

        {/* Floating Tooltip */}
        {hoveredPoint && (
          <div
            className="ops-chart-tooltip"
            style={{
              position: "absolute",
              top: `${tooltipPos.y - 85}px`,
              left: `${tooltipPos.x}px`,
              transform: "translateX(-50%)",
              background: "rgba(255, 255, 255, 0.82)",
              backdropFilter: "blur(12px) saturate(180%)",
              border: "1px solid rgba(226, 232, 240, 0.8)",
              borderRadius: "10px",
              padding: "10px 14px",
              pointerEvents: "none",
              zIndex: 10,
              boxShadow: "0 8px 30px rgba(0, 0, 0, 0.05)",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              minWidth: "140px",
              transition: "top 80ms ease, left 80ms ease"
            }}
          >
            <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.02em" }}>
              {hoveredPoint.fullDateLabel}
            </span>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                {formatTooltipAmount(hoveredPoint.amount)}
              </span>
              <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-secondary)" }}>
                {hoveredPoint.count} {hoveredPoint.count === 1 ? "transaction" : "transactions"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
