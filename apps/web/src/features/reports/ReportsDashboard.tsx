"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  Clock,
  Download,
  Funnel,
  Hourglass,
  LineChart,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { Tile, tileClass } from "@/components/dashboard/widgets/primitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toSafeCsv } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import {
  FunnelChart,
  Histogram,
  SourceBars,
  TrendChart,
  type SourceDatum,
  type TrendSeries,
} from "./charts";
import type { ReportsData } from "./data";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

const RANGE_OPTIONS = [
  { value: "30", label: "Последние 30 дней" },
  { value: "90", label: "Последние 90 дней" },
  { value: "365", label: "Последние 12 месяцев" },
];

function formatSource(source: string) {
  if (source === "unknown") return "Неизвестно";
  return source.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type IconComponent = React.ComponentType<{ className?: string; strokeWidth?: number }>;

function EmptyPanel({ icon: Icon, text }: { icon: IconComponent; text: string }) {
  return (
    <div className="m-3 flex flex-1 flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-mist-border px-6 py-10 text-center">
      <Icon className="size-5 text-quiet-mist" strokeWidth={1.6} />
      <p className="text-sm text-soft-ink">{text}</p>
    </div>
  );
}

function DeltaBadge({ value, invert = false }: { value: number; invert?: boolean }) {
  const positive = invert ? value <= 0 : value >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  const shown = invert ? -value : value;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
        positive ? "bg-success-olive/10 text-success-olive" : "bg-danger-rust/10 text-danger-rust",
      )}
    >
      <Icon className="size-3" />
      {shown >= 0 ? "+" : ""}
      {shown}%
    </span>
  );
}

function StatCell({
  icon: Icon,
  label,
  value,
  hint,
  delta,
  invertDelta,
  index,
}: {
  icon: IconComponent;
  label: string;
  value: string;
  hint: string;
  delta?: number | null;
  invertDelta?: boolean;
  index: number;
}) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE_OUT, delay: index * 0.05 }}
      className="p-4 sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex size-8 items-center justify-center rounded-[var(--radius-sm)] bg-warm-paper text-soft-ink">
          <Icon className="size-4" strokeWidth={1.8} />
        </span>
        {typeof delta === "number" ? (
          <DeltaBadge value={delta} invert={invertDelta} />
        ) : null}
      </div>
      <p className="mt-4 text-xs font-medium text-soft-ink">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-near-ink">{value}</p>
      <p className="mt-1 truncate text-xs text-soft-ink">{hint}</p>
    </motion.div>
  );
}

function CardHead({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: IconComponent;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="space-y-0.5">
      <h2 className="flex items-center gap-2 text-[15px] font-medium text-near-ink">
        <Icon className="size-4 text-soft-ink" strokeWidth={1.8} />
        {title}
      </h2>
      <p className="text-sm text-soft-ink">{subtitle}</p>
    </div>
  );
}

export function ReportsDashboard({ data }: { data: ReportsData }) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const totalApplications = data.applicationsByMonth.reduce((s, p) => s + p.count, 0);
  const last12Hires = data.hiresByMonth.reduce((s, p) => s + p.count, 0);
  const topSource = data.sources[0];
  const { comparison } = data;

  const trendSeries: TrendSeries[] = useMemo(
    () => [
      {
        key: "applications",
        label: "Отклики",
        color: "var(--chart-1)",
        points: data.applicationsByMonth.map((p) => ({ label: p.label, sub: p.month, value: p.count })),
      },
      {
        key: "hires",
        label: "Наняты",
        color: "var(--chart-2)",
        points: data.hiresByMonth.map((p) => ({ label: p.label, sub: p.month, value: p.count })),
      },
    ],
    [data.applicationsByMonth, data.hiresByMonth],
  );

  const sourceData: SourceDatum[] = useMemo(
    () => data.sources.map((s) => ({ ...s, label: formatSource(s.source) })),
    [data.sources],
  );

  const rangeLabel =
    RANGE_OPTIONS.find((o) => Number(o.value) === comparison.rangeDays)?.label ??
    `Последние ${comparison.rangeDays} дней`;

  function exportReportCsv() {
    const rows: string[][] = [
      ["Метрика", "Период", "Значение"],
      ["Отклики", rangeLabel, String(comparison.applications.current)],
      ["Отклики", "Предыдущий период", String(comparison.applications.previous)],
      ["Наняты", rangeLabel, String(comparison.hires.current)],
      ["Наняты", "Предыдущий период", String(comparison.hires.previous)],
      ["Среднее время найма (дней)", rangeLabel, String(comparison.avgTimeToHireDays.current)],
      ["Принятие предложения (%)", "Все время", String(data.summary.offerAcceptRate ?? "")],
      [],
      ["Заявки по месяцам", "Месяц", "Граф"],
      ...data.applicationsByMonth.map((point) => ["Отклики", point.month, String(point.count)]),
      [],
      ["Нанимает по месяцам", "Месяц", "Граф"],
      ...data.hiresByMonth.map((point) => ["Наняты", point.month, String(point.count)]),
      [],
      ["Источник", "Кандидаты", "Наняты", "Конверсия (%)"],
      ...data.sources.map((source) => [source.source, String(source.candidates), String(source.hires), String(source.conversion)]),
    ];
    const blob = new Blob([String.fromCharCode(0xfeff) + toSafeCsv(rows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `harly-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const stats = [
    {
      icon: Users,
      label: "Отклики",
      value: comparison.applications.current.toLocaleString("ru-RU"),
      hint: `${data.summary.applications90d.toLocaleString("ru-RU")} за последние 90 дней`,
      delta: comparison.applications.deltaPct,
    },
    {
      icon: Briefcase,
      label: "Наняты",
      value: comparison.hires.current.toLocaleString("ru-RU"),
      hint: `${data.summary.hires.toLocaleString("ru-RU")} нанимает постоянно`,
      delta: comparison.hires.deltaPct,
    },
    {
      icon: Clock,
      label: "Среднее время найма",
      value: comparison.avgTimeToHireDays.current > 0 ? `${comparison.avgTimeToHireDays.current}d` : "No data",
      hint:
        comparison.avgTimeToHireDays.previous > 0
          ? `${comparison.avgTimeToHireDays.previous}d предыдущего периода`
          : "Нет предварительных данных",
      delta: comparison.avgTimeToHireDays.deltaPct,
      invertDelta: true,
    },
    {
      icon: TrendingUp,
      label: "Принятие предложения",
      value: data.summary.offerAcceptRate != null ? `${data.summary.offerAcceptRate}%` : "No data",
      hint: topSource ? `${formatSource(topSource.source)} объем источника лидов` : "Исходных данных пока нет",
      delta: null,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-near-ink">{"Отчеты"}</h1>
          <p className="mt-1 text-sm text-soft-ink">
            {`Производительность найма и состояние конвейера, ${rangeLabel.toLowerCase()}.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={String(comparison.rangeDays)}
            onValueChange={(v) => router.push(`/dashboard/reports?range=${v}`)}
          >
            <SelectTrigger className="h-9 w-auto min-w-40 text-sm">
              <SelectValue>{rangeLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportReportCsv}>
            <Download className="size-4" />
            {"Экспортировать CSV "}</Button>
        </div>
      </div>

      <div
        className={cn(
          tileClass,
          "grid grid-cols-1 divide-y divide-hairline sm:grid-cols-2 sm:divide-y-0 sm:divide-x xl:grid-cols-4",
        )}
      >
        {stats.map((s, i) => (
          <StatCell key={s.label} {...s} index={i} />
        ))}
      </div>

      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.15 }}
      >
        <Tile className="gap-5 p-5">
          <CardHead icon={LineChart} title={"Динамика найма"} subtitle={"Полученные заявки и принятые на работу по месяцам."} />
          <TrendChart series={trendSeries} />
        </Tile>
      </motion.div>

      <motion.section
        initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.2 }}
        className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"
      >
        <Tile className="gap-5 p-5">
          <CardHead icon={Funnel} title={"Конвейер по этапам"} subtitle={"Где сейчас сидят активные кандидаты."} />
          {data.funnel.some((s) => s.count > 0) ? (
            <FunnelChart stages={data.funnel} />
          ) : (
            <EmptyPanel icon={Funnel} text={"Распределение по этапам появляется, как только кандидаты проходят через ваш конвейер."} />
          )}
        </Tile>

        <Tile className="gap-5 p-5">
          <CardHead icon={Hourglass} title={"Время нанимать"} subtitle={"Сколько времени заняло заполненные должности, от подачи заявки до приема на работу."} />
          <Histogram data={data.timeToHire} />
        </Tile>
      </motion.section>

      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.25 }}
      >
        <Tile className="gap-5 p-5">
          <CardHead icon={Target} title={"Эффективность источника"} subtitle={"Конверсия объема и найма по источнику приложения."} />
          {sourceData.length ? (
            <SourceBars sources={sourceData} />
          ) : (
            <EmptyPanel icon={Users} text={"Заявок пока нет. Источники появляются после подачи заявки кандидатами."} />
          )}
        </Tile>
      </motion.div>

      <p className="px-1 text-xs text-soft-ink">
        {`${totalApplications.toLocaleString("ru-RU")} заявлений · ${last12Hires.toLocaleString("ru-RU")} наймов за последние 12 месяцев · ${data.summary.totalCandidates.toLocaleString("ru-RU")} отслеживаемых кандидатов · по сравнению с ${rangeLabel.toLowerCase()}.`}
      </p>
    </div>
  );
}
