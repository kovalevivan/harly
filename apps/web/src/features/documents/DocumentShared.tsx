"use client";

import { localizeSystemText } from "@/lib/localize-system-text";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileArchive, FileImage, FileText, Plus, Upload } from "lucide-react";
import { toast } from "@/lib/notification-island/toast";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createDocument,
  createDocumentCategory,
  createDocumentVersion,
  saveDocumentAcl,
  updateDocumentCategory,
} from "./actions";
import {
  DOCUMENT_MAX_SIZE,
  type DocumentCategoryItem,
  type DocumentHubData,
  type DocumentListItem,
} from "./shared";
import {
  allowedDocumentContentTypes,
  documentExtensionMatches,
} from "@/lib/storage-validation";

export function iconForDocument(mimeType: string) {
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType === "application/pdf" || mimeType.includes("word"))
    return FileText;
  return FileArchive;
}

/** Client-side file gate mirroring the presign + server validation. */
export function validateDocumentFile(file: File): string | null {
  if (
    !allowedDocumentContentTypes.includes(
      file.type as (typeof allowedDocumentContentTypes)[number],
    )
  ) {
    return "Выберите файл PDF, DOC, DOCX, PNG, JPG, GIF или WEBP.";
  }
  if (file.size <= 0 || file.size > DOCUMENT_MAX_SIZE) {
    return "Документы должны быть размером от 1 байта до 25 МБ.";
  }
  if (!documentExtensionMatches(file.name, file.type)) {
    return "Расширение файла не соответствует типу его содержимого.";
  }
  return null;
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Presign, PUT to storage, and return the storage key. Throws on failure. */
export async function uploadToStorage(
  file: File,
): Promise<{ key: string; checksum: string }> {
  const checksum = await sha256Hex(await file.arrayBuffer());
  const presignResponse = await fetch("/api/documents/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      contentLength: file.size,
    }),
  });
  const presign = (await presignResponse.json()) as {
    uploadUrl?: string;
    key?: string;
  };
  if (!presignResponse.ok || !presign.uploadUrl || !presign.key)
    throw new Error("Could not prepare the document upload.");
  const upload = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!upload.ok) throw new Error("Не удалось загрузить документ.");
  return { key: presign.key, checksum };
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function formatActivityType(type: string) {
  return type.replace(/^document\./, "").replaceAll("_", " ");
}

export function StatusPill({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}
    >
      {children}
    </span>
  );
}

export function UploadDialog({
  data,
  open,
  onOpenChange,
  replaceDocument = null,
}: {
  data: DocumentHubData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  replaceDocument?: DocumentListItem | null;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [associationType, setAssociationType] = useState<
    "workspace" | "candidate" | "job"
  >("workspace");
  const [associationId, setAssociationId] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function reset() {
    setFile(null);
    setName("");
    setCategoryId("");
    setAssociationType("workspace");
    setAssociationId("");
    setError(null);
    setDragging(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  function chooseFile(next: File | null) {
    setError(null);
    if (!next) return;
    const validationError = validateDocumentFile(next);
    if (validationError) {
      setError(validationError);
      return;
    }
    setFile(next);
    setName(next.name.replace(/\.[^.]+$/, ""));
  }

  function submit() {
    if (!file) {
      setError("Выберите файл для загрузки.");
      return;
    }
    startTransition(async () => {
      try {
        const { key, checksum } = await uploadToStorage(file);
        const result = replaceDocument
          ? await createDocumentVersion({
              documentId: replaceDocument.id,
              originalName: file.name,
              mimeType: file.type,
              sizeBytes: file.size,
              checksum,
              storageKey: key,
            })
          : await createDocument({
              name: name.trim() || file.name,
              originalName: file.name,
              mimeType: file.type,
              sizeBytes: file.size,
              checksum,
              storageKey: key,
              categoryId: categoryId || null,
              association: {
                targetType: associationType,
                targetId:
                  associationType === "workspace"
                    ? null
                    : associationId || null,
              },
            });
        if (!result.ok)
          throw new Error(result.error ?? "Could not save the document.");
        toast.success(
          replaceDocument ? "Новая версия загружена" : "Документ загружен",
        );
        reset();
        onOpenChange(false);
        router.refresh();
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Не удалось загрузить документ.",
        );
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) reset();
        onOpenChange(value);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {replaceDocument ? "Загрузите новую версию" : "Загрузить документ"}
          </DialogTitle>
          <DialogDescription>
            {replaceDocument
              ? `Заменяет текущий файл на «${replaceDocument.name}». Предыдущие версии остаются в журнале аудита.`
              : "Храните контракты, учетные данные и файлы о приеме на работу в одном хранилище на уровне рабочей области."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="document-file">{"Файл"}</Label>
            <input
              ref={fileInput}
              id="document-file"
              type="file"
              className="sr-only"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp"
              onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                chooseFile(event.dataTransfer.files?.[0] ?? null);
              }}
              className={`flex w-full items-center gap-3 rounded-xl border border-dashed px-4 py-6 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${dragging ? "border-primary bg-accent/40" : "border-border/90 bg-muted/20 hover:border-primary/50 hover:bg-accent/20"}`}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                <Upload className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {file?.name ??
                    (dragging
                      ? "Перетащите, чтобы прикрепить"
                      : "Перетащите файл сюда или нажмите, чтобы просмотреть")}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {"PDF, DOCX или изображение · до 25 МБ "}</span>
              </span>
            </button>
          </div>
          {!replaceDocument ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="document-name">{"Отображаемое имя"}</Label>
                <Input
                  id="document-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={"Письмо с предложением — Тейлор Окафор"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="document-category">{"Категория"}</Label>
                <select
                  id="document-category"
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">{"Нет категории"}</option>
                  {data.categories
                    .filter((category) => category.active)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="document-association">{"Связаться с"}</Label>
                <select
                  id="document-association"
                  value={associationType}
                  onChange={(event) => {
                    const next = event.target.value as
                      | "workspace"
                      | "candidate"
                      | "job";
                    setAssociationType(next);
                    setAssociationId("");
                  }}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="workspace">{"Библиотека рабочей области"}</option>
                  <option value="candidate">{"Кандидат"}</option>
                  <option value="job">{"Вакансия"}</option>
                </select>
              </div>
              {associationType !== "workspace" ? (
                <div className="space-y-2">
                  <Label htmlFor="document-association-target">
                    {"Выберите "}{associationType}
                  </Label>
                  <select
                    id="document-association-target"
                    value={associationId}
                    onChange={(event) => setAssociationId(event.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">{"Выберите "}{associationType}</option>
                    {data.associationOptions
                      .filter((option) => option.type === associationType)
                      .map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                  </select>
                </div>
              ) : null}
            </>
          ) : null}
          {error ? (
            <p
              className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {localizeSystemText(error)}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            {"Отмена "}</Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? "Загрузка…" : replaceDocument ? "Загрузите новую версию" : "Загрузить документ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AccessDialog({
  data,
  document,
  open,
  onOpenChange,
}: {
  data: DocumentHubData;
  document: DocumentListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [roles, setRoles] = useState<
    Array<{ roleKey: string; accessLevel: "read" | "manage" }>
  >(() => document.accessRoles);
  const [members, setMembers] = useState<
    Array<{ userId: string; accessLevel: "read" | "manage" }>
  >(() => document.accessMembers);
  const [isPending, startTransition] = useTransition();
  function toggleRole(roleKey: string) {
    setRoles((current) =>
      current.some((rule) => rule.roleKey === roleKey)
        ? current.filter((rule) => rule.roleKey !== roleKey)
        : [...current, { roleKey, accessLevel: "read" }],
    );
  }
  function toggleMember(userId: string) {
    setMembers((current) =>
      current.some((rule) => rule.userId === userId)
        ? current.filter((rule) => rule.userId !== userId)
        : [...current, { userId, accessLevel: "read" }],
    );
  }
  function save() {
    startTransition(async () => {
      const result = await saveDocumentAcl({
        documentId: document!.id,
        roles,
        members,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось обновить доступ.");
        return;
      }
      toast.success("Доступ обновлен");
      onOpenChange(false);
      router.refresh();
    });
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{"Управление доступом"}</DialogTitle>
          <DialogDescription>
            {document.name}. Members need both the global Documents permission
            and an ACL match.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] space-y-5 overflow-y-auto py-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {"Роли "}</p>
            <div className="space-y-1 rounded-lg border">
              {[...new Set(data.members.map((member) => member.role))].map(
                (role) => {
                  const checked = roles.some((rule) => rule.roleKey === role);
                  return (
                    <label
                      key={role}
                      className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/40"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRole(role)}
                      />
                      {role.replace(/[-_]/g, " ")}
                    </label>
                  );
                },
              )}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {"Конкретные участники "}</p>
            <div className="space-y-1 rounded-lg border">
              {data.members.map((member) => {
                const checked = members.some(
                  (rule) => rule.userId === member.id,
                );
                return (
                  <label
                    key={member.id}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/40"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMember(member.id)}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {member.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {member.role}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            {"Если роли или участники не выбраны, документ соответствует разрешению «Документы» на уровне рабочей области. После добавления правила его смогут открыть только соответствующие пользователи. "}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {"Отмена "}</Button>
          <Button onClick={save} disabled={isPending}>
            {isPending ? "Сохранение…" : "Сохранить доступ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CategoryDialog({
  data,
  open,
  onOpenChange,
}: {
  data: DocumentHubData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  function addCategory() {
    setError(null);
    startTransition(async () => {
      const result = await createDocumentCategory({ name });
      if (!result.ok) {
        setError(result.error ?? "Не удалось создать категорию.");
        return;
      }
      setName("");
      toast.success("Категория создана");
      router.refresh();
    });
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{"Категории документов"}</DialogTitle>
          <DialogDescription>
            {"Используйте небольшой, последовательный словарный запас, чтобы фильтры оставались полезными по мере роста рабочего пространства. "}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={"Трудовой договор"}
            />
            <Button onClick={addCategory} disabled={isPending || !name.trim()}>
              <Plus className="size-4" />
              {"Добавить "}</Button>
          </div>
          {error ? <p className="text-sm text-destructive">{localizeSystemText(error)}</p> : null}
          <div className="divide-y rounded-lg border">
            {data.categories.length === 0 ? (
              <p className="px-3 py-5 text-center text-sm text-muted-foreground">
                {"Пользовательских категорий пока нет. "}</p>
            ) : (
              data.categories.map((category) => (
                <CategoryRow key={category.id} category={category} />
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CategoryRow({ category }: { category: DocumentCategoryItem }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  function save() {
    startTransition(async () => {
      const result = await updateDocumentCategory({
        categoryId: category.id,
        name,
        accent: category.accent,
        active: category.active,
      });
      if (!result.ok) toast.error(result.error ?? "Не удалось обновить категорию.");
      else {
        setEditing(false);
        router.refresh();
      }
    });
  }
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span className="size-2.5 rounded-full bg-primary" />
      {editing ? (
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-8"
        />
      ) : (
        <span className="min-w-0 flex-1 truncate text-sm">{category.name}</span>
      )}
      <StatusPill
        className={
          category.active
            ? "bg-accent text-primary"
            : "bg-muted text-muted-foreground"
        }
      >
        {category.active ? "Активные" : "Скрытый"}
      </StatusPill>
      {editing ? (
        <Button size="sm" onClick={save} disabled={isPending}>
          {"Сохранить "}</Button>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          {"Редактировать "}</Button>
      )}
    </div>
  );
}
