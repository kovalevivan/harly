"use client";
import { localizeStageName } from "@/lib/localize-system-text";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown as CaretDown, FileText, Users } from "lucide-react";
import { toast } from "@/lib/notification-island/toast";

import { bulkGenerateAiEvaluationsForJobAction } from "@/features/candidates/ai-actions";
import type { PipelineApplication, PipelineStage } from "@/features/pipeline/data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { cn } from "@/lib/utils";

const RECOMMENDATION_META = {
  strong_yes: { label: "Сильный да", className: "bg-primary/10 text-primary" },
  yes: { label: "Да", className: "bg-primary/10 text-primary" },
  maybe: { label: "Может быть", className: "bg-clay/15 text-clay" },
  no: { label: "Нет", className: "bg-destructive/10 text-destructive" },
} as const;

const CURRENT_RULES_VERSION = "rules-v3";

function needsEvaluation(application: PipelineApplication) {
  return (
    application.aiScore == null ||
    (application.evaluationSource === "rules" &&
      application.evaluationEngineVersion !== CURRENT_RULES_VERSION)
  );
}

function scoreTone(score: number) {
  if (score >= 60) return "text-primary";
  if (score >= 40) return "text-clay";
  return "text-destructive";
}

type JobCandidateRankingProps = {
  jobId: string;
  jobTitle: string;
  applications: PipelineApplication[];
  stages: PipelineStage[];
  aiConfigured: boolean;
};

export function JobCandidateRanking({
  jobId,
  jobTitle,
  applications,
  stages,
  aiConfigured,
}: JobCandidateRankingProps) {
  const router = useRouter();
  const [ranking, setRanking] = useState(false);
  const [showOrder, setShowOrder] = useState(false);
  const stageNameById = useMemo(
    () => new Map(stages.map((stage) => [stage.id, stage.name])),
    [stages],
  );
  const activeApplications = useMemo(
    () =>
      applications
        .filter((application) => application.status === "active")
        .slice()
        .sort((first, second) => {
          const firstScore = first.aiScore ?? -1;
          const secondScore = second.aiScore ?? -1;
          return secondScore - firstScore;
        }),
    [applications],
  );
  const scored = activeApplications.filter((application) => !needsEvaluation(application)).length;
  const unscored = activeApplications.filter(needsEvaluation).length;
  const scoredRankById = useMemo(
    () =>
      new Map(
        activeApplications
          .filter((application) => !needsEvaluation(application))
          .map((application, index) => [application.id, index + 1]),
      ),
    [activeApplications],
  );

  async function rankUnscored() {
    if (unscored === 0) return;

    setRanking(true);
    let totalSucceeded = 0;
    let totalFailed = 0;
    try {
      for (let guard = 0; guard < 100; guard++) {
        const result = await bulkGenerateAiEvaluationsForJobAction({ jobId });
        if (!result.success) {
          toast.error(
            result.reason === "not_configured"
              ? "Автоматическая оценка сейчас недоступна."
              : result.error ?? "Не удалось ранжировать кандидатов.",
          );
          return;
        }

        totalSucceeded += result.succeeded;
        totalFailed += result.failed;
        if (result.remaining === 0 || result.succeeded === 0) break;
      }

      if (totalSucceeded > 0 || totalFailed > 0) {
        toast.success(
          `Набрал ${totalSucceeded} кандидат` +
            (totalFailed > 0 ? ` · ${totalFailed} не удалось` : ""),
        );
      } else {
        toast.info("Все уже забиты.");
      }
      router.refresh();
    } catch {
      toast.error("Не удалось ранжировать кандидатов. Повторите попытку через некоторое время.");
    } finally {
      setRanking(false);
    }
  }

  /*
   * With nobody to rank, this panel used to occupy a full card explaining its
   * own emptiness , the board's first and largest element was AI apologising.
   * The pipeline already says the funnel is empty; AI staying silent is the
   * whole point of "optional guidance inside flows".
   */
  if (activeApplications.length === 0) return null;

  return (
    <Card className="border-hairline bg-pure-snow">
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            {/* Framed as a suggestion from a colleague, not a verdict. */}
            <p className="text-[14px] font-medium text-near-ink">
              {"Harly может предложить порядок кандидатов "}</p>
            <p className="truncate text-[12px] text-soft-ink">
              {unscored === 0
                ? `Все кандидаты в работе оценены (${scored}). Окончательное решение за вами.`
                : `Без оценки: ${unscored} из ${activeApplications.length} · ${jobTitle}.`}
            </p>
          </div>
          {unscored === 0 ? null : (
              <Button
                size="sm"
                variant="outline"
                onClick={rankUnscored}
                disabled={ranking}
              >
                <Users
                  className={cn(
                    "size-4",
                    ranking && "animate-pulse motion-reduce:animate-none",
                  )}
                />
                {ranking ? "Оценка…" : aiConfigured ? "Оценить остальных" : "Оценить остальных"}
              </Button>
            )}
        </div>

        {/*
          Collapsed by default. The board is what this page is for, and a
          five-row machine-ranked list sitting permanently above it means the
          first thing a recruiter reads every morning is a score, not a person.
          Open it when you want a second opinion.
        */}
        <button
          type="button"
          onClick={() => setShowOrder((value) => !value)}
          aria-expanded={showOrder}
          className="flex items-center gap-1.5 rounded-md text-[13px] font-medium text-soft-ink transition-colors hover:text-near-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-near-ink"
        >
          <CaretDown
            className={cn(
              "size-3.5 transition-transform duration-200",
              !showOrder && "-rotate-90",
            )}
          />
          {showOrder ? "Скрыть рекомендуемый порядок" : "Показать рекомендуемый порядок"}
        </button>

        {showOrder ? (
          <div className="divide-y divide-border/60 overflow-hidden rounded-lg border bg-card">
            {activeApplications.map((application) => {
              const recommendation = application.aiRecommendation;
              const meta = recommendation
                ? RECOMMENDATION_META[recommendation]
                : null;
              const hasEvaluation = application.aiScore != null && !needsEvaluation(application);

              return (
                <div
                  key={application.id}
                  className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
                >
                  <span className="w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-muted-foreground">
                    {hasEvaluation ? scoredRankById.get(application.id) : "–"}
                  </span>
                  <Link
                    href={`/dashboard/candidates/${application.candidateId}`}
                    className="flex min-w-0 flex-1 items-center gap-2.5"
                  >
                    <UserAvatar
                      name={`${application.candidateFirstName} ${application.candidateLastName}`}
                      src={application.candidateAvatarUrl}
                      fallbackSrcs={application.candidateAvatarFallbackSrcs}
                      size="sm"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {application.candidateFirstName} {application.candidateLastName}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {application.candidateHeadline ??
                          localizeStageName(stageNameById.get(application.currentStageId) ??
                          application.candidateEmail)}
                      </span>
                    </span>
                  </Link>

                  {application.aiSummary ? (
                    <p className="hidden max-w-md flex-1 truncate text-xs text-muted-foreground lg:block">
                      {application.aiSummary}
                    </p>
                  ) : null}

                  <div className="flex shrink-0 items-center gap-2">
                    {hasEvaluation && application.aiScore != null ? (
                      <>
                        {meta ? (
                          <Badge className={cn("hidden text-[11px] sm:inline-flex", meta.className)}>
                            {meta.label}
                          </Badge>
                        ) : null}
                        <span
                          className={cn(
                            "text-base font-semibold tabular-nums",
                            scoreTone(application.aiScore),
                          )}
                          title={`${application.evaluationSource === "rules" ? `Алгоритм Харли ${application.evaluationEngineVersion ?? "rules"}` : "Автоматическая оценка"}. ${application.aiUsedResume ? "На основании резюме + профиля" : "Только профиль. Нет читабельного резюме"}`}
                        >
                          {application.aiScore}
                        </span>
                      </>
                    ) : (
                      <Badge variant="outline" className="font-normal text-muted-foreground">
                        {"Не оценено "}</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {showOrder && scored > 0 ? (
          <p className="flex items-center gap-1.5 text-[12px] text-soft-ink">
            <FileText className="size-3.5 shrink-0" />
            {"На основе резюме каждого кандидата и ответов на данную вакансию. Харли может ошибаться, решать вам. "}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
