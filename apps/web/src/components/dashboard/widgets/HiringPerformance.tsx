"use client";

import { useState } from "react";
import { BarChart3, TrendingDown, TrendingUp } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { HiringPerformance as PerfData } from "@/features/dashboard/widgets";
import { cn } from "@/lib/utils";
import { Tile } from "./primitives";
import { PerformanceChart } from "./PerformanceChart";

type ChartMetric = "applications" | "interviews" | "hires";

const CHART_METRICS: { key: ChartMetric; label: string }[] = [
  { key: "applications", label: "Отклики" },
  { key: "interviews", label: "Собеседования" },
  { key: "hires", label: "Наняты" },
];

export function HiringPerformance({
  data,
  className,
}: {
  data: PerfData;
  className?: string;
}) {
  const [metric, setMetric] = useState<ChartMetric>("applications");

  const kpis = [
    { label: "Отклики", ...data.metrics.applications },
    { label: "Собеседования", ...data.metrics.interviews },
    { label: "Наняты", ...data.metrics.hires },
    { label: "Доля принятых предложений", ...data.metrics.offerAcceptance },
  ];

  return (
    <Tile className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <BarChart3 className="size-4 text-muted-foreground" strokeWidth={1.8} />
          {"Показатели найма "}</h2>
        <div className="flex items-center gap-2">
          <Select value={metric} onValueChange={(v) => setMetric(v as ChartMetric)}>
            <SelectTrigger size="sm" className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHART_METRICS.map((m) => (
                <SelectItem key={m.key} value={m.key}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-5 px-5 pb-5 pt-4 lg:grid-cols-[minmax(260px,0.9fr)_1.3fr]">
        <div className="grid grid-cols-2 gap-3">
          {kpis.map((kpi) => {
            const up = kpi.deltaPct >= 0;
            return (
              <div
                key={kpi.label}
                className="rounded-xl border border-border/60 bg-background/40 p-4"
              >
                <p className="truncate text-xs text-muted-foreground">{kpi.label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {kpi.isRate ? `${kpi.value}%` : kpi.value}
                </p>
                <p
                  className={cn(
                    "mt-1 flex items-center gap-1 text-xs font-medium",
                    up ? "text-primary" : "text-destructive",
                  )}
                >
                  {up ? (
                    <TrendingUp className="size-3.5" strokeWidth={1.8} />
                  ) : (
                    <TrendingDown className="size-3.5" strokeWidth={1.8} />
                  )}
                  {up ? "+" : ""}
                  {kpi.deltaPct}
                  {kpi.isRate ? "pp" : "%"}
                  <span className="font-normal text-muted-foreground">
                    {"к предыдущим 14 дням "}</span>
                </p>
              </div>
            );
          })}
        </div>

        <div className="flex min-w-0 items-center">
          <PerformanceChart points={data.series[metric]} />
        </div>
      </div>
    </Tile>
  );
}
