"use client";

import { localizeSystemText } from "@/lib/localize-system-text";
import type { ComponentType } from "react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "@/lib/notification-island/toast";

import {
  importAshbyCandidatesAction,
  importCandidatesAction,
  importGreenhouseCandidatesAction,
  importJoinCandidatesAction,
  importLeverCandidatesAction,
  importWorkableCandidatesAction,
} from "@/features/candidates/import/actions";
import {
  autoMapColumns,
  IMPORT_FIELDS,
  type ImportFieldKey,
  type ImportMapping,
} from "@/features/candidates/import/mapping";
import {
  buildCandidateImportRows,
  MAX_IMPORT_FILE_BYTES,
  prepareCandidateImport,
  validateCandidateImportMapping,
} from "@/features/candidates/import/candidate-import";
import {
  AshbyLogo,
  GreenhouseLogo,
  JoinLogo,
  LeverLogo,
  WorkableLogo,
} from "@/components/ui/icons/brands";
import { DrawerLayout } from "@/features/candidates/DrawerLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetClose, SheetTrigger } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type ImportJobOption = { id: string; title: string };
export type ImportSource =
  | "csv"
  | "greenhouse"
  | "workable"
  | "ashby"
  | "lever"
  | "join";

type SourceOption = {
  value: ImportSource;
  label: string;
  /** Small mark shown in the source picker and next to the credentials heading. */
  logo: ComponentType<{ className?: string }>;
  /** Hint shown under the label in the picker grid. */
  hint: string;
};

const IMPORT_SOURCE_OPTIONS: SourceOption[] = [
  {
    value: "csv",
    label: "CSV-файл",
    logo: FileSpreadsheet,
    hint: "Загрузить таблицу",
  },
  {
    value: "greenhouse",
    label: "Теплица",
    logo: GreenhouseLogo,
    hint: "Сбор API-ключа",
  },
  {
    value: "workable",
    label: "Работоспособный",
    logo: WorkableLogo,
    hint: "Субдомен + токен",
  },
  {
    value: "ashby",
    label: "Эшби",
    logo: AshbyLogo,
    hint: "Ключ API только для чтения",
  },
  {
    value: "lever",
    label: "Рычаг",
    logo: LeverLogo,
    hint: "Ключ к возможностям",
  },
  {
    value: "join",
    label: "JOIN.com",
    logo: JoinLogo,
    hint: "API-токен",
  },
];

const UNMAPPED = "__unmapped__";
const PREVIEW_ROWS = 5;

type ParsedFile = {
  fileName: string;
  headers: string[];
  dataRows: string[][];
  truncated: boolean;
  mapping: ImportMapping;
};

type ImportSummary = {
  imported: number;
  alreadyInPipeline: number;
  skipped?: number;
  errors: { row: number; email: string; reason: string }[];
};

export function ImportCandidatesDrawer({
  jobs,
  initialSource,
}: {
  jobs: ImportJobOption[];
  initialSource?: ImportSource;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(initialSource));
  const [jobId, setJobId] = useState<string>(jobs[0]?.id ?? "");
  const [source, setSource] = useState<ImportSource>(initialSource ?? "csv");
  const [file, setFile] = useState<ParsedFile | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [greenhouseApiKey, setGreenhouseApiKey] = useState("");
  const [workableSubdomain, setWorkableSubdomain] = useState("");
  const [workableApiToken, setWorkableApiToken] = useState("");
  const [ashbyApiKey, setAshbyApiKey] = useState("");
  const [leverApiKey, setLeverApiKey] = useState("");
  const [joinApiToken, setJoinApiToken] = useState("");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setSource(initialSource ?? "csv");
    setFile(null);
    setSummary(null);
    setGreenhouseApiKey("");
    setWorkableSubdomain("");
    setWorkableApiToken("");
    setAshbyApiKey("");
    setLeverApiKey("");
    setJoinApiToken("");
  }

  async function handleFile(selected: File) {
    if (selected.size > MAX_IMPORT_FILE_BYTES) {
      toast.error(
        "Этот файл больше 5 МБ. Разделите его на файлы меньшего размера и повторите попытку.",
      );
      return;
    }
    const text = await selected.text();
    const prepared = prepareCandidateImport(text);
    if ("error" in prepared) {
      toast.error(prepared.error);
      return;
    }
    setSummary(null);
    setFile({
      fileName: selected.name,
      headers: prepared.headers,
      dataRows: prepared.dataRows,
      truncated: prepared.truncated,
      mapping: autoMapColumns(prepared.headers),
    });
  }

  function setMapping(field: ImportFieldKey, value: string) {
    setFile((prev) => {
      if (!prev) return prev;
      const mapping = { ...prev.mapping };
      if (value === UNMAPPED) {
        delete mapping[field];
      } else {
        mapping[field] = Number(value);
      }
      return { ...prev, mapping };
    });
  }

  const rowsToImport = useMemo(
    () => (file ? buildCandidateImportRows(file) : []),
    [file],
  );

  const mappingError = file
    ? validateCandidateImportMapping(file.mapping)
    : null;

  const validRowCount = rowsToImport.filter(
    (row) => row.values.firstName && row.values.lastName && row.values.email,
  ).length;

  // The active source option drives both the header logo and the skipped
  // summary wording. `source` is cleared alongside `summary` when the source
  // changes, so this always matches the import that produced the current view.
  const activeSourceOption = IMPORT_SOURCE_OPTIONS.find(
    (option) => option.value === source,
  );
  const ActiveSourceLogo = activeSourceOption?.logo;
  // ATS imports report `skipped` when a profile is too sparse to import; CSV
  // never sets it, so fall back to a generic "candidate" wording there.
  const skippedSourceLabel =
    source === "csv" ? "candidate" : (activeSourceOption?.label ?? "source");

  function importRows() {
    if (!file || !jobId) return;
    startTransition(async () => {
      const result = await importCandidatesAction({
        jobId,
        rows: rowsToImport,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setSummary(result);
      if (result.imported > 0) {
        toast.success(
          `Импортирован ${result.imported} кандидат.`,
        );
        router.refresh();
      } else {
        toast.error("Ни один кандидат не был импортирован.");
      }
    });
  }

  function importGreenhouse() {
    if (!jobId || !greenhouseApiKey.trim()) return;
    startTransition(async () => {
      const result = await importGreenhouseCandidatesAction({
        jobId,
        apiKey: greenhouseApiKey,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setSummary(result);
      toast.success(
        `Импортирован ${result.imported} Кандидат в теплицу.`,
      );
      router.refresh();
    });
  }

  function importWorkable() {
    if (!jobId || !workableSubdomain.trim() || !workableApiToken.trim()) return;
    startTransition(async () => {
      const result = await importWorkableCandidatesAction({
        jobId,
        subdomain: workableSubdomain,
        apiToken: workableApiToken,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setSummary(result);
      toast.success(
        `Импортирован ${result.imported} Работоспособный кандидат.`,
      );
      router.refresh();
    });
  }

  function importAshby() {
    if (!jobId || !ashbyApiKey.trim()) return;
    startTransition(async () => {
      const result = await importAshbyCandidatesAction({
        jobId,
        apiKey: ashbyApiKey,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setSummary(result);
      toast.success(
        `Импортирован ${result.imported} кандидат Эшби.`,
      );
      router.refresh();
    });
  }

  function importLever() {
    if (!jobId || !leverApiKey.trim()) return;
    startTransition(async () => {
      const result = await importLeverCandidatesAction({
        jobId,
        apiKey: leverApiKey,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setSummary(result);
      toast.success(
        `Импортирован ${result.imported} Кандидат на рычаг .`,
      );
      router.refresh();
    });
  }

  function importJoin() {
    if (!jobId || !joinApiToken.trim()) return;
    startTransition(async () => {
      const result = await importJoinCandidatesAction({
        jobId,
        apiToken: joinApiToken,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setSummary(result);
      toast.success(
        `Импортирован ${result.imported} кандидат ПРИСОЕДИНЯЙТЕСЬ.`,
      );
      router.refresh();
    });
  }

  function downloadTemplate() {
    const csv =
      "Имя, Фамилия, адрес электронной почты, Телефон, Местоположение, URL-адрес LinkedIn, URL-адрес GitHub, URL-адрес веб-сайта, Заголовок Ada, Lovelace, ada@example.com, +56 9 1234 5678, Сантьяго, https://linkedin.com/in/ada,,,Математик";
    const url = URL.createObjectURL(
      new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "harly-candidate-import-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Sheet
      open={open}
      mobilePresentation="bottom-on-mobile"
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-11 rounded-lg">
          <Upload className="size-4" />
          {"Импортировать кандидатов "}</Button>
      </SheetTrigger>
      <DrawerLayout
        title={
          <span className="flex items-center gap-2">
            {ActiveSourceLogo ? (
              <ActiveSourceLogo className="size-5 shrink-0" />
            ) : null}
            {"Импортировать кандидатов "}</span>
        }
        description={"Привлекайте кандидатов на работу из файла CSV или другого ATS."}
        className="sm:max-w-2xl"
        footer={
          <>
            <SheetClose asChild>
              <Button variant="outline" disabled={isPending}>
                {summary ? "Закрыть" : "Отмена"}
              </Button>
            </SheetClose>
            {!summary && source === "csv" ? (
              <Button
                onClick={importRows}
                disabled={
                  !file ||
                  !jobId ||
                  validRowCount === 0 ||
                  Boolean(mappingError) ||
                  isPending
                }
              >
                {isPending
                  ? "Импорт…"
                  : `Импортировать ${validRowCount} кандидата`}
              </Button>
            ) : null}
          </>
        }
      >
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {"Создайте вакансию перед импортом кандидатов. Каждая импортированная строка добавляется в конвейер задания. "}</p>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="import-job">{"Вакансия"}</Label>
              <Select value={jobId} onValueChange={setJobId}>
                <SelectTrigger id="import-job" className="w-full">
                  <SelectValue placeholder={"Выберите работу"} />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{"Источник"}</Label>
              <div
                role="radiogroup"
                aria-label={"Источник импорта"}
                className="grid grid-cols-2 gap-2 sm:grid-cols-3"
              >
                {IMPORT_SOURCE_OPTIONS.map((option) => {
                  const active = source === option.value;
                  const Logo = option.logo;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => {
                        setSource(option.value);
                        setFile(null);
                        setSummary(null);
                      }}
                      className={cn(
                        "group flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-colors",
                        active
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:border-primary/40 hover:bg-muted/40",
                      )}
                    >
                      <span className="flex size-9 items-center justify-center rounded-md bg-muted/60">
                        <Logo className="size-5" />
                      </span>
                      <span className="space-y-0.5">
                        <span className="block text-sm font-medium leading-tight">
                          {option.label}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {option.hint}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {source === "csv" ? (
              <div className="space-y-2">
                <Label htmlFor="import-file">{"CSV-файл"}</Label>
                <Input
                  id="import-file"
                  type="file"
                  accept=".csv,.tsv,text/csv,text/tab-separated-values"
                  onChange={(e) => {
                    const selected = e.target.files?.[0];
                    if (selected) void handleFile(selected);
                    e.target.value = "";
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {"Первая строка должна содержать заголовки столбцов. Используйте полное имя или имя + фамилию плюс адрес электронной почты. Поддерживаются форматы CSV, CSV, разделенные точкой с запятой, и TSV. "}</p>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto px-0"
                  onClick={downloadTemplate}
                >
                  <Download className="size-3.5" />
                  {"Скачать шаблон "}</Button>
                {file?.truncated ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {"Только первые 500 строк "}{file.fileName} {"будет импортирован. "}</p>
                ) : null}
              </div>
            ) : null}

            {!summary && source === "greenhouse" ? (
              <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                <div className="flex items-center gap-2">
                  <GreenhouseLogo className="size-5" />
                  <Label
                    htmlFor="greenhouse-api-key"
                    className="text-sm font-medium"
                  >
                    {"API-ключ для теплицы "}</Label>
                </div>
                <Input
                  id="greenhouse-api-key"
                  type="password"
                  autoComplete="off"
                  value={greenhouseApiKey}
                  onChange={(event) => setGreenhouseApiKey(event.target.value)}
                  placeholder={"Сбор API-ключа"}
                />
                <p className="text-xs text-muted-foreground">
                  {"Импортирует подходящих кандидатов на выбранную вакансию. Ключ используется один раз, никогда не сохраняется и требует разрешения Harvest Candidates. "}</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={importGreenhouse}
                  disabled={!jobId || !greenhouseApiKey.trim() || isPending}
                >
                  {isPending ? "Импорт…" : "Импортировать кандидатов в теплицы"}
                </Button>
              </div>
            ) : null}

            {!summary && source === "workable" ? (
              <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                <div className="flex items-center gap-2">
                  <WorkableLogo className="size-5" />
                  <span className="text-sm font-medium">
                    {"Работоспособные учетные данные "}</span>
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="workable-subdomain"
                    className="text-xs text-muted-foreground"
                  >
                    {"Субдомен "}</Label>
                  <Input
                    id="workable-subdomain"
                    autoComplete="off"
                    value={workableSubdomain}
                    onChange={(event) =>
                      setWorkableSubdomain(event.target.value)
                    }
                    placeholder={"например кульминация"}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="workable-api-token"
                    className="text-xs text-muted-foreground"
                  >
                    {"Токен доступа к API "}</Label>
                  <Input
                    id="workable-api-token"
                    type="password"
                    autoComplete="off"
                    value={workableApiToken}
                    onChange={(event) =>
                      setWorkableApiToken(event.target.value)
                    }
                    placeholder={"Токен, созданный администратором"}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {"Используйте токен, созданный администратором, только с"}{" "}
                  <code>r_candidates</code> {"сфера применения. Харли читает полные профили и никогда не сохраняет токен. "}</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={importWorkable}
                  disabled={
                    !jobId ||
                    !workableSubdomain.trim() ||
                    !workableApiToken.trim() ||
                    isPending
                  }
                >
                  {isPending ? "Импорт…" : "Импортировать работоспособных кандидатов"}
                </Button>
              </div>
            ) : null}

            {!summary && source === "ashby" ? (
              <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                <div className="flex items-center gap-2">
                  <AshbyLogo className="size-5" />
                  <Label
                    htmlFor="ashby-api-key"
                    className="text-sm font-medium"
                  >
                    {"API-ключ Эшби "}</Label>
                </div>
                <Input
                  id="ashby-api-key"
                  type="password"
                  autoComplete="off"
                  value={ashbyApiKey}
                  onChange={(event) => setAshbyApiKey(event.target.value)}
                  placeholder={"API-ключ Эшби"}
                />
                <p className="text-xs text-muted-foreground">
                  {"Используйте ключ, сгенерированный администратором, с"}{" "}
                  <code>{"кандидатыЧитать"}</code> {"сфера применения. Харли читает полные профили и никогда не сохраняет ключ. "}</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={importAshby}
                  disabled={!jobId || !ashbyApiKey.trim() || isPending}
                >
                  {isPending ? "Импорт…" : "Импортировать кандидатов Эшби"}
                </Button>
              </div>
            ) : null}

            {!summary && source === "lever" ? (
              <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                <div className="flex items-center gap-2">
                  <LeverLogo className="size-5" />
                  <Label
                    htmlFor="lever-api-key"
                    className="text-sm font-medium"
                  >
                    {"Ключ API рычага "}</Label>
                </div>
                <Input
                  id="lever-api-key"
                  type="password"
                  autoComplete="off"
                  value={leverApiKey}
                  onChange={(event) => setLeverApiKey(event.target.value)}
                  placeholder={"Ключ API рычага"}
                />
                <p className="text-xs text-muted-foreground">
                  {"Используйте ключ только для чтения для доступа к возможностям. Харли импортирует данные кандидата и никогда не сохраняет ключ. "}</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={importLever}
                  disabled={!jobId || !leverApiKey.trim() || isPending}
                >
                  {isPending ? "Импорт…" : "Импортировать кандидатов на рычаг"}
                </Button>
              </div>
            ) : null}

            {!summary && source === "join" ? (
              <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                <div className="flex items-center gap-2">
                  <JoinLogo className="size-5" />
                  <Label
                    htmlFor="join-api-token"
                    className="text-sm font-medium"
                  >
                    {"ПРИСОЕДИНЯЙТЕСЬ API-токен "}</Label>
                </div>
                <Input
                  id="join-api-token"
                  type="password"
                  autoComplete="off"
                  value={joinApiToken}
                  onChange={(event) => setJoinApiToken(event.target.value)}
                  placeholder={"Токен API от JOIN"}
                />
                <p className="text-xs text-muted-foreground">
                  {"Создайте его в JOIN в разделе «Настройки пользователя» → «Учетные данные API». Используйте выделенный токен для доступа к отклику; Харли использует его один раз и никогда не сохраняет. Профили кандидатов импортируются, но вложения с резюме не загружаются. "}</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={importJoin}
                  disabled={!jobId || !joinApiToken.trim() || isPending}
                >
                  {isPending ? "Импорт…" : "Импортировать кандидатов JOIN"}
                </Button>
              </div>
            ) : null}

            {file && !summary ? (
              <>
                <div className="space-y-2">
                  <Label>{"Столбцы карты"}</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {IMPORT_FIELDS.map((field) => (
                      <div key={field.key} className="space-y-1.5">
                        <Label
                          htmlFor={`map-${field.key}`}
                          className="font-normal text-muted-foreground"
                        >
                          {field.label}
                          {field.key === "email" ? " *" : ""}
                        </Label>
                        <Select
                          value={
                            file.mapping[field.key]?.toString() ?? UNMAPPED
                          }
                          onValueChange={(value) =>
                            setMapping(field.key, value)
                          }
                        >
                          <SelectTrigger
                            id={`map-${field.key}`}
                            className="w-full"
                          >
                            <SelectValue placeholder={"Не сопоставлено"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={UNMAPPED}>{"Не сопоставлено"}</SelectItem>
                            {file.headers.map((header, index) => (
                              <SelectItem key={index} value={index.toString()}>
                                {header || `Столбец ${index + 1}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
                {mappingError ? (
                  <p className="text-sm text-destructive">{localizeSystemText(mappingError)}</p>
                ) : null}

                <div className="space-y-2">
                  <Label>{"Предварительный просмотр"}</Label>
                  <div className="max-h-64 overflow-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {IMPORT_FIELDS.filter(
                            (field) => field.key !== "fullName",
                          ).map((field) => (
                            <TableHead key={field.key}>{field.label}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rowsToImport
                          .slice(0, PREVIEW_ROWS)
                          .map((row, index) => (
                            <TableRow key={index}>
                              {IMPORT_FIELDS.filter(
                                (field) => field.key !== "fullName",
                              ).map((field) => (
                                <TableCell
                                  key={field.key}
                                  className="text-muted-foreground"
                                >
                                  {row.values[
                                    field.key as Exclude<
                                      ImportFieldKey,
                                      "fullName"
                                    >
                                  ] || "Не предусмотрено"}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {rowsToImport.length} {"строк "} {"нашел,"}{" "}
                    {validRowCount} {"готов к импорту "}{rowsToImport.length > PREVIEW_ROWS
                      ? `, показывая первый ${PREVIEW_ROWS}`
                      : ""}
                    .
                  </p>
                </div>
              </>
            ) : null}

            {summary ? (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
                <p>
                  <span className="font-semibold text-foreground">
                    {summary.imported}
                  </span>{" "}
                  {"кандидат"} {"импортировано. "}{summary.alreadyInPipeline > 0
                    ? ` ${summary.alreadyInPipeline} уже в стадии разработки.`
                    : ""}
                  {summary.skipped
                    ? ` ${summary.skipped} неполный ${skippedSourceLabel} профиль${summary.skipped === 1 ? " was" : "были"} пропущен.`
                    : ""}
                </p>
                {summary.errors.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="font-medium text-foreground">
                      {summary.errors.length} {"строк "} {"пропущено: "}</p>
                    <ul className="max-h-40 space-y-1 overflow-auto text-xs text-muted-foreground">
                      {summary.errors.map((error) => (
                        <li key={error.row}>
                          {"Строка "}{error.row}
                          {error.email ? ` (${error.email})` : ""}:{" "}
                          {error.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </DrawerLayout>
    </Sheet>
  );
}
