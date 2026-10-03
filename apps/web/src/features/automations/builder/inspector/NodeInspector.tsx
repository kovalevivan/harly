"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowRight, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { toast } from "@/lib/notification-island/toast";

import { patchTriggerFilter, WORKFLOW_EVENTS, type WorkflowEvent } from "../../schema";
import type { Binding, WorkflowNode } from "../../definition/schema-v2";
import { cn } from "@/lib/utils";
import { ConditionPanel } from "../ConditionPanel";
import { actionMeta, pickableActions, triggerMeta, type ConfigField } from "../catalog";
import { NODE_KIND_LABEL, getNodeVisualMeta, nodeCaption, nodeTitle } from "../node-copy";
import { explainConnect, sourcePorts } from "../state/commands";
import type { EditorState } from "../state/editor-reducer";
import { asLiteral, literalValue } from "./bindings";
import { BindingPicker } from "./BindingPicker";
import { BuilderSelect } from "./BuilderSelect";
import { ScopedSearchSelect } from "./ScopedSearchSelect";
import { useDebouncedCommit } from "./use-debounced-commit";
import { builderFieldClass } from "../field-styles";
import { DocumentItemsEditor } from "../DocumentItemsEditor";
import { DocumentAttachmentsEditor } from "../DocumentAttachmentsEditor";
import { SignatureRecipientsEditor } from "../SignatureRecipientsEditor";
import { TEMPLATE_VARIABLES } from "@/features/email-templates/interpolate";
import type { WorkflowDocumentTemplateSnapshot } from "@/features/document-templates/shared";
import { formatDateTimeLocal } from "./datetime";
import {
  createWorkflowWebhookEndpointAction,
  toggleWorkflowWebhookEndpointAction,
  updateWorkflowWebhookEndpointPayloadSchemaAction,
} from "../../actions";
import { WebhookSchemaEditor } from "./WebhookSchemaEditor";

export type InspectorBuilderData = {
  toolManifests: {
    type: import("../../schema").ActionType;
    version: number;
  }[];
  members: { id: string; name: string; email?: string }[];
  stageNames: string[];
  stages?: { id: string; name: string; jobId: string }[];
  jobs: { id: string; title: string }[];
  emailTemplates: { id: string; name: string; subject: string; type: string }[];
  documentTemplates: WorkflowDocumentTemplateSnapshot[];
  documents: { id: string; name: string; mimeType: string }[];
  attachmentDocuments: { id: string; name: string; mimeType: string; checksum: string }[];
  interviews: { id: string; label: string; hint?: string }[];
  tags: string[];
  webhookEndpoints: {
    id: string;
    name: string;
    enabled: boolean;
    lastReceivedAt: string | null;
    payloadSchema: Record<string, unknown>;
  }[];
  defaultTimeZone: string;
};

const inputClass = builderFieldClass();

export function NodeInspector({
  state,
  workflowId,
  builderData,
  onChangeNode,
  onConnect,
  onDisconnect,
  onSelectNode,
  onClose,
}: {
  state: EditorState;
  workflowId?: string;
  builderData: InspectorBuilderData;
  onChangeNode: (node: WorkflowNode) => void;
  onConnect: (source: string, port: string, target: string) => void;
  onDisconnect: (edgeId: string) => void;
  onSelectNode?: (nodeId: string | null) => void;
  onClose?: () => void;
}) {
  const selectedId = state.selection.nodeIds[0];
  const node = state.graph.nodes.find((item) => item.id === selectedId);
  const reduceMotion = useReducedMotion();
  const contentTransition = reduceMotion
    ? { duration: 0.12, ease: "linear" as const }
    : { duration: 0.15, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {!node ? (
        <motion.div
          key="empty"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, filter: "blur(2px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, filter: "blur(2px)" }}
          transition={contentTransition}
          className="flex h-full min-h-0 w-full flex-col"
        >
          <InspectorEmptyState state={state} onSelectNode={onSelectNode} />
        </motion.div>
      ) : (
        <motion.div
          key={node.id}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, filter: "blur(2px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, filter: "blur(2px)" }}
          transition={contentTransition}
          className="flex h-full min-h-0 w-full flex-col"
        >
          <InspectorForm
            node={node}
            state={state}
            workflowId={workflowId}
            builderData={builderData}
            onChangeNode={onChangeNode}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
            onClose={onClose ?? (() => onSelectNode?.(null))}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function InspectorEmptyState({
  state,
  onSelectNode,
}: {
  state: EditorState;
  onSelectNode?: (nodeId: string | null) => void;
}) {
  const nodes = state.graph.nodes;
  const edges = state.graph.edges;
  const triggerNode = nodes.find((n) => n.type === "trigger");

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l border-border bg-warm-paper">
      <div className="border-b border-hairline-c px-4 py-3">
        <p className="font-display text-sm font-semibold text-foreground">
          {"Обзор рабочего процесса "}</p>
        <p className="mt-0.5 text-[11px] text-soft-ink">
          {nodes.length} {nodes.length === 1 ? "step" : "steps"} · {edges.length}{" "}
          {edges.length === 1 ? "connection" : "connections"}
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {/* Trigger status card */}
        <div className="rounded-xl border border-border bg-pure-snow p-3 shadow-xs">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-soft-ink">
            {"Триггер "}</p>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                {triggerNode ? triggerMeta(triggerNode.event).label : "Триггер не выбран"}
              </p>
              <p className="text-[11px] text-soft-ink truncate">
                {triggerNode ? nodeCaption(triggerNode) : "Выберите, что запускает эту автоматизацию"}
              </p>
            </div>
            {triggerNode && onSelectNode && (
              <button
                type="button"
                onClick={() => onSelectNode(triggerNode.id)}
                className="shrink-0 rounded-lg border border-border bg-warm-paper px-2 py-1 text-[11px] font-medium text-foreground hover:bg-soft-kraft transition-colors"
              >
                {"Настроить "}</button>
            )}
          </div>
        </div>

        {/* Steps outline / navigator */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">{"Шаги по порядку"}</p>
            <span className="text-[11px] text-soft-ink">{"Выберите для редактирования"}</span>
          </div>

          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-pure-snow shadow-xs">
            {nodes.map((n, index) => {
              const meta = getNodeVisualMeta(n);
              const Icon = meta.Icon;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onSelectNode?.(n.id)}
                  className="flex w-full items-center gap-2.5 p-2.5 text-left text-xs transition-colors hover:bg-soft-kraft/40"
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-soft-kraft text-[10px] font-semibold text-soft-ink">
                    {index + 1}
                  </span>
                  <div
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-md border border-border",
                      meta.iconBgClass,
                    )}
                  >
                    <Icon className="size-3" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {nodeTitle(n)}
                    </p>
                    <p className="truncate text-[10px] text-soft-ink">
                      {nodeCaption(n)}
                    </p>
                  </div>
                  <span className="text-soft-ink/60 text-xs">›</span>
                </button>
              );
            })}
          </div>
        </div>

        {nodes.length <= 1 && (
          <div className="rounded-xl border border-dashed border-border bg-pure-snow/60 p-3.5 text-center">
            <p className="text-xs font-medium text-foreground">{"Добавьте свое первое действие"}</p>
            <p className="mt-1 text-[11px] text-soft-ink leading-relaxed">
              {"Перетащите действие из библиотеки слева или нажмите «+» на краю холста, чтобы создать автоматизацию. "}</p>
          </div>
        )}
      </div>
    </aside>
  );
}

function InspectorForm({
  node,
  state,
  workflowId,
  builderData,
  onChangeNode,
  onConnect,
  onDisconnect,
  onClose,
}: {
  node: WorkflowNode;
  state: EditorState;
  workflowId?: string;
  builderData: InspectorBuilderData;
  onChangeNode: (node: WorkflowNode) => void;
  onConnect: (source: string, port: string, target: string) => void;
  onDisconnect: (edgeId: string) => void;
  onClose?: () => void;
}) {
  const nodeRef = useRef(node);
  useEffect(() => {
    nodeRef.current = node;
  }, [node]);
  const commitName = useCallback(
    (name: string) => onChangeNode({ ...nodeRef.current, name: name.trim() || undefined }),
    [onChangeNode],
  );
  const nameField = useDebouncedCommit(node.name ?? "", commitName);
  const ports = sourcePorts(node);
  const targets = state.graph.nodes.filter((item) => item.id !== node.id && item.type !== "trigger");
  const meta = getNodeVisualMeta(node);
  const Icon = meta.Icon;

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l border-border bg-warm-paper">
      <div className="flex items-center justify-between border-b border-hairline-c px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-lg border border-border shadow-xs",
              meta.iconBgClass,
            )}
          >
            <Icon className="size-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-display text-sm font-semibold text-foreground truncate">
                {NODE_KIND_LABEL[node.type]}
              </p>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px] uppercase tracking-wider font-semibold",
                  meta.badgeClass,
                )}
              >
                {meta.kindLabel}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-soft-ink truncate">{nodeCaption(node)}</p>
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label={"Отменить выбор шага"}
            className="shrink-0 rounded-lg p-1 text-soft-ink hover:bg-soft-kraft hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-foreground">{"Имя шага"}</span>
          <input
            value={nameField.value}
            onChange={(event) => nameField.setValue(event.target.value)}
            onBlur={nameField.flush}
            className={inputClass}
            placeholder={"Дополнительная этикетка"}
          />
        </label>

        {node.type === "trigger" ? (
          <TriggerFields node={node} workflowId={workflowId} builderData={builderData} onChangeNode={onChangeNode} />
        ) : null}
        {node.type === "action" ? (
          <ActionFields
            node={node}
            graph={state.graph}
            builderData={builderData}
            onChangeNode={onChangeNode}
          />
        ) : null}
        {node.type === "condition" ? (
          <ConditionPanel
            value={node.tree ?? []}
            onChange={(tree) => onChangeNode({ ...node, tree })}
            stageNames={builderData.stageNames}
            jobs={builderData.jobs}
            tags={builderData.tags}
          />
        ) : null}
        {node.type === "delay" ? <DelayFields node={node} defaultTimeZone={builderData.defaultTimeZone} onChangeNode={onChangeNode} /> : null}
        {node.type === "approval" ? (
          <ApprovalFields node={node} builderData={builderData} onChangeNode={onChangeNode} />
        ) : null}
        {node.type === "wait" ? (
          <WaitFields node={node} graph={state.graph} onChangeNode={onChangeNode} />
        ) : null}
        {node.type === "end" ? (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-foreground">{"Результат"}</span>
            <BuilderSelect
              value={node.result}
              onChange={(event) =>
                onChangeNode({ ...node, result: event.target.value as "completed" | "stopped" })
              }
              className={inputClass}
            >
              <option value="completed">{"Завершено"}</option>
              <option value="stopped">{"Остановлено"}</option>
            </BuilderSelect>
          </label>
        ) : null}

        {ports.length > 0 ? (
          <div className="border-t border-hairline-c pt-3">
            <p className="mb-2 text-xs font-medium text-foreground">{"Следующие шаги"}</p>
            <div className="space-y-2">
              {ports.map((port) => {
                const connectedEdge = state.graph.edges.find(
                  (edge) => edge.source === node.id && edge.port === port,
                );
                const connectedTarget = connectedEdge
                  ? state.graph.nodes.find((n) => n.id === connectedEdge.target)
                  : null;

                if (connectedTarget && connectedEdge) {
                  return (
                    <div
                      key={port}
                      className="flex items-center justify-between gap-2 rounded-xl border border-border bg-pure-snow p-2.5 shadow-2xs"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="font-chrome rounded-md bg-soft-kraft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-soft-ink">
                          {port}
                        </span>
                        <ArrowRight className="size-3 text-soft-ink shrink-0" />
                        <span className="truncate text-xs font-medium text-foreground">
                          {connectedTarget.name ?? nodeCaption(connectedTarget)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDisconnect(connectedEdge.id)}
                        className="rounded-md p-1 text-soft-ink transition-colors hover:bg-danger-rust/10 hover:text-danger-rust"
                        title={`Отключить выход ${port}`}
                        aria-label={`Отключить выход ${port}`}
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  );
                }

                return (
                  <label key={port} className="block">
                    <span className="mb-1 block text-[11px] font-medium text-soft-ink">
                      {"Подключиться "}<span className="font-semibold text-foreground">{port}</span> {"кому: "}</span>
                    <BuilderSelect
                      value=""
                      onChange={(event) => {
                        const target = event.target.value;
                        if (target) onConnect(node.id, port, target);
                      }}
                      className={inputClass}
                    >
                      <option value="">{"Выберите следующий шаг…"}</option>
                      {targets.map((target) => {
                        const blocked = explainConnect(state.graph, node.id, port, target.id);
                        return (
                          <option key={target.id} value={target.id} disabled={Boolean(blocked)}>
                            {target.name ?? nodeCaption(target)}
                            {blocked ? ` — ${blocked}` : ""}
                          </option>
                        );
                      })}
                    </BuilderSelect>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function TriggerFields({
  node,
  workflowId,
  builderData,
  onChangeNode,
}: {
  node: Extract<WorkflowNode, { type: "trigger" }>;
  workflowId?: string;
  builderData: InspectorBuilderData;
  onChangeNode: (node: WorkflowNode) => void;
}) {
  const [createdEndpoints, setCreatedEndpoints] = useState<typeof builderData.webhookEndpoints>([]);
  const [endpointEnabledOverrides, setEndpointEnabledOverrides] = useState<Record<string, boolean>>({});
  const [endpointSchemaOverrides, setEndpointSchemaOverrides] = useState<Record<string, Record<string, unknown>>>({});
  const [endpointName, setEndpointName] = useState("Партнерский вебхук");
  const [newSecret, setNewSecret] = useState<{ endpointUrl: string; secret: string } | null>(null);
  const [creating, startCreating] = useTransition();
  const jobId = typeof node.filter?.jobId === "string" ? node.filter.jobId : "";
  const stageId = typeof node.filter?.toStageId === "string" ? node.filter.toStageId : "";
  const stageName = typeof node.filter?.toStageName === "string" ? node.filter.toStageName : "";
  const endpointId = typeof node.filter?.endpointId === "string" ? node.filter.endpointId : "";
  const jobStages = jobId
    ? (builderData.stages ?? []).filter((stage) => stage.jobId === jobId)
    : [];
  const showStage = node.event === "application.stage_changed";
  const showWebhook = node.event === "webhook.received";

  const endpoints = [
    ...builderData.webhookEndpoints,
    ...createdEndpoints.filter((created) => !builderData.webhookEndpoints.some((endpoint) => endpoint.id === created.id)),
  ].map((endpoint) => ({
    ...endpoint,
    enabled: endpointEnabledOverrides[endpoint.id] ?? endpoint.enabled,
    payloadSchema: endpointSchemaOverrides[endpoint.id] ?? endpoint.payloadSchema,
  }));
  const selectedEndpoint = endpoints.find((endpoint) => endpoint.id === endpointId);

  const createEndpoint = (payloadSchema: Record<string, unknown>) => {
    if (!workflowId) {
      toast.error("Сохраните рабочий процесс перед созданием входящей конечной точки.");
      return;
    }
    startCreating(async () => {
      const result = await createWorkflowWebhookEndpointAction({
        workflowId,
        name: endpointName,
        payloadSchema,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCreatedEndpoints((current) => [
        ...current,
        {
          id: result.endpoint.id,
          name: result.endpoint.name,
          enabled: result.endpoint.enabled,
          lastReceivedAt: result.endpoint.lastReceivedAt,
          payloadSchema: result.endpoint.payloadSchema,
        },
      ]);
      onChangeNode({
        ...node,
        filter: patchTriggerFilter(node.filter, { endpointId: result.endpoint.id }),
      });
      if (!result.endpointUrl) {
        toast.error("Конечная точка была создана, но ее URL-адрес не удалось вернуть. Обновите перед использованием.");
        return;
      }
      setNewSecret({ endpointUrl: result.endpointUrl, secret: result.secret });
      setEndpointName("");
      toast.success("Входящая конечная точка создана. Скопируйте его секрет сейчас.");
    });
  };

  const saveEndpointSchema = (payloadSchema: Record<string, unknown>) => {
    if (!selectedEndpoint) {
      createEndpoint(payloadSchema);
      return;
    }
    startCreating(async () => {
      const result = await updateWorkflowWebhookEndpointPayloadSchemaAction({
        endpointId: selectedEndpoint.id,
        payloadSchema,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEndpointSchemaOverrides((current) => ({ ...current, [selectedEndpoint.id]: payloadSchema }));
      toast.success("Схема полезной нагрузки вебхука сохранена.");
    });
  };

  const copyValue = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} скопировано.`);
    } catch {
      toast.error(`Не удалось скопировать ${label.toLowerCase()}.`);
    }
  };

  return (
    <>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-foreground">{"Когда"}</span>
        <BuilderSelect
          value={node.event}
          onChange={(event) =>
            onChangeNode({
              ...node,
              event: event.target.value as WorkflowEvent,
              filter: event.target.value === node.event ? node.filter : undefined,
            })
          }
          className={inputClass}
        >
          {WORKFLOW_EVENTS.map((event) => (
            <option key={event} value={event}>
              {triggerMeta(event).label}
            </option>
          ))}
        </BuilderSelect>
      </label>
      <div>
        <span className="mb-1 block text-xs font-medium text-foreground">{"Только эта работа"}</span>
        <ScopedSearchSelect
          kind="jobs"
          value={jobId}
          placeholder={"Любая работа"}
          emptyLabel={"Любая работа"}
          initialItems={builderData.jobs.map((job) => ({ id: job.id, label: job.title }))}
          onChange={(id) =>
            onChangeNode({
              ...node,
              filter: patchTriggerFilter(node.filter, { jobId: id, toStageId: "", toStageName: "" }),
            })
          }
        />
      </div>
      {showStage ? (
        <div>
          <span className="mb-1 block text-xs font-medium text-foreground">{"Когда они достигают"}</span>
          <ScopedSearchSelect
            kind="stages"
            value={jobId ? stageId : stageName}
            jobId={jobId || undefined}
            placeholder={"Любой этап"}
            emptyLabel={"Любой этап"}
            initialItems={
              jobId
                ? jobStages.map((stage) => ({ id: stage.id, label: stage.name }))
                : builderData.stageNames.map((name) => ({ id: name, label: name }))
            }
            onChange={(id, item) => {
              const stage = jobStages.find((entry) => entry.id === id);
              onChangeNode({
                ...node,
                filter: patchTriggerFilter(node.filter, {
                  toStageId: jobId ? id : "",
                  toStageName: stage?.name ?? item?.label ?? id,
                  stageName: "",
                }),
              });
            }}
          />
        </div>
      ) : null}
      {showWebhook ? (
        <div className="space-y-3 rounded-xl border border-border bg-pure-snow p-3">
          <div>
            <p className="text-xs font-medium text-foreground">{"Входящая конечная точка"}</p>
            <p className="mt-1 text-[11px] leading-4 text-soft-ink">
              {"Harly проверяет подлинность каждого подписанного запроса JSON и проверяет схему его полезных данных перед запуском автоматизации. "}</p>
          </div>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-foreground">{"Конечная точка"}</span>
            <BuilderSelect
              value={endpointId}
              onChange={(event) =>
                onChangeNode({
                  ...node,
                  filter: patchTriggerFilter(node.filter, { endpointId: event.target.value }),
                })
              }
              className={inputClass}
            >
              <option value="">{"Выберите конечную точку"}</option>
              {endpoints.map((endpoint) => (
                <option key={endpoint.id} value={endpoint.id}>
                  {endpoint.name}{endpoint.enabled ? "" : " — отключено"}
                </option>
              ))}
            </BuilderSelect>
          </label>
          {selectedEndpoint && !selectedEndpoint.enabled ? (
            <button
              type="button"
              className="text-[11px] font-medium text-foreground underline underline-offset-2"
              onClick={() => {
                startCreating(async () => {
                  const result = await toggleWorkflowWebhookEndpointAction({ endpointId: selectedEndpoint.id, enabled: true });
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  setEndpointEnabledOverrides((current) => ({ ...current, [selectedEndpoint.id]: true }));
                  toast.success("Входящая конечная точка включена.");
                });
              }}
              disabled={creating}
            >
              {"Включить эту конечную точку "}</button>
          ) : null}
          {selectedEndpoint ? (
            <div className="border-t border-border pt-3">
              <WebhookSchemaEditor
                key={`endpoint:${selectedEndpoint.id}`}
                schema={selectedEndpoint.payloadSchema}
                onSave={saveEndpointSchema}
                disabled={creating}
                saveLabel={"Сохранить схему полезных данных"}
                showSavedStatus
              />
            </div>
          ) : null}
          <div className="border-t border-border pt-3">
            <p className="text-[11px] font-medium text-foreground">{"Создать конечную точку"}</p>
            <p className="mt-1 text-[11px] leading-4 text-soft-ink">
              {"Секрет подписи отображается один раз. Сохраните его в отправляющей системе, прежде чем закрывать эту панель. "}</p>
            <div className="mt-2 flex gap-2">
              <input
                value={endpointName}
                onChange={(event) => setEndpointName(event.target.value)}
                className={inputClass}
                placeholder={"например Тепличные мероприятия"}
                maxLength={120}
                disabled={creating}
              />
            </div>
            <div className="mt-3">
              <WebhookSchemaEditor
                key={`new:${workflowId ?? "unsaved"}:${createdEndpoints.length}`}
                schema={{}}
                onSave={createEndpoint}
                disabled={creating || !endpointName.trim() || !workflowId}
                saveLabel={creating ? "Создание конечной точки…" : "Создать конечную точку"}
              />
            </div>
            {!workflowId ? (
              <p className="mt-2 text-[11px] text-danger-rust">{"Сохраните этот рабочий процесс, чтобы создать его первую конечную точку."}</p>
            ) : null}
          </div>
          {newSecret ? (
            <div className="space-y-2 rounded-lg border border-warning/30 bg-warning/10 p-2.5">
              <p className="text-[11px] font-semibold text-foreground">{"Сохраните этот секрет сейчас"}</p>
              <p className="text-[11px] leading-4 text-soft-ink">{"Он больше не будет отображаться."}</p>
              <SecretRow label={"URL-адрес"} value={newSecret.endpointUrl} onCopy={() => void copyValue(newSecret.endpointUrl, "URL-адрес конечной точки")} />
              <SecretRow label={"Секрет"} value={newSecret.secret} onCopy={() => void copyValue(newSecret.secret, "Секрет")} />
              <button
                type="button"
                className="text-[11px] font-medium text-foreground underline underline-offset-2"
                onClick={() => setNewSecret(null)}
              >
                {"Я сохранил — скрой секрет "}</button>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function SecretRow({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-chrome text-[11px] uppercase tracking-wide text-soft-ink">{label}</span>
        <button type="button" className="text-[10px] font-medium text-foreground underline underline-offset-2" onClick={onCopy}>
          {"Копировать "}</button>
      </div>
      <code className="block max-h-16 overflow-auto rounded border border-border bg-warm-paper px-2 py-1.5 text-[10px] leading-4 text-foreground">
        {value}
      </code>
    </div>
  );
}

function ActionFields({
  node,
  graph,
  builderData,
  onChangeNode,
}: {
  node: Extract<WorkflowNode, { type: "action" }>;
  graph: EditorState["graph"];
  builderData: InspectorBuilderData;
  onChangeNode: (node: WorkflowNode) => void;
}) {
  const meta = actionMeta(node.actionType);
  const availableActions = pickableActions(builderData.toolManifests);
  const reusableTemplateSelected = node.actionType === "generate_document" &&
    typeof literalValue(node.input?.templateId) === "string" &&
    Boolean(literalValue(node.input?.templateId));
  const setInput = (key: string, binding: Binding | undefined, clearKeys: string[] = []) => {
    const input = { ...(node.input ?? {}) };
    if (!binding) delete input[key];
    else input[key] = binding;
    for (const clearKey of clearKeys) delete input[clearKey];
    onChangeNode({ ...node, input });
  };
  const setActionField = (field: ConfigField, binding: Binding | undefined) => {
    if (node.actionType === "schedule_interview" && field.key === "mode" && binding?.kind === "literal" && binding.value !== "video") {
      onChangeNode({
        ...node,
        input: {
          ...(node.input ?? {}),
          mode: binding,
          meetingProvider: asLiteral("auto"),
        },
      });
      return;
    }
    const clearKeys = node.actionType === "send_document_for_signature"
      ? field.key === "documentId"
        ? ["documentRequestId"]
        : field.key === "documentRequestId"
          ? ["documentId"]
          : []
      : [];
    if (node.actionType === "generate_document" && field.key === "templateId") {
      const input = { ...(node.input ?? {}) };
      if (!binding) {
        delete input.templateId;
        delete input.templateSnapshot;
      } else {
        input.templateId = binding;
        const templateId = literalValue(binding);
        const template = typeof templateId === "string"
          ? builderData.documentTemplates.find((item) => item.id === templateId)
          : undefined;
        if (template) {
          input.templateSnapshot = asLiteral({
            id: template.id,
            name: template.name,
            title: template.title,
            body: template.body,
            format: template.format,
          });
        } else {
          delete input.templateSnapshot;
        }
      }
      onChangeNode({ ...node, input });
      return;
    }
    setInput(field.key, binding, clearKeys);
  };

  return (
    <>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-foreground">{"Действие"}</span>
        <BuilderSelect
          value={node.actionType}
          onChange={(event) => {
            const actionType = event.target.value as typeof node.actionType;
            onChangeNode({
              ...node,
              actionType,
              toolVersion: availableActions.find(
                (action) => action.type === actionType,
              )?.toolVersion ?? node.toolVersion,
              input: {},
            });
          }}
          className={inputClass}
        >
          {availableActions.map((action) => (
            <option key={action.type} value={action.type}>
              {action.label}
            </option>
          ))}
        </BuilderSelect>
      </label>
      {meta?.config
        .filter((field) => !(reusableTemplateSelected && (field.key === "title" || field.key === "body")))
        .filter((field) => !(node.actionType === "schedule_interview" && field.key === "meetingProvider" && literalValue(node.input?.mode) !== undefined && literalValue(node.input?.mode) !== "video"))
        .map((field) => (
        <ConfigFieldEditor
          key={field.key}
          field={field}
          binding={node.input?.[field.key]}
          graph={graph}
          nodeId={node.id}
          builderData={builderData}
            onChange={(binding) => setActionField(field, binding)}
        />
      ))}
      {reusableTemplateSelected ? (
        <p className="text-[11px] text-soft-ink">
          {"На этом шаге используется выбранный снимок шаблона. Очистите шаблон, чтобы вместо этого записать собственное содержимое документа. "}</p>
      ) : null}
      {node.actionType === "schedule_interview" ? (
        <p className="text-[11px] text-soft-ink">
          {"При автоматическом выборе используется подключенный к рабочей области поставщик. Должен быть подключен конкретный провайдер; для внешних собраний требуется полный URL-адрес в поле «Местоположение». Харли создает одну видеоконференцию для каждого интервью. "}</p>
      ) : null}
      {(node.actionType === "send_email" ||
        node.actionType === "send_slack" ||
        node.actionType === "add_note") && (
        <p className="text-[11px] text-soft-ink">
          {"Используйте данные из события или более раннего шага. Отсутствующие значения остаются отсутствующими — они не становятся пустым текстом. "}</p>
      )}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-foreground">{"Если этот шаг не удался"}</span>
        <BuilderSelect
          value={node.failurePolicy}
          onChange={(event) =>
            onChangeNode({
              ...node,
              failurePolicy: event.target.value as typeof node.failurePolicy,
            })
          }
          className={inputClass}
        >
          <option value="stop">{"Остановить автоматизацию"}</option>
          <option value="continue">{"Продолжить с предупреждением"}</option>
          <option value="route_error">{"Возьмите путь к ошибке"}</option>
        </BuilderSelect>
      </label>
    </>
  );
}

function ConfigFieldEditor({
  field,
  binding,
  graph,
  nodeId,
  builderData,
  onChange,
}: {
  field: ConfigField;
  binding: Binding | undefined;
  graph: EditorState["graph"];
  nodeId: string;
  builderData: InspectorBuilderData;
  onChange: (binding: Binding | undefined) => void;
}) {
  const current = String(literalValue(binding) ?? "");
  const pickLiteral = (value: string) => onChange(value ? asLiteral(value) : undefined);

  if (field.kind === "stage") {
    const usingData = binding?.kind !== undefined && binding.kind !== "literal";
    return (
      <div>
        <FieldLabel field={field} />
        <ScopedSearchSelect
          kind="stages"
          value={usingData ? "" : current}
          placeholder={"Выберите этап"}
          emptyLabel={"Выберите этап"}
          allowEmpty={!field.required}
          initialItems={builderData.stageNames.map((name) => ({ id: name, label: name }))}
          onChange={(id, item) => pickLiteral(item?.label ?? id)}
          disabled={usingData}
        />
        <div className="mt-1.5">
          <BindingPicker graph={graph} nodeId={nodeId} value={binding} onChange={onChange} />
        </div>
      </div>
    );
  }
  if (field.kind === "owner") {
    const usingData = binding?.kind !== undefined && binding.kind !== "literal";
    return (
      <div>
        <FieldLabel field={field} />
        <ScopedSearchSelect
          kind="members"
          value={usingData ? "" : current}
          placeholder={"Назначить владельцу рабочего процесса"}
          emptyLabel={"Назначить владельцу рабочего процесса"}
          initialItems={builderData.members.map((member) => ({
            id: member.id,
            label: member.name,
            hint: member.email,
          }))}
          onChange={(id) => pickLiteral(id)}
          disabled={usingData}
        />
        <div className="mt-1.5">
          <BindingPicker graph={graph} nodeId={nodeId} value={binding} onChange={onChange} />
        </div>
      </div>
    );
  }
  if (field.kind === "email-template") {
    const usingData = binding?.kind !== undefined && binding.kind !== "literal";
    return (
      <div>
        <FieldLabel field={field} />
        {builderData.emailTemplates.length === 0 ? (
          <p className="text-[11px] text-soft-ink">
            {"В этой рабочей области пока нет шаблонов электронной почты. Создайте его в настройках, затем выберите здесь. "}</p>
        ) : null}
        <ScopedSearchSelect
          kind="templates"
          value={usingData ? "" : current}
          placeholder={"Выберите шаблон электронного письма"}
          emptyLabel={"Нет шаблона"}
          initialItems={builderData.emailTemplates.map((template) => ({
            id: template.id,
            label: template.name,
            hint: template.type,
          }))}
          onChange={(id) => pickLiteral(id)}
          disabled={usingData}
        />
        <div className="mt-1.5">
          <BindingPicker graph={graph} nodeId={nodeId} value={binding} onChange={onChange} />
        </div>
      </div>
    );
  }
  if (field.kind === "document-template") {
    return (
      <div>
        <FieldLabel field={field} />
        {builderData.documentTemplates.length === 0 ? (
          <p className="text-[11px] text-soft-ink">
            {"Шаблоны документов недоступны. Создайте его в разделе «Документы» → «Шаблоны рабочих процессов», а затем вернитесь сюда. "}</p>
        ) : null}
        <BuilderSelect
          aria-label={field.label}
          value={current}
          onChange={(event) => {
            const template = builderData.documentTemplates.find((item) => item.id === event.target.value);
            if (!template) {
              onChange(undefined);
              return;
            }
            onChange(asLiteral(template.id));
          }}
          className={inputClass}
        >
          <option value="">{"Выберите шаблон документа"}</option>
          {builderData.documentTemplates.map((template) => (
            <option key={template.id} value={template.id}>{template.name}</option>
          ))}
        </BuilderSelect>
        <p className="mt-1 text-[11px] text-soft-ink">
          {"При выборе выбранного содержимого сохраняется моментальный снимок этого шага рабочего процесса. "}</p>
      </div>
    );
  }
  if (field.kind === "document") {
    return (
      <div>
        <FieldLabel field={field} />
        {builderData.documents.length === 0 ? (
          <p className="text-[11px] text-soft-ink">
            {"В этом рабочем пространстве нет активных PDF-документов, доступных для подписи. "}</p>
        ) : null}
        <ScopedSearchSelect
          kind="documents"
          value={current}
          placeholder={"Выберите PDF-документ"}
          emptyLabel={"Нет документа"}
          initialItems={builderData.documents.map((document) => ({
            id: document.id,
            label: document.name,
            hint: document.mimeType,
          }))}
          onChange={(id) => pickLiteral(id)}
          allowEmpty={!field.required}
        />
        <div className="mt-1.5">
          <BindingPicker
            graph={graph}
            nodeId={nodeId}
            value={binding}
            onChange={onChange}
            allowLiteral={false}
          />
        </div>
        <p className="mt-1 text-[11px] text-soft-ink">
          {"Выберите существующий документ или привяжите documentId, возвращенный на предыдущем шаге. "}</p>
      </div>
    );
  }
  if (field.kind === "document-request") {
    return (
      <div>
        <FieldLabel field={field} />
        <BindingPicker
          graph={graph}
          nodeId={nodeId}
          value={binding}
          onChange={onChange}
          allowLiteral={false}
        />
        <p className="mt-1 text-[11px] text-soft-ink">
          {"Связать "}<code>{"первичныйрекуестид"}</code> {"из предыдущего шага запроса документов. Загруженный PDF-файл разрешается только тогда, когда выполнение достигает этого узла. "}</p>
      </div>
    );
  }
  if (field.kind === "interview") {
    return (
      <div>
        <FieldLabel field={field} />
        <ScopedSearchSelect
          kind="interviews"
          value={current}
          placeholder={field.placeholder ?? "Выбрать интервью"}
          emptyLabel={"Нет интервью"}
          initialItems={builderData.interviews}
          onChange={(id) => pickLiteral(id)}
          allowEmpty={!field.required}
        />
        <div className="mt-1.5">
          <BindingPicker graph={graph} nodeId={nodeId} value={binding} onChange={onChange} allowLiteral={false} />
        </div>
        <p className="mt-1 text-[11px] text-soft-ink">
          {"Выберите предстоящее интервью или привяжите интервью.id к триггеру. "}</p>
      </div>
    );
  }
  if (field.kind === "tag") {
    const usingData = binding?.kind !== undefined && binding.kind !== "literal";
    return (
      <div>
        <FieldLabel field={field} />
        <ScopedSearchSelect
          kind="tags"
          value={usingData ? "" : current}
          placeholder={field.placeholder ?? "Тег"}
          emptyLabel={"Выберите или введите тег"}
          initialItems={builderData.tags.map((tag) => ({ id: tag, label: tag }))}
          onChange={(id, item) => pickLiteral(item?.label ?? id)}
          disabled={usingData}
        />
        <input
          value={current}
          onChange={(event) => pickLiteral(event.target.value)}
          maxLength={field.maxLength}
          placeholder={"Или введите новый тег"}
          className={`${inputClass} mt-1.5`}
          disabled={usingData}
        />
        <div className="mt-1.5">
          <BindingPicker graph={graph} nodeId={nodeId} value={binding} onChange={onChange} />
        </div>
      </div>
    );
  }
  if (field.kind === "due-offset") {
    const usingData = binding?.kind !== undefined && binding.kind !== "literal";
    const num = typeof literalValue(binding) === "number" ? Number(literalValue(binding)) : Number(current) || 0;
    return (
      <div>
        <FieldLabel field={field} />
        <BuilderSelect aria-label={field.label} value={usingData ? "" : String(num)} onChange={(event) => onChange(asLiteral(Number(event.target.value)))} disabled={usingData} className={inputClass}>
          <option value="0">{"В тот же день"}</option>
          <option value="1">{"Через 1 день"}</option>
          <option value="2">{"Через 2 дня"}</option>
          <option value="3">{"Через 3 дня"}</option>
          <option value="7">{"Через 1 неделю"}</option>
          <option value="14">{"Через 2 недели"}</option>
        </BuilderSelect>
        <div className="mt-1.5">
          <BindingPicker graph={graph} nodeId={nodeId} value={binding} onChange={onChange} />
        </div>
      </div>
    );
  }
  if (field.kind === "select") {
    const usingData = binding?.kind !== undefined && binding.kind !== "literal";
    return (
      <div>
        <FieldLabel field={field} />
        <BuilderSelect aria-label={field.label} value={usingData ? "" : current} onChange={(event) => pickLiteral(event.target.value)} disabled={usingData} className={inputClass}>
          <option value="">{field.placeholder ?? "Выберите…"}</option>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </BuilderSelect>
        <div className="mt-1.5">
          <BindingPicker graph={graph} nodeId={nodeId} value={binding} onChange={onChange} />
        </div>
      </div>
    );
  }
  if (field.kind === "datetime") {
    const raw = literalValue(binding);
    const usingData = binding?.kind !== undefined && binding.kind !== "literal";
    return (
      <div>
        <FieldLabel field={field} />
        <input
          aria-label={field.label}
          type="datetime-local"
          value={usingData ? "" : formatDateTimeLocal(raw)}
          disabled={usingData}
          required={field.required}
          onChange={(event) => onChange(event.target.value ? asLiteral(new Date(event.target.value).toISOString()) : field.required ? asLiteral("") : undefined)}
          className={inputClass}
        />
        <div className="mt-1.5">
          <BindingPicker graph={graph} nodeId={nodeId} value={binding} onChange={onChange} />
        </div>
      </div>
    );
  }
  if (field.kind === "textarea" || field.kind === "text") {
    const appendVariable = (key: string) => {
      if (!key) return;
      const existing = typeof literalValue(binding) === "string" ? String(literalValue(binding)) : "";
      onChange(asLiteral(`${existing}{{${key}}}`));
    };
    return (
      <div>
        <FieldLabel field={field} />
        {field.kind === "textarea" ? (
          <textarea
            aria-label={field.label}
            value={binding?.kind === "literal" ? String(binding.value ?? "") : ""}
            onChange={(event) => pickLiteral(event.target.value)}
            maxLength={field.maxLength}
            placeholder={field.placeholder}
            rows={3}
            className={`${inputClass} min-h-[72px] resize-y py-2`}
            disabled={binding?.kind === "trigger" || binding?.kind === "output"}
          />
        ) : (
          <input
            aria-label={field.label}
            value={binding?.kind === "literal" ? String(binding.value ?? "") : ""}
            onChange={(event) => pickLiteral(event.target.value)}
            maxLength={field.maxLength}
            placeholder={field.placeholder}
            className={inputClass}
            disabled={binding?.kind === "trigger" || binding?.kind === "output"}
          />
        )}
        <select
          aria-label={`Вставьте переменную в ${field.label}`}
          value=""
          disabled={Boolean(binding && binding.kind !== "literal")}
          onChange={(event) => appendVariable(event.target.value)}
          className="mt-1.5 h-8 w-full rounded-lg border border-border bg-pure-snow px-2 text-[11px] text-soft-ink outline-none focus:border-foreground/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">{"Вставьте переменную рабочего процесса…"}</option>
          {Array.from(new Set(TEMPLATE_VARIABLES.map((variable) => variable.group))).map((group) => (
            <optgroup key={group} label={group}>
              {TEMPLATE_VARIABLES.filter((variable) => variable.group === group).map((variable) => (
                <option key={variable.key} value={variable.key}>
                  {variable.label} · {`{{${variable.key}}}`}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <div className="mt-1.5">
          <BindingPicker graph={graph} nodeId={nodeId} value={binding} onChange={onChange} />
        </div>
      </div>
    );
  }
  if (field.kind === "document-list") {
    return (
      <div>
        <FieldLabel field={field} />
        <DocumentItemsEditor
          value={literalValue(binding)}
          onChange={(value) => onChange(asLiteral(value))}
        />
        <p className="mt-1 text-[11px] text-soft-ink">
          {"Кандидат увидит эти запросы на портале. Добавьте ожидание пакета документов после этого шага, чтобы продолжить, когда они будут приняты. "}</p>
      </div>
    );
  }
  if (field.kind === "document-attachments") {
    return (
      <div>
        <FieldLabel field={field} />
        <DocumentAttachmentsEditor
          value={literalValue(binding)}
          documents={builderData.attachmentDocuments}
          onChange={(value) => onChange(asLiteral(value))}
        />
        <p className="mt-1 text-[11px] text-soft-ink">
          {"Выбранные PDF-файлы добавляются по порядку и фиксируются по контрольной сумме при публикации этого рабочего процесса. "}</p>
      </div>
    );
  }
  if (field.kind === "recipient-list") {
    return (
      <div>
        <FieldLabel field={field} />
        <SignatureRecipientsEditor
          value={literalValue(binding)}
          onChange={(value) => onChange(value.length > 0 ? asLiteral(value) : undefined)}
        />
        <p className="mt-1 text-[11px] text-soft-ink">
          {"Оставьте пустым, чтобы подписать себя как кандидат. Добавьте до десяти получателей для заказанной подписи; следующий подписавшийся приглашается только после завершения предыдущего. "}</p>
      </div>
    );
  }
  if (field.kind === "keyval") {
    return (
      <div>
        <FieldLabel field={field} />
        <textarea
          value={current}
          onChange={(event) => pickLiteral(event.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className={`${inputClass} min-h-[60px] resize-y py-1.5 font-mono`}
        />
      </div>
    );
  }
  if (field.kind === "secret-refs") {
    const listed = Array.isArray(literalValue(binding))
      ? (literalValue(binding) as string[]).join(", ")
      : current;
    return (
      <div>
        <FieldLabel field={field} />
        <input
          value={listed}
          onChange={(event) =>
            onChange(
              asLiteral(
                event.target.value
                  .split(",")
                  .map((part) => part.trim())
                  .filter(Boolean),
              ),
            )
          }
          placeholder={field.placeholder}
          className={inputClass}
        />
        <p className="mt-1 text-[11px] text-soft-ink">{"Ссылайтесь на секретные имена, никогда не вставляйте сам секрет."}</p>
      </div>
    );
  }
  return (
    <div>
      <FieldLabel field={field} />
      <input value={current} onChange={(event) => pickLiteral(event.target.value)} className={inputClass} />
    </div>
  );
}

function FieldLabel({ field }: { field: ConfigField }) {
  return (
    <span className="mb-1 block text-xs font-medium text-foreground">
      {field.label}
      {"required" in field && field.required ? <span className="ml-0.5 text-danger-rust">*</span> : null}
    </span>
  );
}

function DelayFields({
  node,
  defaultTimeZone,
  onChangeNode,
}: {
  node: Extract<WorkflowNode, { type: "delay" }>;
  defaultTimeZone: string;
  onChangeNode: (node: WorkflowNode) => void;
}) {
  const hours = Math.max(1, Math.round((node.durationMs ?? 86_400_000) / 3_600_000));
  return (
    <>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-foreground">{"Подождите, пока"}</span>
        <BuilderSelect
          value={node.mode}
          onChange={(event) => {
            const mode = event.target.value as typeof node.mode;
            onChangeNode({
              ...node,
              mode,
              ...(mode === "next_local" && !node.timeZone ? { timeZone: defaultTimeZone } : {}),
            });
          }}
          className={inputClass}
        >
          <option value="duration">{"Продолжительность с настоящего момента"}</option>
          <option value="next_local">{"В следующий раз по местному времени"}</option>
        </BuilderSelect>
      </label>
      {node.mode === "duration" ? (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-foreground">{"Часы"}</span>
          <input
            type="number"
            min={1}
            max={24 * 30}
            value={hours}
            onChange={(event) =>
              onChangeNode({ ...node, durationMs: Number(event.target.value) * 3_600_000 })
            }
            className={inputClass}
          />
        </label>
      ) : (
        <>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-foreground">{"Местное время"}</span>
            <input
              type="time"
              value={node.localTime ?? "09:00"}
              onChange={(event) => onChangeNode({
                ...node,
                localTime: event.target.value,
                ...(!node.timeZone ? { timeZone: defaultTimeZone } : {}),
              })}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-foreground">{"Часовой пояс"}</span>
            <input
              value={node.timeZone ?? defaultTimeZone}
              onChange={(event) => onChangeNode({ ...node, timeZone: event.target.value })}
              placeholder={"Зона рабочей области, если не установлена"}
              className={inputClass}
            />
          </label>
        </>
      )}
    </>
  );
}

function ApprovalFields({
  node,
  builderData,
  onChangeNode,
}: {
  node: Extract<WorkflowNode, { type: "approval" }>;
  builderData: InspectorBuilderData;
  onChangeNode: (node: WorkflowNode) => void;
}) {
  return (
    <>
      <div>
        <span className="mb-1 block text-xs font-medium text-foreground">{"Кто может одобрить"}</span>
        <ScopedSearchSelect
          kind="members"
          value=""
          placeholder={"Добавить человека"}
          emptyLabel={"Закрыть"}
          initialItems={builderData.members
            .filter((member) => !node.eligibleActorIds.includes(member.id))
            .map((member) => ({ id: member.id, label: member.name, hint: member.email }))}
          onChange={(id) => {
            if (!id || node.eligibleActorIds.includes(id)) return;
            onChangeNode({ ...node, eligibleActorIds: [...node.eligibleActorIds, id] });
          }}
        />
        <ul className="mt-2 space-y-1">
          {node.eligibleActorIds.length === 0 ? (
            <li className="text-[11px] text-soft-ink">{"Добавьте хотя бы одного человека перед публикацией."}</li>
          ) : (
            node.eligibleActorIds.map((id) => {
              const member = builderData.members.find((item) => item.id === id);
              return (
                <li key={id} className="flex items-center justify-between text-xs">
                  <span>{member?.name ?? id}</span>
                  <button
                    type="button"
                    className="text-soft-ink hover:text-danger-rust"
                    onClick={() =>
                      onChangeNode({
                        ...node,
                        eligibleActorIds: node.eligibleActorIds.filter((item) => item !== id),
                      })
                    }
                  >
                    {"Удалить "}</button>
                </li>
              );
            })
          )}
        </ul>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-foreground">{"Правило"}</span>
        <BuilderSelect
          value={node.rule}
          onChange={(event) => onChangeNode({ ...node, rule: event.target.value as typeof node.rule })}
          className={inputClass}
        >
          <option value="any">{"Любой может одобрить"}</option>
          <option value="all">{"Каждый должен одобрить"}</option>
        </BuilderSelect>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-foreground">{"Срок (часы)"}</span>
        <input
          type="number"
          min={1}
          max={24 * 30}
          value={node.deadlineHours ?? 48}
          onChange={(event) => onChangeNode({ ...node, deadlineHours: Number(event.target.value) })}
          className={inputClass}
        />
      </label>
    </>
  );
}

function WaitFields({
  node,
  graph,
  onChangeNode,
}: {
  node: Extract<WorkflowNode, { type: "wait" }>;
  graph: EditorState["graph"];
  onChangeNode: (node: WorkflowNode) => void;
}) {
  return (
    <>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-foreground">{"Подождите"}</span>
        <BuilderSelect
          value={node.kind}
          onChange={(event) => {
            const kind = event.target.value as typeof node.kind;
            onChangeNode({
              ...node,
              kind,
              ...(kind === "document_package" && !node.resourceType ? { resourceType: "package" as const } : {}),
            });
          }}
          className={inputClass}
        >
          <option value="event">{"Событие"}</option>
          <option value="document_package">{"Подписанный пакет документов"}</option>
        </BuilderSelect>
      </label>
      {node.kind === "event" ? (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-foreground">{"Название события"}</span>
          <BuilderSelect
            value={node.eventName ?? ""}
            onChange={(event) => onChangeNode({ ...node, eventName: event.target.value || undefined })}
            className={inputClass}
          >
            <option value="">{"Выберите событие"}</option>
            {node.eventName && !WORKFLOW_EVENTS.includes(node.eventName as WorkflowEvent) ? (
              <option value={node.eventName}>{node.eventName} (custom)</option>
            ) : null}
            {WORKFLOW_EVENTS.map((event) => (
              <option key={event} value={event}>
                {triggerMeta(event).label}
              </option>
            ))}
          </BuilderSelect>
        </label>
      ) : null}
      {node.kind === "document_package" ? (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-foreground">{"Ресурс завершения"}</span>
          <BuilderSelect
            value={node.resourceType ?? "package"}
            onChange={(event) => onChangeNode({ ...node, resourceType: event.target.value as typeof node.resourceType })}
            className={inputClass}
          >
            <option value="package">{"Все запрошенные загрузки приняты"}</option>
            <option value="document">{"Подпись документа завершена"}</option>
          </BuilderSelect>
          <p className="mt-1 text-[11px] text-soft-ink">
            {"Выберите пакет для загрузки на портал или документ для этапа подписи. Харли примиряет обоих после перезапуска. "}</p>
        </label>
      ) : null}
      <div>
        <span className="mb-1 block text-xs font-medium text-foreground">{"Ресурс"}</span>
        <BindingPicker
          graph={graph}
          nodeId={node.id}
          value={node.resourceId}
          onChange={(resourceId) => onChangeNode({ ...node, resourceId })}
          allowLiteral={false}
        />
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-foreground">{"Срок (часы)"}</span>
        <input
          type="number"
          min={1}
          max={24 * 90}
          value={node.deadlineHours ?? 168}
          onChange={(event) => onChangeNode({ ...node, deadlineHours: Number(event.target.value) })}
          className={inputClass}
        />
      </label>
    </>
  );
}
