"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  ClipboardCheck,
  Mail,
  MessageSquare,
  Plus,
} from "lucide-react";

import { getHiringReviewStatusesAction } from "@/features/applications/hiring-review/actions";
import { HiringReviewStatusCards } from "@/features/applications/hiring-review/HiringReviewStatusCards";
import type { HiringReviewSummary } from "@/features/applications/hiring-review/summary";
import { russianPlural } from "@/lib/russian-plural";
import { AiScoreCard } from "@/features/candidates/AiScoreCard";
import { CandidateDetailsPanel } from "@/features/candidates/CandidateDetailsPanel";
import { EmailDrawer } from "@/features/candidates/EmailDrawer";
import { EvaluationDrawer } from "@/features/candidates/EvaluationDrawer";
import { NoteForm } from "@/features/candidates/NoteForm";
import { ScheduleDrawer } from "@/features/candidates/ScheduleDrawer";
import { OffersPanel } from "@/features/offers/OffersPanel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ActivityTimeline } from "./candidate-profile/ActivityTimeline";
import { ConversationThread } from "./candidate-profile/ConversationThread";
import { InterviewCard } from "./candidate-profile/InterviewCard";
import { PrivacyRequestCard } from "./candidate-profile/PrivacyRequestCard";
import { ScorecardList } from "./candidate-profile/ScorecardList";
import { EmptySection, TabCount } from "./candidate-profile/shared";
import type {
  CandidateMessage,
  CandidateProfileTabsProps,
} from "./candidate-profile/types";

/** Groups a flat message list into threads, oldest message first inside each. */
function groupIntoConversations(messages: CandidateMessage[]) {
  const threads = messages.reduce((groups, message) => {
    const key = message.threadId ?? `legacy:${message.id}`;
    const group = groups.get(key) ?? [];
    group.push(message);
    groups.set(key, group);
    return groups;
  }, new Map<string, CandidateMessage[]>());

  return Array.from(threads.values()).map((group) =>
    group.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  );
}

export function CandidateProfileTabs({
  candidateId,
  workspaceId,
  candidateEmail,
  candidateName,
  candidatePhone,
  candidateAddress,
  candidateLinkedinUrl,
  candidateGithubUrl,
  candidateWebsiteUrl,
  candidateSummary,
  candidateEducationEntries,
  candidateExperienceEntries,
  stageName,
  applications,
  notes,
  files,
  relatedDocuments,
  activity,
  scorecards,
  messages,
  interviews,
  members,
  aiEvaluations,
  hiringReviewSummaries,
  aiConfigured,
  offers,
  offerSignatureChannel,
  emailTemplates = [],
  emailTemplateValues = {},
  scheduleApplications,
  scheduleMembers,
  scheduleCal,
  currentUserId,
  privacyRequests = [],
  canFulfilErasure = false,
}: CandidateProfileTabsProps) {
  const [tab, setTab] = useState("profile");
  const [openReviewId, setOpenReviewId] = useState<string | null>(null);
  const [summaries, setSummaries] = useState(hiringReviewSummaries);
  const [lastSummaries, setLastSummaries] = useState(hiringReviewSummaries);
  if (hiringReviewSummaries !== lastSummaries) {
    setLastSummaries(hiringReviewSummaries);
    setSummaries(hiringReviewSummaries);
  }
  const updateReviewSummary = useCallback((summary: HiringReviewSummary) => {
    setSummaries((previous) => [
      ...previous.filter(
        (item) => item.applicationId !== summary.applicationId,
      ),
      summary,
    ]);
  }, []);
  const pendingIds = summaries
    .filter(
      (s) =>
        (s.status === "queued" || s.status === "running") &&
        !(tab === "profile" && openReviewId === s.applicationId),
    )
    .map((s) => s.applicationId)
    .sort()
    .join(",");
  useEffect(() => {
    if (!pendingIds) return;
    let active = true;
    let polling = false;
    const timer = setInterval(async () => {
      if (polling) return;
      polling = true;
      try {
        const result = await getHiringReviewStatusesAction(
          pendingIds.split(","),
        );
        if (active && result.ok)
          for (const summary of result.summaries) updateReviewSummary(summary);
      } catch {
        /* Poll again after a transient connection failure. */
      } finally {
        polling = false;
      }
    }, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [pendingIds, summaries, updateReviewSummary]);
  function openReview(applicationId: string) {
    setTab("profile");
    setOpenReviewId(applicationId);
    const panel = document.getElementById(`hiring-review-${applicationId}`);
    panel?.focus({ preventScroll: true });
    panel?.scrollIntoView({ block: "start" });
  }
  const conversations = groupIntoConversations(messages);
  const jobOptions = applications.map((application) => ({
    id: application.id,
    jobTitle: application.jobTitle,
  }));

  return (
    <Tabs value={tab} onValueChange={setTab}>
      {/*
        Flat, exclusive tabs, one module per tab (DESIGN.md , Candidate Focus:
        complex-workspace exception). Each tab is its own independent
        functional module, not a rung in a decision hierarchy, so grouping
        them under 3 umbrella tabs just stacked unrelated TabsContent blocks
        on top of each other and produced a single endless-scroll page. Flat
        tabs keep each module reachable in one click and scoped to its own
        content.
      */}
      <TabsList
        variant="line"
        className="w-full justify-start gap-5 overflow-x-auto border-b border-hairline text-sm [&>button]:flex-none [&>button]:px-0.5"
      >
        <TabsTrigger value="profile">{"Профиль"}</TabsTrigger>
        <TabsTrigger value="interviews">
          {"Собеседования "}
          <TabCount value={interviews.length} />
        </TabsTrigger>
        <TabsTrigger value="communication">
          {"Общение "}
          <TabCount value={messages.length} />
        </TabsTrigger>
        <TabsTrigger value="evaluation">
          {"Оценка "}
          <TabCount value={scorecards.length} />
        </TabsTrigger>
        <TabsTrigger value="offers">
          {"Предложения "}
          <TabCount value={offers.length} />
        </TabsTrigger>
        <TabsTrigger value="activity">
          {"Деятельность "}
          <TabCount value={activity.length + notes.length} />
        </TabsTrigger>
        {privacyRequests.length > 0 ? (
          <TabsTrigger value="privacy">
            {"Конфиденциальность "}
            <TabCount value={privacyRequests.length} />
          </TabsTrigger>
        ) : null}
      </TabsList>

      {/* ── Profile , AI match leads, single "Details" panel follows ── */}
      <TabsContent value="profile" className="mt-5 space-y-4">
        <HiringReviewStatusCards
          applications={jobOptions}
          summaries={summaries}
          onOpen={openReview}
        />

        <CandidateDetailsPanel
          candidateId={candidateId}
          workspaceId={workspaceId}
          files={files}
          applications={applications}
          openReviewId={openReviewId}
          reviewSummaries={summaries}
          onOpenReviewChange={setOpenReviewId}
          onReviewSummaryChange={updateReviewSummary}
          email={candidateEmail}
          phone={candidatePhone}
          address={candidateAddress}
          linkedinUrl={candidateLinkedinUrl}
          githubUrl={candidateGithubUrl}
          websiteUrl={candidateWebsiteUrl}
          summary={candidateSummary}
          educationEntries={candidateEducationEntries}
          experienceEntries={candidateExperienceEntries}
        />
      </TabsContent>

      {/* ── Interviews ── */}
      <TabsContent value="interviews" className="mt-4 space-y-3">
        <div className="flex justify-end">
          <ScheduleDrawer
            candidateId={candidateId}
            workspaceId={workspaceId}
            candidateName={candidateName}
            candidateEmail={candidateEmail}
            applications={scheduleApplications}
            members={scheduleMembers}
            cal={scheduleCal}
            trigger={
              <Button size="sm">
                <Plus className="size-4" />
                {"Назначить собеседование "}
              </Button>
            }
          />
        </div>
        {interviews.length === 0 ? (
          <EmptySection
            icon={CalendarClock}
            title={"Пока нет интервью"}
            hint={
              "Запланируйте его с помощью кнопки выше. Ссылка для присоединения, интервьюер и заметки остаются на карте."
            }
          />
        ) : (
          <div className="space-y-3 duration-300 animate-in fade-in slide-in-from-bottom-1">
            {interviews.map((interview) => (
              <InterviewCard
                key={interview.id}
                interview={interview}
                candidateId={candidateId}
                workspaceId={workspaceId}
                members={scheduleMembers}
                currentUserId={currentUserId}
                aiConfigured={aiConfigured}
              />
            ))}
          </div>
        )}
      </TabsContent>

      {/* ── Communication ── */}
      <TabsContent value="communication" className="mt-4 space-y-3">
        <div className="flex justify-end">
          <EmailDrawer
            candidateId={candidateId}
            workspaceId={workspaceId}
            email={candidateEmail}
            name={candidateName}
            templates={emailTemplates}
            templateValues={emailTemplateValues}
            aiConfigured={aiConfigured}
            trigger={
              <Button size="sm">
                <Mail className="size-4" />
                {"Новое сообщение "}
              </Button>
            }
          />
        </div>
        {messages.length === 0 ? (
          <EmptySection
            icon={Mail}
            title={`Вы еще не отправили электронное письмо ${candidateName.split(" ")[0]}`}
            hint={
              "Напишите первое сообщение выше. Их ответы поступают в папку «Входящие» и автоматически возвращаются сюда."
            }
          />
        ) : (
          <div className="space-y-4 duration-300 animate-in fade-in slide-in-from-bottom-1">
            {conversations.map((conversation) => (
              <ConversationThread
                key={
                  conversation[0]!.threadId ?? `legacy:${conversation[0]!.id}`
                }
                conversation={conversation}
                candidateId={candidateId}
                candidateName={candidateName}
                candidateEmail={candidateEmail}
                workspaceId={workspaceId}
                aiConfigured={aiConfigured}
              />
            ))}
          </div>
        )}
      </TabsContent>

      {/* ── Evaluation: automatic evaluation + scorecards ── */}
      <TabsContent value="evaluation" className="mt-4 space-y-4">
        <HiringReviewStatusCards
          applications={jobOptions}
          summaries={summaries}
          onOpen={openReview}
        />
        {aiEvaluations.length > 0 && (
          <details className="rounded-xl border bg-card p-4">
            <summary className="cursor-pointer text-sm font-medium">
              Ранее сохранённые оценки Harly
            </summary>
            <div className="mt-4">
              <AiScoreCard
                applications={jobOptions.filter((application) =>
                  aiEvaluations.some(
                    (evaluation) => evaluation.applicationId === application.id,
                  ),
                )}
                evaluations={aiEvaluations}
                aiConfigured={aiConfigured}
              />
            </div>
          </details>
        )}
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {scorecards.length === 0
              ? "Команда ещё не оценила этого кандидата."
              : `${scorecards.length} ${russianPlural(scorecards.length, "оценка", "оценки", "оценок")} от команды.`}
          </p>
          {applications[0] ? (
            <EvaluationDrawer
              candidateId={candidateId}
              workspaceId={workspaceId}
              applicationId={applications[0].id}
              stageName={stageName}
              trigger={
                <Button size="sm">
                  <ClipboardCheck className="size-4" />
                  {"Добавить оценку "}
                </Button>
              }
            />
          ) : (
            <Button
              size="sm"
              disabled
              title={"Для оценки нужен отклик на вакансию"}
            >
              <ClipboardCheck className="size-4" />
              {"Добавить оценку "}
            </Button>
          )}
        </div>
        <ScorecardList scorecards={scorecards} />
      </TabsContent>

      {/* ── Offers ── */}
      <TabsContent value="offers" className="mt-4">
        <OffersPanel
          offers={offers}
          applications={jobOptions}
          documents={relatedDocuments}
          offerSignatureChannel={offerSignatureChannel}
        />
      </TabsContent>

      {/* ── Activity , notes and timeline ── */}
      <TabsContent value="activity" className="mt-4 space-y-4">
        {/* Notes always on top so the form is reachable without scrolling */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {"Примечания и комментарии "}
          </p>
          <NoteForm
            candidateId={candidateId}
            workspaceId={workspaceId}
            initialNotes={notes}
            members={members}
          />
        </div>

        {activity.length > 0 ? (
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {"Хронология "}
            </p>
            <ActivityTimeline activity={activity} />
          </div>
        ) : null}

        {activity.length === 0 && notes.length === 0 ? (
          <EmptySection
            icon={MessageSquare}
            title={"Еще ничего не произошло"}
            hint={
              "Сценические ходы, заметки, электронные письма и интервью — все это размещается здесь по порядку, чтобы вы могли увидеть, как этот кандидат добился того, чего он достиг."
            }
          />
        ) : null}
      </TabsContent>

      {/*
        Privacy requests. Rendered only when one exists: a permanently
        visible "Privacy requests / none" tab is a section explaining that it
        has nothing to say, which is the same mistake the AI panels made.
      */}
      {privacyRequests.length > 0 ? (
        <TabsContent value="privacy" className="mt-4 space-y-3">
          <div className="space-y-4 duration-300 animate-in fade-in slide-in-from-bottom-1">
            {privacyRequests.map((request) => (
              <PrivacyRequestCard
                key={request.id}
                request={request}
                candidateId={candidateId}
                candidateEmail={candidateEmail}
                canFulfilErasure={canFulfilErasure}
                inventory={{
                  applications: applications.length,
                  interviews: interviews.length,
                  messages: messages.length,
                  files: files.length,
                  notes: notes.length,
                  scorecards: scorecards.length,
                  aiEvaluations: aiEvaluations.length,
                  offers: offers.length,
                  activity: activity.length,
                }}
              />
            ))}
          </div>
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
