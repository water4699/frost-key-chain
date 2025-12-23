"use client";

import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import type { TemperatureLog } from "@/hooks/useColdChainTracker";

interface TemperatureChartProps {
  logs: TemperatureLog[];
}

export const TemperatureChart = ({ logs }: TemperatureChartProps) => {
  // Filter and prepare chart data
  const chartData = logs
    .filter((log) => log.decryptedTemperature !== undefined)
    .map((log) => ({
      time: new Date(log.timestamp * 1000).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      fullTime: new Date(log.timestamp * 1000).toLocaleString(),
      temperature: log.decryptedTemperature,
      location: log.location,
      cargo: log.cargo,
      isWarning: log.isWarning,
    }))
    .sort((a, b) => {
      const timeA = logs.find((l) => l.decryptedTemperature === a.temperature)?.timestamp || 0;
      const timeB = logs.find((l) => l.decryptedTemperature === b.temperature)?.timestamp || 0;
      return timeA - timeB;
    });

  if (chartData.length === 0) {
    return (
      <Card className="p-8 bg-gradient-to-br from-card to-primary/5 border-primary/20">
        <div className="text-center">
          <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Temperature Data</h3>
          <p className="text-muted-foreground text-sm">
            Decrypt temperature readings to view the trend chart
          </p>
        </div>
      </Card>
    );
  }

  // Calculate trend
  const temperatures = chartData.map((d) => d.temperature);
  const firstTemp = temperatures[0];
  const lastTemp = temperatures[temperatures.length - 1];
  const trend = lastTemp - firstTemp;
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend > 2 ? "text-orange-500" : trend < -2 ? "text-blue-500" : "text-green-500";

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border rounded-lg shadow-lg p-3">
          <p className="font-semibold text-foreground mb-2">{data.fullTime}</p>
          <div className="space-y-1">
            <p className="text-sm">
              <span className="text-muted-foreground">Temperature: </span>
              <span className={`font-bold ${data.isWarning ? "text-orange-500" : "text-primary"}`}>
                {data.temperature}°C
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              <span>Location: </span>
              <span className="font-medium">{data.location}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              <span>Cargo: </span>
              <span className="font-medium">{data.cargo}</span>
            </p>
            {data.isWarning && (
              <p className="text-xs text-orange-500 font-semibold mt-2">⚠️ Out of Range</p>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-primary/5 border-primary/20 hover:shadow-lg transition-all duration-300">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Temperature Trend
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time temperature monitoring over time
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background/80 border border-border">
            <TrendIcon className={`h-5 w-5 ${trendColor}`} />
            <div>
              <p className="text-xs text-muted-foreground">Trend</p>
              <p className={`text-sm font-bold ${trendColor}`}>
                {trend > 0 ? "+" : ""}
                {trend.toFixed(1)}°C
              </p>
            </div>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorTemperature" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
          <XAxis
            dataKey="time"
            stroke="hsl(var(--muted-foreground))"
            style={{ fontSize: "12px" }}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            style={{ fontSize: "12px" }}
            label={{ value: "°C", position: "insideLeft", style: { textAnchor: "middle" } }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="temperature"
            stroke="hsl(var(--primary))"
            strokeWidth={3}
            fill="url(#colorTemperature)"
            dot={{ fill: "hsl(var(--primary))", r: 4 }}
            activeDot={{ r: 6, fill: "hsl(var(--primary))" }}
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="mt-4 flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span className="text-muted-foreground">Temperature Readings</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-500" />
          <span className="text-muted-foreground">Out of Range</span>
        </div>
      </div>
    </Card>
  );
};

