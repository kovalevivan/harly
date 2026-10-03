import Link from "next/link";
import type { Route } from "next";
import { TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { RiskJob } from "@/features/dashboard/widgets";
import { Tile, TileHeader, TileLink, EmptyHint } from "./primitives";

const severityVariant: Record<
  RiskJob["severity"],
  "destructive" | "danger" | "warning"
> = {
  critical: "destructive",
  danger: "danger",
  warning: "warning",
};

const severityLabel: Record<RiskJob["severity"], string> = {
  critical: "Критический",
  danger: "В зоне риска",
  warning: "Требует внимания",
};

export function JobsAtRisk({
  jobs,
  className,
}: {
  jobs: RiskJob[];
  className?: string;
}) {
  return (
    <Tile className={className}>
      <TileHeader
        icon={TriangleAlert}
        title={"Рабочие места под угрозой"}
        action={<TileLink href="/dashboard/jobs">{"Посмотреть все"}</TileLink>}
      />
      <div className="flex flex-1 flex-col px-2 pb-2 pt-1">
        {jobs.length > 0 ? (
          <ul className="flex-1 divide-y divide-border/60">
            {jobs.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/dashboard/jobs/${job.id}` as Route}
                  className="group flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-muted/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{job.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {job.reason}
                    </p>
                  </div>
                  <Badge
                    variant={severityVariant[job.severity]}
                    className="shrink-0"
                  >
                    {severityLabel[job.severity]}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyHint
            icon={TriangleAlert}
            text={"Каждая открытая роль находится на правильном пути. Хорошая работа."}
          />
        )}
      </div>
    </Tile>
  );
}
