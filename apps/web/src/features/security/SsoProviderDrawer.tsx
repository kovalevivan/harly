"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/notification-island/toast";
import { Eye, EyeOff, Trash2, ExternalLink, Plus } from "lucide-react";

import {
  registerSSOProviderAction,
  updateSSOProviderAction,
  deleteSSOProviderAction,
  requestSSODomainVerificationAction,
  verifySSODomainAction,
  type SSOProviderConfig,
  type SSORegisterInput,
} from "@/features/security/sso-actions";
import { DrawerLayout } from "@/features/candidates/DrawerLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetTrigger } from "@/components/ui/sheet";
import { SpinnerIcon } from "@/components/ui/icons/phosphor";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SSOProviderType = "oidc" | "saml";

export function SsoProviderDrawer({
  existingProvider,
}: {
  existingProvider?: SSOProviderConfig;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [verifying, startVerify] = useTransition();
  const [requestingVerification, startRequestVerification] = useTransition();

  // Common fields
  const [providerId, setProviderId] = useState(existingProvider?.providerId ?? "");
  const [issuer, setIssuer] = useState(existingProvider?.issuer ?? "");
  const [domain, setDomain] = useState(existingProvider?.domain ?? "");
  const [providerType, setProviderType] = useState<SSOProviderType>(existingProvider?.type ?? "oidc");

  // OIDC fields
  const [oidcClientId, setOidcClientId] = useState("");
  const [oidcClientSecret, setOidcClientSecret] = useState("");
  const [showOidcSecret, setShowOidcSecret] = useState(false);

  // SAML fields
  const [samlEntryPoint, setSamlEntryPoint] = useState("");
  const [samlCert, setSamlCert] = useState("");
  const [samlAudience, setSamlAudience] = useState("");
  const [samlMetadata, setSamlMetadata] = useState("");
  const [samlPrivateKey, setSamlPrivateKey] = useState("");
  const [verificationToken, setVerificationToken] = useState("");

  const isEditing = Boolean(existingProvider);

  function reset() {
    setProviderId(existingProvider?.providerId ?? "");
    setIssuer(existingProvider?.issuer ?? "");
    setDomain(existingProvider?.domain ?? "");
    setProviderType(existingProvider?.type ?? "oidc");
    setOidcClientId("");
    setOidcClientSecret("");
    setShowOidcSecret(false);
    setSamlEntryPoint("");
    setSamlCert("");
    setSamlAudience("");
    setSamlMetadata("");
    setSamlPrivateKey("");
    setVerificationToken("");
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    setOpen(next);
  }

  function save() {
    startSave(async () => {
      // Validate common fields
      if (!providerId.trim()) {
        toast.error("Требуется идентификатор поставщика.");
        return;
      }
      if (providerType === "oidc" && !issuer.trim()) {
        toast.error("Укажите URL-адрес эмитента.");
        return;
      }
      if (!domain.trim()) {
        toast.error("Требуется домен.");
        return;
      }

      // Validate based on type
      if (providerType === "oidc") {
        if (!isEditing && (!oidcClientId.trim() || !oidcClientSecret.trim())) {
          toast.error("Идентификатор клиента и секрет клиента необходимы для OIDC.");
          return;
        }
      } else {
        if (!isEditing && !samlMetadata.trim() && (!samlEntryPoint.trim() || !samlCert.trim())) {
          toast.error("Предоставьте XML метаданных IdP или точку входа и сертификат.");
          return;
        }
      }

      const input: SSORegisterInput = {
        providerId: providerId.trim(),
        issuer: issuer.trim(),
        domain: domain.trim(),
      };

      if (providerType === "oidc") {
        input.oidcConfig = {
          clientId: oidcClientId.trim(),
          clientSecret: oidcClientSecret.trim(),
        };
      } else if (!isEditing || samlMetadata.trim() || samlEntryPoint.trim() || samlCert.trim() || samlPrivateKey.trim()) {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const spEntityId = origin;
        input.samlConfig = {
          entryPoint: samlEntryPoint.trim(),
          cert: samlCert.trim(),
          metadata: samlMetadata.trim() || undefined,
          privateKey: samlPrivateKey.trim() || undefined,
          audience: samlAudience.trim() || spEntityId,
          callbackUrl: `${origin}/api/auth/sso/saml2/sp/acs/${providerId.trim()}`,
          spMetadata: { entityID: spEntityId },
        };
      }

      const result = isEditing
        ? await updateSSOProviderAction({ ...input, providerId: existingProvider!.providerId })
        : await registerSSOProviderAction(input);

      if (!result.ok) {
        toast.error(result.error ?? "Не удалось зарегистрировать поставщика единого входа.");
        return;
      }

      toast.success(isEditing ? "Поставщик единого входа успешно обновлен." : "Поставщик единого входа успешно зарегистрирован.");
      handleOpenChange(false);
      router.refresh();
    });
  }

  function requestDomainVerification() {
    if (!existingProvider) return;
    startRequestVerification(async () => {
      const result = await requestSSODomainVerificationAction(existingProvider.providerId);
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось запросить подтверждение домена.");
        return;
      }
      setVerificationToken(result.token ?? "");
      toast.success("Создана проверочная запись DNS.");
    });
  }

  function verifyDomain() {
    if (!existingProvider) return;
    startVerify(async () => {
      const result = await verifySSODomainAction(existingProvider.providerId);
      if (!result.ok) {
        toast.error(result.error ?? "Проверка домена не удалась.");
        return;
      }
      toast.success("Домен SSO подтвержден.");
      handleOpenChange(false);
      router.refresh();
    });
  }

  function remove() {
    if (!existingProvider) return;
    startDelete(async () => {
      const result = await deleteSSOProviderAction(existingProvider.providerId);
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось удалить.");
        return;
      }
      toast.success("Поставщик системы единого входа удален.");
      handleOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange} mobilePresentation="bottom-on-mobile">
      <SheetTrigger asChild>
        {isEditing ? (
          <Button variant="outline" size="sm">
            {"Настроить "}</Button>
        ) : (
          <Button variant="outline" size="sm">
            <Plus className="size-4 mr-1" />
            {"Добавить поставщика "}</Button>
        )}
      </SheetTrigger>
      <DrawerLayout
        title={isEditing ? "Настройка поставщика единого входа" : "Добавить поставщика корпоративного единого входа"}
        description={"Настройте SAML 2.0 или OpenID Connect (OIDC) для корпоративного единого входа."}
        className="sm:max-w-2xl"
        footer={
          isEditing ? (
            <>
              <Button
                variant="ghost"
                className="mr-auto text-destructive hover:text-destructive"
                disabled={saving || deleting}
                onClick={remove}
              >
                {deleting ? <SpinnerIcon className="size-4" /> : <Trash2 className="size-4" />}
                {"Удалить "}</Button>
              <Button variant="outline" disabled={saving} onClick={() => handleOpenChange(false)}>
                {"Отмена "}</Button>
              <Button onClick={save} disabled={saving || !providerId.trim() || !domain.trim()}>
                {saving ? <SpinnerIcon className="size-4" /> : null}
                {"Сохранить "}</Button>
            </>
          ) : (
            <>
              <Button variant="outline" disabled={saving} onClick={() => handleOpenChange(false)}>
                {"Отмена "}</Button>
              <Button
                onClick={save}
                disabled={
                  saving ||
                  !providerId.trim() ||
                  (providerType === "oidc" && !issuer.trim()) ||
                  !domain.trim() ||
                  (providerType === "oidc" && (!oidcClientId.trim() || !oidcClientSecret.trim())) ||
                  (providerType === "saml" && !samlMetadata.trim() && (!samlEntryPoint.trim() || !samlCert.trim()))
                }
              >
                {saving ? <SpinnerIcon className="size-4" /> : null}
                {"Регистрация провайдера "}</Button>
            </>
          )
        }
      >
        <div className="space-y-5">
          {/* Provider Type Tabs */}
          <Tabs value={providerType} onValueChange={(v) => setProviderType(v as SSOProviderType)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="oidc">OpenID Connect (OIDC)</TabsTrigger>
              <TabsTrigger value="saml">SAML 2.0</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Provider ID */}
          <div className="space-y-2">
            <Label htmlFor="sso-provider-id">{"Идентификатор поставщика"}</Label>
            <Input
              id="sso-provider-id"
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              placeholder={"например окта-прод, лазурь-объявление"}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              {"Уникальный идентификатор этого поставщика (например, «okta», «azure-ad»). "}</p>
          </div>

          {/* Issuer URL */}
          <div className="space-y-2">
            <Label htmlFor="sso-issuer">{"URL-адрес эмитента"}</Label>
            <Input
              id="sso-issuer"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              placeholder={"например https://ваш-орг.okta.com"}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              {"URL-адрес эмитента вашего поставщика удостоверений. "}</p>
          </div>

          {/* Domain */}
          <div className="space-y-2">
            <Label htmlFor="sso-domain">{"Электронный домен"}</Label>
            <Input
              id="sso-domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder={"например yourcompany.com"}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              {"Пользователи с этим доменом электронной почты будут перенаправлены к этому провайдеру. "}</p>
          </div>

          {/* OIDC Configuration */}
          {providerType === "oidc" && (
            <div className="space-y-4 rounded-lg border p-4">
              <p className="text-sm font-medium">{"Конфигурация ОИДК"}</p>
              <p className="text-xs text-muted-foreground">
                {"Большинство полей автоматически обнаруживаются из документа обнаружения эмитента. "}</p>

              <div className="space-y-2">
                <Label htmlFor="oidc-client-id">{"Идентификатор клиента"}</Label>
                <Input
                  id="oidc-client-id"
                  value={oidcClientId}
                  onChange={(e) => setOidcClientId(e.target.value)}
                  placeholder={"Идентификатор клиента OAuth от вашего поставщика удостоверений"}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="oidc-client-secret">{"Секрет клиента"}</Label>
                <div className="relative">
                  <Input
                    id="oidc-client-secret"
                    type={showOidcSecret ? "text" : "password"}
                    value={oidcClientSecret}
                    onChange={(e) => setOidcClientSecret(e.target.value)}
                    placeholder={"Секрет клиента OAuth от вашего IdP"}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOidcSecret(!showOidcSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showOidcSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SAML Configuration */}
          {providerType === "saml" && (
            <div className="space-y-4 rounded-lg border p-4">
              <p className="text-sm font-medium">{"Конфигурация SAML 2.0"}</p>
              <p className="text-xs text-muted-foreground">
                {"Настройте параметры поставщика удостоверений (IdP) для единого входа SAML. "}</p>

              <div className="space-y-2">
                <Label htmlFor="saml-metadata">{"XML метаданных IdP (рекомендуется)"}</Label>
                <textarea
                  id="saml-metadata"
                  value={samlMetadata}
                  onChange={(e) => setSamlMetadata(e.target.value)}
                  placeholder={"Вставьте XML-код EntityDescriptor из вашего поставщика удостоверений."}
                  className="w-full rounded-md border bg-transparent px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  rows={7}
                />
                <p className="text-xs text-muted-foreground">
                  {"Harly извлекает из этого документа эмитента, URL-адрес единого входа и сертификат подписи. "}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="saml-entry-point">{"Точка входа (URL единого входа)"}</Label>
                <Input
                  id="saml-entry-point"
                  value={samlEntryPoint}
                  onChange={(e) => setSamlEntryPoint(e.target.value)}
                  placeholder="https://idp.example.com/sso"
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="saml-private-key">{"Закрытый ключ SP (только если этого требует IdP)"}</Label>
                <textarea
                  id="saml-private-key"
                  value={samlPrivateKey}
                  onChange={(e) => setSamlPrivateKey(e.target.value)}
                  placeholder="-----BEGIN PRIVATE KEY-----"
                  className="w-full rounded-md border bg-transparent px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  rows={5}
                  spellCheck={false}
                />
                <p className="text-xs text-muted-foreground">
                  {"Хранится только в конфигурации поставщика единого входа. Требуется, если метаданные устанавливают WantAuthnRequestsSigned. "}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="saml-cert">{"Сертификат Х.509"}</Label>
                <div className="relative">
                  <textarea
                    id="saml-cert"
                    value={samlCert}
                    onChange={(e) => setSamlCert(e.target.value)}
                    placeholder={"-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"}
                    className="w-full rounded-md border bg-transparent px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    rows={4}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {"Публичный сертификат вашего поставщика удостоверений для проверки ответов SAML. "}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="saml-audience">{"Аудитория (необязательно)"}</Label>
                <Input
                  id="saml-audience"
                  value={samlAudience}
                  onChange={(e) => setSamlAudience(e.target.value)}
                  placeholder="https://yourapp.com"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  {"Идентификатор объекта SP/URI аудитории (по умолчанию URL-адрес вашего приложения) "}</p>
              </div>
            </div>
          )}

          {/* Callback URL hint */}
          <div className="rounded-lg bg-muted/50 px-3 py-2.5">
            <p className="text-xs font-medium text-muted-foreground">
              {"URL-адрес обратного вызова ACS (установите его в своем поставщике удостоверений): "}</p>
            <code className="mt-1 block break-all text-xs font-mono text-foreground">
              {typeof window !== "undefined" ? window.location.origin : ""}/api/auth/sso/saml2/sp/acs/{providerId || "<provider-id>"}
            </code>
          </div>

          {isEditing && (
            <div className="space-y-3 rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium">{"Проверка домена"}</p>
                <p className="text-xs text-muted-foreground">
                  {"Опубликуйте созданную запись TXT, прежде чем разрешить вход в этот домен электронной почты. "}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" disabled={requestingVerification} onClick={requestDomainVerification}>
                  {requestingVerification ? <SpinnerIcon className="size-4" /> : null}
                  {"Получить DNS-запись "}</Button>
                <Button size="sm" disabled={verifying} onClick={verifyDomain}>
                  {verifying ? <SpinnerIcon className="size-4" /> : null}
                  {"Проверьте DNS "}</Button>
              </div>
              {verificationToken && (
                <div className="rounded-md bg-muted/50 p-3 text-xs">
                  <p className="font-medium">{"ТХТ-хост"}</p>
                  <code className="break-all">_better-auth-token-{existingProvider?.providerId}</code>
                  <p className="mt-2 font-medium">{"Значение ТХТ"}</p>
                  <code className="break-all">{verificationToken}</code>
                </div>
              )}
            </div>
          )}

          {/* Docs link */}
          <a
            href="https://www.better-auth.com/docs/plugins/sso"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="size-3" />
            {"Прочтите документацию по системе единого входа. "}</a>
        </div>
      </DrawerLayout>
    </Sheet>
  );
}
