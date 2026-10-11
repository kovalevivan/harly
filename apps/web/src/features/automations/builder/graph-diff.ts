import { nodeTitle } from "./node-copy";
import type { WorkflowGraphV2 } from "../definition/schema-v2";

export type GraphStepSummary = {
  id: string;
  type: string;
  title: string;
};

export function summarizeGraph(graph: WorkflowGraphV2): GraphStepSummary[] {
  return graph.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    title: nodeTitle(node),
  }));
}

export type GraphDiffLine = {
  id: string;
  message: string;
};

export function diffGraphSummaries(
  local: GraphStepSummary[],
  server: GraphStepSummary[],
): GraphDiffLine[] {
  const localById = new Map(local.map((item) => [item.id, item]));
  const serverById = new Map(server.map((item) => [item.id, item]));
  const lines: GraphDiffLine[] = [];
  for (const item of local) {
    const other = serverById.get(item.id);
    if (!other) {
      lines.push({ id: item.id, message: `В вашей копии есть «${item.title}»; серверная копия этого не делает.` });
      continue;
    }
    if (other.title !== item.title || other.type !== item.type) {
      lines.push({
        id: item.id,
        message: `«${item.title}» в вашей копии — это «${other.title}» на сервере.`,
      });
    }
  }
  for (const item of server) {
    if (!localById.has(item.id)) {
      lines.push({ id: item.id, message: `Серверная копия имеет «${item.title}»; твой нет.` });
    }
  }
  if (lines.length === 0) {
    lines.push({
      id: "same",
      message: "Шаги выглядят одинаково. Возможно, кто-то другой сохранил макет или поле, которое мы здесь не указываем.",
    });
  }
  return lines;
}
