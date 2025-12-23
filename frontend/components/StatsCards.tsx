"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Package, Thermometer, Shield, TrendingDown, AlertTriangle } from "lucide-react";

interface StatsCardsProps {
  activeShipments?: number;
  avgTemperature?: number;
  alertCount?: number;
}

export function StatsCards({ activeShipments = 0, avgTemperature = -18, alertCount = 0 }: StatsCardsProps) {
  const [animatedValues, setAnimatedValues] = useState({
    shipments: 0,
    temperature: -18,
    alerts: 0,
  });

  // Calculate compliance rate
  const totalLogs = activeShipments;
  const compliantLogs = totalLogs - alertCount;
  const complianceRate = totalLogs > 0 ? ((compliantLogs / totalLogs) * 100).toFixed(1) : "100.0";

  // Animate values
  useEffect(() => {
    const duration = 1000;
    const steps = 30;
    const stepDuration = duration / steps;

    const animate = (start: number, end: number, setter: (val: number) => void) => {
      const diff = end - start;
      const step = diff / steps;
      let current = start;
      let stepCount = 0;

      const interval = setInterval(() => {
        stepCount++;
        current += step;
        if (stepCount >= steps) {
          setter(end);
          clearInterval(interval);
        } else {
          setter(Math.round(current));
        }
      }, stepDuration);
    };

    animate(animatedValues.shipments, activeShipments, (val) =>
      setAnimatedValues((prev) => ({ ...prev, shipments: val }))
    );
    animate(animatedValues.temperature, avgTemperature, (val) =>
      setAnimatedValues((prev) => ({ ...prev, temperature: val }))
    );
    animate(animatedValues.alerts, alertCount, (val) =>
      setAnimatedValues((prev) => ({ ...prev, alerts: val }))
    );
  }, [activeShipments, avgTemperature, alertCount]);

  const stats = [
    {
      icon: Package,
      label: "Active Shipments",
      value: animatedValues.shipments.toString(),
      description: "Currently monitored",
      gradient: "from-primary/20 to-primary/5",
      iconColor: "text-primary",
      iconBg: "bg-primary/10",
    },
    {
      icon: Thermometer,
      label: "Avg Temperature",
      value: `${animatedValues.temperature}°C`,
      description: "Across all shipments",
      gradient: "from-secondary/20 to-secondary/5",
      iconColor: "text-secondary",
      iconBg: "bg-secondary/10",
      tempColor: animatedValues.temperature < -15 ? "text-blue-500" : animatedValues.temperature > -10 ? "text-orange-500" : "text-green-500",
    },
    {
      icon: Shield,
      label: "Compliance Rate",
      value: `${complianceRate}%`,
      description: "Within safe range",
      gradient: "from-green-500/20 to-green-500/5",
      iconColor: parseFloat(complianceRate) >= 95 ? "text-green-500" : "text-orange-500",
      iconBg: parseFloat(complianceRate) >= 95 ? "bg-green-500/10" : "bg-orange-500/10",
    },
    {
      icon: AlertTriangle,
      label: "Alerts",
      value: animatedValues.alerts.toString(),
      description: "Temperature warnings",
      gradient: "from-orange-500/20 to-orange-500/5",
      iconColor: "text-orange-500",
      iconBg: "bg-orange-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, index) => (
        <Card
          key={index}
          className={`p-6 bg-gradient-to-br ${stat.gradient} border-border/40 hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:scale-105 transform group`}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
              <p className={`text-3xl font-bold transition-colors duration-300 ${stat.tempColor || "text-foreground"}`}>
                {stat.value}
              </p>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </div>
            <div className={`rounded-full ${stat.iconBg} p-3 transition-all duration-300 group-hover:scale-110 group-hover:rotate-6`}>
              <stat.icon className={`h-6 w-6 ${stat.iconColor} transition-colors duration-300`} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
