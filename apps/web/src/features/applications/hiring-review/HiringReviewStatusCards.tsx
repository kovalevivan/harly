"use client";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { reviewStatusLabels, type HiringReviewSummary } from "./summary";

export function HiringReviewStatusCards({
  applications,
  summaries,
  onOpen,
}: {
  applications: Array<{ id: string; jobTitle: string }>;
  summaries: HiringReviewSummary[];
  onOpen: (applicationId: string) => void;
}) {
  return (
    <div className="space-y-2">
      {applications.map((application) => {
        const summary = summaries.find(
          (item) => item.applicationId === application.id,
        );
        const status = summary?.status;
        const label =
          status === "needs_profile"
            ? "Открыть требования"
            : status === "queued" || status === "running"
              ? "Открыть разбор"
              : status === "failed"
                ? "Повторить разбор"
                : summary?.reviewId
                  ? "Открыть результат"
                  : "Оценить по профилю";
        return (
          <Card
            key={application.id}
            className="gap-0 py-0"
            role="region"
            aria-label={`Разбор по вакансии «${application.jobTitle}»`}
          >
            <CardContent className="flex flex-wrap items-center gap-3 px-4 py-3">
              <FileText
                aria-hidden="true"
                className="size-5 shrink-0 text-muted-foreground"
              />
              <div className="min-w-0 flex-1 basis-48 space-y-1">
                <p className="break-words text-sm font-medium">
                  {application.jobTitle}
                </p>
                <div role="status" aria-live="polite">
                  {status ? (
                    <Badge
                      variant={
                        status === "ready"
                          ? "success"
                          : status === "stale"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {reviewStatusLabels[status]}
                    </Badge>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Не удалось определить статус разбора.
                    </p>
                  )}
                </div>
                {summary?.summary && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {summary.summary}
                  </p>
                )}
                {status === "failed" && (
                  <p className="text-xs text-muted-foreground">
                    Откройте разбор, чтобы увидеть причину и повторить попытку.
                  </p>
                )}
                {status === "stale" && (
                  <p className="text-xs text-muted-foreground">
                    Требования или резюме изменились. Сохранённый результат
                    доступен; нужен новый разбор.
                  </p>
                )}
                {status === "needs_profile" && (
                  <p className="text-xs text-muted-foreground">
                    HR должен завершить подготовку требований.
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                aria-label={`${label}: ${application.jobTitle}`}
                disabled={status === "unavailable"}
                onClick={() => onOpen(application.id)}
              >
                {label}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
