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
  isForecast?: boolean;
  amountMin?: number;
  amountMax?: number;
  monthKey?: string; // used for grouping
};

export function TimeseriesChart({ transactions }: TimeseriesChartProps) {
  const [rangeFilter, setRangeFilter] = useState<"7d" | "30d" | "90d" | "180d" | "365d">("30d");
  const [showForecast, setShowForecast] = useState<boolean>(false);
  const [forecastHorizon, setForecastHorizon] = useState<"30d" | "180d" | "365d">("30d");
  
  const [hoveredPoint, setHoveredPoint] = useState<ChartDataPoint | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);

  // Filter valid transactions: "paid", "sent_to_bank", "approved" states
  const validTxns = useMemo(() => {
    return transactions.filter(t => 
      t.createdAt && ["paid", "sent_to_bank", "approved"].includes(t.state)
    );
  }, [transactions]);

  // Aggregate and format chart data based on selected filter range or forecast mode
  const chartData = useMemo(() => {
    const now = new Date();

    // ─── CASE A: HISTORICAL DATA ONLY (FORECAST MODE OFF) ───
    if (!showForecast) {
      if (rangeFilter === "180d" || rangeFilter === "365d") {
        // Group by month
        const monthsCount = rangeFilter === "180d" ? 6 : 12;
        const datesList: ChartDataPoint[] = [];

        for (let i = monthsCount - 1; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthStr = d.toLocaleDateString("en-IN", { month: "short" });
          const yearStr = d.toLocaleDateString("en-IN", { year: "2-digit" });
          const dateLabel = `${monthStr} '${yearStr}`;
          const fullDateLabel = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
          const monthKey = `${d.getFullYear()}-${d.getMonth()}`;

          datesList.push({
            dateLabel,
            fullDateLabel,
            amount: 0,
            count: 0,
            isForecast: false,
            monthKey
          });
        }

        validTxns.forEach(txn => {
          const txnDate = new Date(txn.createdAt!);
          const mKey = `${txnDate.getFullYear()}-${txnDate.getMonth()}`;
          const bucket = datesList.find(b => b.monthKey === mKey);
          if (bucket) {
            bucket.amount += (txn.totalAmount.value / 100);
            bucket.count += 1;
          }
        });

        return datesList;
      }

      // Group daily for 7d, 30d, 90d
      const historyDays = rangeFilter === "7d" ? 7 : rangeFilter === "30d" ? 30 : 90;
      const datesList: ChartDataPoint[] = [];

      for (let i = historyDays - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        d.setHours(0, 0, 0, 0);

        const dateLabel = rangeFilter === "30d"
          ? d.getDate().toString()
          : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

        const fullDateLabel = d.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "long",
          year: "numeric"
        });

        datesList.push({
          dateLabel,
          fullDateLabel,
          amount: 0,
          count: 0,
          isForecast: false
        });
      }

      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      validTxns.forEach(txn => {
        const txnDate = new Date(txn.createdAt!);
        txnDate.setHours(0, 0, 0, 0);
        
        const diffTime = todayStart.getTime() - txnDate.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 0 && diffDays < historyDays) {
          const bucketIndex = historyDays - 1 - diffDays;
          if (datesList[bucketIndex]) {
            datesList[bucketIndex].amount += (txn.totalAmount.value / 100);
            datesList[bucketIndex].count += 1;
          }
        }
      });

      return datesList;
    }

    // ─── CASE B: FORECAST MODE ACTIVE ───

    // B1: Daily Forecast Horizon (Next 30 Days)
    if (forecastHorizon === "30d") {
      const historyDays = 90;
      const datesList: ChartDataPoint[] = [];

      for (let i = historyDays - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        d.setHours(0, 0, 0, 0);

        const dateLabel = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
        const fullDateLabel = d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

        datesList.push({
          dateLabel,
          fullDateLabel,
          amount: 0,
          count: 0,
          isForecast: false
        });
      }

      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      validTxns.forEach(txn => {
        const txnDate = new Date(txn.createdAt!);
        txnDate.setHours(0, 0, 0, 0);
        const diffTime = todayStart.getTime() - txnDate.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 0 && diffDays < historyDays) {
          const bucketIndex = historyDays - 1 - diffDays;
          if (datesList[bucketIndex]) {
            datesList[bucketIndex].amount += (txn.totalAmount.value / 100);
            datesList[bucketIndex].count += 1;
          }
        }
      });

      // Linear trend calculation
      const n = datesList.length;
      if (n < 5) return datesList;

      let sumT = 0, sumV = 0, sumTV = 0, sumTT = 0;
      for (let i = 0; i < n; i++) {
        sumT += i;
        sumV += datesList[i].amount;
        sumTV += i * datesList[i].amount;
        sumTT += i * i;
      }
      const tMean = sumT / n;
      const vMean = sumV / n;
      
      let num = 0, den = 0;
      for (let i = 0; i < n; i++) {
        num += (i - tMean) * (datesList[i].amount - vMean);
        den += (i - tMean) * (i - tMean);
      }
      const slope = den === 0 ? 0 : num / den;
      const intercept = vMean - slope * tMean;

      // Seasonality coefficients
      const weekdaySum = Array(7).fill(0);
      const weekdayCount = Array(7).fill(0);
      const startOfWeekday = new Date(now);
      startOfWeekday.setDate(now.getDate() - (n - 1));

      for (let i = 0; i < n; i++) {
        const currentDate = new Date(startOfWeekday);
        currentDate.setDate(startOfWeekday.getDate() + i);
        const w = currentDate.getDay();
        weekdaySum[w] += datesList[i].amount;
        weekdayCount[w] += 1;
      }
      const weekdayAverages = weekdaySum.map((val, idx) => weekdayCount[idx] === 0 ? 0 : val / weekdayCount[idx]);
      const seasonalityFactors = weekdayAverages.map(avg => vMean === 0 ? 1.0 : avg / vMean);

      // Residual standard error
      let sumResidualSq = 0;
      for (let i = 0; i < n; i++) {
        const currentDate = new Date(startOfWeekday);
        currentDate.setDate(startOfWeekday.getDate() + i);
        const w = currentDate.getDay();
        const trendVal = slope * i + intercept;
        const residual = datesList[i].amount - (trendVal * seasonalityFactors[w]);
        sumResidualSq += residual * residual;
      }
      const rse = Math.sqrt(sumResidualSq / (n - 2 || 1));
      const confidenceBound = Math.max(rse, vMean * 0.12 || 1000);

      // Future projections
      const forecastList: ChartDataPoint[] = [];
      for (let f = 1; f <= 30; f++) {
        const futureDate = new Date(now);
        futureDate.setDate(now.getDate() + f);
        const w = futureDate.getDay();
        const tFuture = n - 1 + f;
        const trendVal = slope * tFuture + intercept;
        const forecastVal = Math.max(0, trendVal * seasonalityFactors[w]);
        
        const margin = 1.64 * confidenceBound;

        forecastList.push({
          dateLabel: futureDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
          fullDateLabel: futureDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }),
          amount: parseFloat(forecastVal.toFixed(2)),
          count: Math.round(forecastVal / 18000) || 0,
          isForecast: true,
          amountMin: parseFloat(Math.max(0, forecastVal - margin).toFixed(2)),
          amountMax: parseFloat((forecastVal + margin).toFixed(2))
        });
      }

      return [...datesList, ...forecastList];
    }

    // B2: Monthly Forecast Horizon (Next 6 Months or Next Year)
    const historyMonths = forecastHorizon === "180d" ? 6 : 12;
    const forecastMonths = forecastHorizon === "180d" ? 6 : 12;
    const datesList: ChartDataPoint[] = [];

    // History monthly aggregates
    for (let i = historyMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = d.toLocaleDateString("en-IN", { month: "short" });
      const yearStr = d.toLocaleDateString("en-IN", { year: "2-digit" });
      const dateLabel = `${monthStr} '${yearStr}`;
      const fullDateLabel = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
      const monthKey = `${d.getFullYear()}-${d.getMonth()}`;

      datesList.push({
        dateLabel,
        fullDateLabel,
        amount: 0,
        count: 0,
        isForecast: false,
        monthKey
      });
    }

    validTxns.forEach(txn => {
      const txnDate = new Date(txn.createdAt!);
      const mKey = `${txnDate.getFullYear()}-${txnDate.getMonth()}`;
      const bucket = datesList.find(b => b.monthKey === mKey);
      if (bucket) {
        bucket.amount += (txn.totalAmount.value / 100);
        bucket.count += 1;
      }
    });

    // Fit trend: Monthly aggregate volume = m * t + c
    const n = datesList.length;
    let sumT = 0, sumV = 0, sumTV = 0, sumTT = 0;
    for (let i = 0; i < n; i++) {
      sumT += i;
      sumV += datesList[i].amount;
      sumTV += i * datesList[i].amount;
      sumTT += i * i;
    }
    const tMean = sumT / n;
    const vMean = sumV / n;
    
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - tMean) * (datesList[i].amount - vMean);
      den += (i - tMean) * (i - tMean);
    }
    const slope = den === 0 ? 0 : num / den;
    const intercept = vMean - slope * tMean;

    // Monthly residual standard deviation for bounds
    let sumResidualSq = 0;
    for (let i = 0; i < n; i++) {
      const trendVal = slope * i + intercept;
      const residual = datesList[i].amount - trendVal;
      sumResidualSq += residual * residual;
    }
    const rse = Math.sqrt(sumResidualSq / (n - 2 || 1));
    const confidenceBound = Math.max(rse, vMean * 0.10 || 15000); // minimum bound envelope

    // Generate future monthly forecast
    const forecastList: ChartDataPoint[] = [];
    for (let f = 1; f <= forecastMonths; f++) {
      const futureDate = new Date(now.getFullYear(), now.getMonth() + f, 1);
      const monthStr = futureDate.toLocaleDateString("en-IN", { month: "short" });
      const yearStr = futureDate.toLocaleDateString("en-IN", { year: "2-digit" });
      
      const tFuture = n - 1 + f;
      const forecastVal = Math.max(0, slope * tFuture + intercept);
      const margin = 1.64 * confidenceBound; // 90% confidence boundaries

      forecastList.push({
        dateLabel: `${monthStr} '${yearStr}`,
        fullDateLabel: futureDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
        amount: parseFloat(forecastVal.toFixed(2)),
        count: Math.round(forecastVal / 18000) || 0,
        isForecast: true,
        amountMin: parseFloat(Math.max(0, forecastVal - margin).toFixed(2)),
        amountMax: parseFloat((forecastVal + margin).toFixed(2))
      });
    }

    return [...datesList, ...forecastList];
  }, [validTxns, rangeFilter, showForecast, forecastHorizon]);

  // Max value calculation for Y scaling
  const maxVolume = useMemo(() => {
    const vals = chartData.map(d => d.amountMax !== undefined ? d.amountMax : d.amount);
    const maxVal = Math.max(...vals, 0);
    return maxVal === 0 ? 1000 : maxVal * 1.12; 
  }, [chartData]);

  // SVG dimensions
  const width = 800;
  const height = 240;
  const paddingLeft = 65;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 35;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Compute SVG coordinates
  const points = useMemo(() => {
    return chartData.map((d, i) => {
      const x = paddingLeft + (i * chartWidth) / (chartData.length - 1 || 1);
      const y = height - paddingBottom - (d.amount * chartHeight) / maxVolume;
      const yMin = d.amountMin !== undefined ? height - paddingBottom - (d.amountMin * chartHeight) / maxVolume : y;
      const yMax = d.amountMax !== undefined ? height - paddingBottom - (d.amountMax * chartHeight) / maxVolume : y;
      return { x, y, yMin, yMax, data: d };
    });
  }, [chartData, maxVolume, chartWidth, chartHeight]);

  const historyPoints = useMemo(() => points.filter(p => !p.data.isForecast), [points]);
  const forecastPoints = useMemo(() => points.filter(p => p.data.isForecast), [points]);

  const { historyLinePath, historyAreaPath } = useMemo(() => {
    if (historyPoints.length === 0) return { historyLinePath: "", historyAreaPath: "" };
    const pointsStr = historyPoints.map(p => `${p.x},${p.y}`).join(" L ");
    const historyLinePath = `M ${pointsStr}`;
    const historyAreaPath = `M ${historyPoints[0].x},${height - paddingBottom} L ${pointsStr} L ${historyPoints[historyPoints.length - 1].x},${height - paddingBottom} Z`;
    return { historyLinePath, historyAreaPath };
  }, [historyPoints]);

  const { forecastLinePath, confidenceEnvelopePath } = useMemo(() => {
    if (forecastPoints.length === 0 || historyPoints.length === 0) {
      return { forecastLinePath: "", confidenceEnvelopePath: "" };
    }
    const lastHist = historyPoints[historyPoints.length - 1];
    const pointsList = [lastHist, ...forecastPoints];
    const forecastLinePath = `M ${pointsList.map(p => `${p.x},${p.y}`).join(" L ")}`;
    const topPointsStr = pointsList.map(p => `${p.x},${p.yMax}`).join(" L ");
    const bottomPointsStr = [...pointsList].reverse().map(p => `${p.x},${p.yMin}`).join(" L ");
    const confidenceEnvelopePath = `M ${topPointsStr} L ${bottomPointsStr} Z`;

    return { forecastLinePath, confidenceEnvelopePath };
  }, [historyPoints, forecastPoints]);

  const todayX = useMemo(() => {
    if (!showForecast || historyPoints.length === 0) return null;
    return historyPoints[historyPoints.length - 1].x;
  }, [showForecast, historyPoints]);

  // X Axis Ticks based on formatting rules
  const xTicks = useMemo(() => {
    if (showForecast) {
      if (forecastHorizon === "30d") {
        // Daily ticks (every 15 days for daily forecast to keep it clean)
        return points.filter((_, i) => i === 0 || i === 45 || i === 89 || i === 104 || i === points.length - 1);
      }
      // Monthly forecast (6M or 1Y): render ALL monthly points (historical and projected)
      return points;
    }
    if (rangeFilter === "30d") {
      return points;
    }
    if (rangeFilter === "90d") {
      return points.filter((_, i) => i % 7 === 0 || i === points.length - 1);
    }
    return points;
  }, [points, rangeFilter, showForecast, forecastHorizon]);

  const formatYAxisLabel = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}k`;
    return `₹${val.toFixed(0)}`;
  };

  const formatTooltipAmount = (val: number) => {
    return val.toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const handleMouseMove = (e: MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current || points.length === 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const svgX = (clientX / rect.width) * width;
    
    const xRatio = (svgX - paddingLeft) / chartWidth;
    let closestIndex = Math.round(xRatio * (chartData.length - 1));
    closestIndex = Math.max(0, Math.min(chartData.length - 1, closestIndex));
    
    const p = points[closestIndex];
    if (p) {
      setHoveredPoint(p.data);
      setHoveredIndex(closestIndex);
      
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

  const yTicks = [0, maxVolume * 0.33, maxVolume * 0.66, maxVolume];

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
            {showForecast ? "🔮 Automated Payout Forecast & Growth Engine" : "Transaction Volume History"}
          </h3>
          <p 
            style={{
              margin: "4px 0 0 0",
              fontSize: "12px",
              color: "var(--text-secondary)"
            }}
          >
            {showForecast 
              ? "Weekly-seasoned regression trend projecting transaction volumes & 90% confidence boundaries for selected forecast horizons."
              : "Aggregated processed payout totals across authorized subscriptions."}
          </p>
        </div>

        {/* Dynamic primary tab filters */}
        <div style={{ display: "flex", gap: "6px" }}>
          {([
            { id: "7d", label: "7 Days" },
            { id: "30d", label: "30 Days" },
            { id: "90d", label: "Quarter" },
            { id: "180d", label: "6 Months" },
            { id: "365d", label: "1 Year" }
          ] as const).map((range) => (
            <button
              key={range.id}
              onClick={() => {
                setRangeFilter(range.id);
                setShowForecast(false);
              }}
              type="button"
              style={{
                fontSize: "11px",
                fontWeight: 600,
                padding: "6px 12px",
                borderRadius: "var(--radius-md)",
                border: !showForecast && rangeFilter === range.id ? "1px solid var(--action-border)" : "1px solid var(--border)",
                background: !showForecast && rangeFilter === range.id ? "var(--action-hover-bg)" : "var(--surface)",
                color: !showForecast && rangeFilter === range.id ? "var(--action-text)" : "var(--text-secondary)",
                cursor: "pointer",
                transition: "all 120ms ease"
              }}
            >
              {range.label}
            </button>
          ))}
          <button
            onClick={() => setShowForecast(true)}
            type="button"
            style={{
              fontSize: "11px",
              fontWeight: 600,
              padding: "6px 12px",
              borderRadius: "var(--radius-md)",
              border: showForecast ? "1px solid #818CF8" : "1px solid var(--border)",
              background: showForecast ? "rgba(99, 102, 241, 0.08)" : "var(--surface)",
              color: showForecast ? "#6366F1" : "var(--text-secondary)",
              cursor: "pointer",
              transition: "all 120ms ease",
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}
          >
            <span>🔮</span>
            <span>AI Forecast</span>
          </button>
        </div>
      </div>

      {/* FORECAST PERIOD SELECTOR (Renders sub-buttons only when forecast is enabled) */}
      {showForecast && (
        <div 
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "16px",
            background: "var(--surface-subtle)",
            padding: "8px 12px",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border)",
            width: "fit-content"
          }}
        >
          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>
            Select Forecast Horizon:
          </span>
          <div style={{ display: "flex", gap: "4px" }}>
            {([
              { id: "30d", label: "Next 30 Days (Daily)" },
              { id: "180d", label: "Next 6 Months (Monthly)" },
              { id: "365d", label: "Next Year (Monthly)" }
            ] as const).map((horizon) => (
              <button
                key={horizon.id}
                onClick={() => setForecastHorizon(horizon.id)}
                type="button"
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: "var(--radius-md)",
                  border: forecastHorizon === horizon.id ? "1px solid #818CF8" : "1px solid var(--border)",
                  background: forecastHorizon === horizon.id ? "#EEF2F6" : "var(--surface)",
                  color: forecastHorizon === horizon.id ? "#4F46E5" : "var(--text-secondary)",
                  cursor: "pointer",
                  transition: "all 100ms ease"
                }}
              >
                {horizon.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ position: "relative", width: "100%", height: `${height}px` }}>
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height}`}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ display: "block", overflow: "visible", cursor: "crosshair" }}
        >
          <defs>
            <linearGradient id="chartAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--action-text)" stopOpacity="0.14" />
              <stop offset="100%" stopColor="var(--action-text)" stopOpacity="0.00" />
            </linearGradient>
            <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="var(--action-text)" floodOpacity="0.08" />
            </filter>
          </defs>

          {/* Horizontal Grid lines */}
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

          {/* Vertical segment divider lines (Grid ticks) */}
          {xTicks.map((pt, i) => (
            <line
              key={`vt-${i}`}
              x1={pt.x}
              y1={paddingTop}
              x2={pt.x}
              y2={height - paddingBottom}
              stroke="var(--border)"
              strokeWidth="0.5"
              strokeDasharray="2,2"
            />
          ))}

          {/* History line and gradient area */}
          {historyPoints.length > 0 && (
            <>
              <path d={historyAreaPath} fill="url(#chartAreaGradient)" />
              <path
                d={historyLinePath}
                fill="none"
                stroke="var(--action-text)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#shadow)"
              />
            </>
          )}

          {/* Forecast overlays */}
          {showForecast && forecastPoints.length > 0 && (
            <>
              <path
                d={confidenceEnvelopePath}
                fill="rgba(99, 102, 241, 0.06)"
                stroke="rgba(99, 102, 241, 0.12)"
                strokeWidth="1.5"
                strokeDasharray="2,2"
              />

              <path
                d={forecastLinePath}
                fill="none"
                stroke="#6366F1"
                strokeWidth="2.5"
                strokeDasharray="5,4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {todayX !== null && (
                <g>
                  <line
                    x1={todayX}
                    y1={paddingTop - 5}
                    x2={todayX}
                    y2={height - paddingBottom}
                    stroke="var(--text-secondary)"
                    strokeWidth="1.5"
                    strokeDasharray="3,3"
                  />
                  <rect
                    x={todayX - 25}
                    y={paddingTop - 12}
                    width="50"
                    height="16"
                    rx="4"
                    fill="var(--text-secondary)"
                  />
                  <text
                    x={todayX}
                    y={paddingTop}
                    textAnchor="middle"
                    fill="var(--surface)"
                    style={{ fontSize: "9px", fontFamily: "inherit", fontWeight: 700 }}
                  >
                    TODAY
                  </text>
                </g>
              )}
            </>
          )}

          {/* X Axis Tick Labels */}
          {xTicks.map((pt, i) => {
            const isDailyForecast = showForecast && forecastHorizon === "30d";
            const shouldRenderText = rangeFilter !== "30d" || isDailyForecast || i % 3 === 0 || i === xTicks.length - 1;
            if (!shouldRenderText && !showForecast) return null;
            
            return (
              <text
                key={`x-label-${i}`}
                x={pt.x}
                y={height - 12}
                textAnchor="middle"
                fill="var(--text-tertiary)"
                style={{ 
                  fontSize: rangeFilter === "30d" && !showForecast ? "9px" : "10px", 
                  fontFamily: "inherit", 
                  fontWeight: 500 
                }}
              >
                {pt.data.dateLabel}
              </text>
            );
          })}

          {/* Hover tracker cursor line and point dot */}
          {hoveredIndex !== null && points[hoveredIndex] && (
            <g>
              <line
                x1={points[hoveredIndex].x}
                y1={paddingTop}
                x2={points[hoveredIndex].x}
                y2={height - paddingBottom}
                stroke={points[hoveredIndex].data.isForecast ? "#6366F1" : "var(--action-text)"}
                strokeWidth="1.5"
                opacity="0.35"
              />
              <circle
                cx={points[hoveredIndex].x}
                cy={points[hoveredIndex].y}
                r="6"
                fill={points[hoveredIndex].data.isForecast ? "#6366F1" : "var(--action-text)"}
                stroke="var(--surface)"
                strokeWidth="2"
                style={{ filter: "drop-shadow(0px 2px 4px rgba(0,0,0,0.12))" }}
              />
            </g>
          )}
        </svg>

        {/* Floating Hover Tooltip */}
        {hoveredPoint && (
          <div
            className="ops-chart-tooltip"
            style={{
              position: "absolute",
              top: `${tooltipPos.y - 100}px`,
              left: `${tooltipPos.x}px`,
              transform: "translateX(-50%)",
              background: hoveredPoint.isForecast ? "rgba(250, 250, 255, 0.88)" : "rgba(255, 255, 255, 0.85)",
              backdropFilter: "blur(12px) saturate(180%)",
              border: hoveredPoint.isForecast ? "1px solid rgba(165, 180, 252, 0.6)" : "1px solid rgba(226, 232, 240, 0.8)",
              borderRadius: "12px",
              padding: "10px 14px",
              pointerEvents: "none",
              zIndex: 10,
              boxShadow: "0 8px 30px rgba(0, 0, 0, 0.05)",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              minWidth: "165px",
              transition: "top 80ms ease, left 80ms ease"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "9px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                {hoveredPoint.fullDateLabel}
              </span>
              {hoveredPoint.isForecast && (
                <span style={{
                  fontSize: "8px",
                  fontWeight: 700,
                  color: "#4F46E5",
                  background: "#EEF2F6",
                  padding: "1px 5px",
                  borderRadius: "999px",
                  letterSpacing: "0.03em"
                }}>
                  PROJECTION
                </span>
              )}
            </div>
            
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                {formatTooltipAmount(hoveredPoint.amount)}
              </span>
              <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-secondary)" }}>
                {hoveredPoint.count} {hoveredPoint.count === 1 ? "processed batch" : "processed batches"}
              </span>
            </div>

            {hoveredPoint.isForecast && hoveredPoint.amountMin !== undefined && hoveredPoint.amountMax !== undefined && (
              <div style={{
                marginTop: "4px",
                paddingTop: "4px",
                borderTop: "1px dashed rgba(165, 180, 252, 0.4)",
                display: "flex",
                flexDirection: "column",
                gap: "2px",
                fontSize: "10px",
                color: "#6366F1"
              }}>
                <span style={{ fontWeight: 600 }}>Confidence Boundaries:</span>
                <span style={{ color: "var(--text-secondary)", fontSize: "9px" }}>
                  Min: {formatTooltipAmount(hoveredPoint.amountMin)}
                </span>
                <span style={{ color: "var(--text-secondary)", fontSize: "9px" }}>
                  Max: {formatTooltipAmount(hoveredPoint.amountMax)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
