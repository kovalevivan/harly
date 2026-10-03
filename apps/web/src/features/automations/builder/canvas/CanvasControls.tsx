"use client";

import { useReactFlow, useViewport } from "@xyflow/react";
import { ChevronDown, ZoomIn, ZoomOut } from "lucide-react";

import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";

export function CanvasControls({
  showDots,
  showMinimap,
  layoutLocked,
  panTool,
  onToggleDots,
  onToggleMinimap,
  onToggleLock,
  onTogglePan,
  onAutoLayout,
}: {
  showDots: boolean;
  showMinimap: boolean;
  layoutLocked: boolean;
  panTool: boolean;
  onToggleDots: () => void;
  onToggleMinimap: () => void;
  onToggleLock: () => void;
  onTogglePan: () => void;
  onAutoLayout: () => void;
}) {
  const { zoomIn, zoomOut, fitView, zoomTo } = useReactFlow();
  const { zoom } = useViewport();
  const percent = Math.round(zoom * 100);
  return (
    <div role="group" aria-label={"Элементы управления холстом"} className="pointer-events-auto flex flex-wrap items-center justify-center gap-1 rounded-xl border border-border bg-warm-paper/95 p-1.5 shadow-sm">
      <button type="button" aria-label={"Инструмент панорамирования"} aria-pressed={panTool} title={"Инструмент «Панорамирование» (удерживайте пробел)"} className={toolClass(panTool)} onClick={onTogglePan}>
        {panTool ? "Рука" : "Выбрать"}
      </button>
      <button type="button" aria-label={"Уменьшить масштаб"} className={toolClass(false)} onClick={() => void zoomOut({ duration: 120 })}>
        <ZoomOut className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        aria-label={`Масштаб ${percent} процентов. Сброс до 100 процентов`}
        className="min-w-12 rounded-lg px-2 py-1 text-[11px] font-medium text-foreground transition-colors duration-150 ease-out hover:bg-soft-kraft"
        onClick={() => void zoomTo(1, { duration: 120 })}
      >
        {percent}%
      </button>
      <button type="button" aria-label={"Увеличить масштаб"} className={toolClass(false)} onClick={() => void zoomIn({ duration: 120 })}>
        <ZoomIn className="size-4" aria-hidden />
      </button>
      <button type="button" aria-label={"Подходит для всего рабочего процесса"} className={toolClass(false)} onClick={() => void fitView({ padding: 0.25, maxZoom: 1, duration: 180 })}>
        {"Подходит "}</button>
      <button type="button" disabled={layoutLocked} title={"Автоматически упорядочивайте связанные шаги"} className={toolClass(false)} onClick={onAutoLayout}>
        {"Устроить "}</button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={cn(toolClass(false), "gap-1")}>
            {"Посмотреть "}<ChevronDown className="size-3.5" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end">
          <DropdownMenuCheckboxItem checked={showDots} onCheckedChange={onToggleDots}>{"Точечная сетка"}</DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={showMinimap} onCheckedChange={onToggleMinimap}>{"Миникарта"}</DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={layoutLocked} onCheckedChange={onToggleLock}>{"Блокировка позиций"}</DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function toolClass(active: boolean) {
  return cn(
    "min-h-9 min-w-9 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40",
    active ? "bg-foreground text-background" : "text-soft-ink hover:bg-soft-kraft hover:text-foreground",
  );
}
