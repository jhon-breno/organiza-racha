"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Calendar,
  Coins,
  Edit3,
  ExternalLink,
  MapPin,
  MessageCircle,
  Users,
  X,
} from "lucide-react";
import { createRachaAction, updateRachaAction } from "@/actions";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  futebolTypeOptions,
  modalities,
  visibilityOptions,
  voleiTypeOptions,
  voleiTypesWithSetter,
} from "@/lib/constants";
import {
  formatCurrencyFromCents,
  formatDateInput,
  formatDateTime,
  formatDateTimeShort,
  formatTimeInput,
} from "@/lib/utils";

type RachaFormValues = {
  id?: string;
  title?: string;
  modality?: string;
  description?: string | null;
  rules?: string;
  athleteLimit?: number;
  eventDate?: Date;
  eventEndDate?: Date | null;
  paymentDeadline?: Date | null;
  locationName?: string;
  address?: string;
  city?: string;
  state?: string | null;
  mapsQuery?: string | null;
  priceInCents?: number;
  whatsappGroupUrl?: string | null;
  coverImageUrl?: string | null;
  profileImageUrl?: string | null;
  visibility?: string;
  accessKey?: string | null;
  cancellationWindowHours?: number;
  autoNotifyReminder?: boolean;
  autoNotifyHoursBefore?: number | null;
  reminderSentAt?: Date | null;
  notifyEnrollmentConfirmation?: boolean | null;
  futebolType?: string | null;
  goalkeeperLimit?: number | null;
  voleiType?: string | null;
  hasFixedSetter?: boolean;
  setterLimit?: number | null;
};

export function RachaForm({
  defaultValues,
}: {
  defaultValues?: RachaFormValues;
}) {
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const isEditing = Boolean(defaultValues?.id);
  const action = isEditing ? updateRachaAction : createRachaAction;
  const draftStorageKey = useMemo(
    () =>
      isEditing ? `racha-form:edit:${defaultValues?.id}` : "racha-form:new",
    [defaultValues?.id, isEditing],
  );
  const hasValidationError = searchParams.get("status") === "error";
  const fieldWithError = searchParams.get("field");

  const [modality, setModality] = useState(
    defaultValues?.modality ?? "FUTEBOL",
  );
  const [visibility, setVisibility] = useState(
    defaultValues?.visibility ?? "OPEN",
  );
  const [voleiType, setVoleiType] = useState(defaultValues?.voleiType ?? "");
  const [hasFixedSetter, setHasFixedSetter] = useState(
    defaultValues?.hasFixedSetter ?? false,
  );
  const [isFree, setIsFree] = useState(
    defaultValues ? defaultValues.priceInCents === 0 : false,
  );
  const [autoNotifyReminder, setAutoNotifyReminder] = useState(
    defaultValues?.autoNotifyReminder ?? false,
  );
  const [notifyEnrollmentConfirmation, setNotifyEnrollmentConfirmation] =
    useState(defaultValues?.notifyEnrollmentConfirmation ?? true);

  const isFutebol = modality === "FUTEBOL";
  const isVolei = modality === "VOLEI";
  const isPrivateVisibility = visibility === "PRIVATE";
  const showSetterLimit =
    isVolei && hasFixedSetter && voleiTypesWithSetter.has(voleiType);
  const minEventDate = formatDateInput(new Date());

  const [isEditingOpen, setIsEditingOpen] = useState(
    !isEditing || hasValidationError || searchParams.get("edit") === "true",
  );

  function saveDraftSnapshot() {
    if (!formRef.current) {
      return;
    }

    const snapshot: Record<string, string> = {};
    const formData = new FormData(formRef.current);

    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") {
        snapshot[key] = value;
      }
    }

    const checkboxes = formRef.current.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"][name]',
    );

    checkboxes.forEach((checkbox) => {
      snapshot[checkbox.name] = checkbox.checked ? checkbox.value || "on" : "";
    });

    sessionStorage.setItem(draftStorageKey, JSON.stringify(snapshot));
  }

  useEffect(() => {
    if (!hasValidationError) {
      sessionStorage.removeItem(draftStorageKey);
      return;
    }

    const rawSnapshot = sessionStorage.getItem(draftStorageKey);

    if (!rawSnapshot || !formRef.current) {
      return;
    }

    try {
      const snapshot = JSON.parse(rawSnapshot) as Record<string, string>;

      const applySnapshot = () => {
        if (!formRef.current) {
          return;
        }

        for (const [name, value] of Object.entries(snapshot)) {
          const elements = formRef.current.querySelectorAll<
            HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
          >(`[name="${CSS.escape(name)}"]`);

          elements.forEach((element) => {
            if (
              element instanceof HTMLInputElement &&
              element.type === "checkbox"
            ) {
              element.checked = value === "true" || value === "on";

              if (element.name === "hasFixedSetter") {
                element.dispatchEvent(new Event("change", { bubbles: true }));
              }

              return;
            }

            element.value = value;

            if (
              element.name === "modality" ||
              element.name === "voleiType" ||
              element.name === "visibility"
            ) {
              element.dispatchEvent(new Event("change", { bubbles: true }));
            }
          });
        }
      };

      requestAnimationFrame(() => {
        applySnapshot();
        requestAnimationFrame(applySnapshot);
      });
    } catch {
      sessionStorage.removeItem(draftStorageKey);
    }
  }, [draftStorageKey, hasValidationError]);

  useEffect(() => {
    if (!hasValidationError || !fieldWithError || !formRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (!formRef.current || !fieldWithError) {
        return;
      }

      const target = formRef.current.querySelector<HTMLElement>(
        `[name="${CSS.escape(fieldWithError)}"]`,
      );

      if (!target) {
        return;
      }

      target.focus();
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [
    fieldWithError,
    hasValidationError,
    modality,
    voleiType,
    hasFixedSetter,
    visibility,
  ]);

  if (isEditing && !isEditingOpen && defaultValues) {
    const modalityLabel =
      modalities.find((m) => m.value === (defaultValues.modality ?? "FUTEBOL"))
        ?.label ?? defaultValues.modality;
    const futebolLabel = futebolTypeOptions.find(
      (f) => f.value === defaultValues.futebolType,
    )?.label;
    const voleiLabel = voleiTypeOptions.find(
      (v) => v.value === defaultValues.voleiType,
    )?.label;
    const isFreeRacha = defaultValues.priceInCents === 0;

    return (
      <Card className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-slate-900 text-white font-semibold">
                {modalityLabel}
              </Badge>
              {futebolLabel && (
                <Badge className="border border-slate-200 bg-white text-slate-700 font-semibold">
                  {futebolLabel}
                </Badge>
              )}
              {voleiLabel && (
                <Badge className="border border-slate-200 bg-white text-slate-700 font-semibold">
                  {voleiLabel}
                </Badge>
              )}
              <Badge
                className={
                  defaultValues.visibility === "PRIVATE"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-emerald-800"
                }
              >
                {defaultValues.visibility === "PRIVATE"
                  ? "Privado"
                  : "Público"}
              </Badge>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950">
              Informações do Racha
            </h2>
            <p className="text-xs text-slate-500">
              Configurações operacionais, local, regras e pagamentos.
            </p>
          </div>

          <Button
            onClick={() => setIsEditingOpen(true)}
            type="button"
            className="flex items-center gap-2 font-bold shadow-xs"
          >
            <Edit3 className="h-4 w-4" />
            Editar racha
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Calendar className="h-3.5 w-3.5 text-teal-600" />
              Data e Horário
            </div>
            <p className="text-sm font-bold text-slate-900">
              {defaultValues.eventDate
                ? formatDateTime(
                    defaultValues.eventDate,
                    defaultValues.eventEndDate,
                  )
                : "Não definido"}
            </p>
            {defaultValues.cancellationWindowHours ? (
              <p className="text-xs text-slate-500">
                Desistência até {defaultValues.cancellationWindowHours}h antes
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <MapPin className="h-3.5 w-3.5 text-rose-600" />
              Local
            </div>
            <p className="text-sm font-bold text-slate-900 truncate">
              {defaultValues.locationName || "Local não informado"}
            </p>
            <p className="text-xs text-slate-600 truncate">
              {defaultValues.address}
              {defaultValues.city ? `, ${defaultValues.city}` : ""}
              {defaultValues.state ? ` - ${defaultValues.state}` : ""}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Users className="h-3.5 w-3.5 text-indigo-600" />
              Vagas e Formato
            </div>
            <p className="text-sm font-bold text-slate-900">
              {defaultValues.athleteLimit} atletas{" "}
              {defaultValues.modality === "FUTEBOL" ? "de linha" : "totais"}
            </p>
            <p className="text-xs text-slate-600">
              {defaultValues.modality === "FUTEBOL" &&
              defaultValues.goalkeeperLimit
                ? `${defaultValues.goalkeeperLimit} goleiro(s) por time`
                : defaultValues.modality === "VOLEI" &&
                    defaultValues.hasFixedSetter &&
                    defaultValues.setterLimit
                  ? `${defaultValues.setterLimit} levantador(es) fixo(s)`
                  : "Sem funções especiais"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Coins className="h-3.5 w-3.5 text-emerald-600" />
              Valor da Inscrição
            </div>
            <p className="text-sm font-bold text-slate-900">
              {isFreeRacha
                ? "100% Gratuito"
                : formatCurrencyFromCents(defaultValues.priceInCents ?? 0)}
            </p>
            {!isFreeRacha && defaultValues.paymentDeadline ? (
              <p className="text-xs text-slate-500">
                Pagar até:{" "}
                {formatDateTimeShort(defaultValues.paymentDeadline)}
              </p>
            ) : null}
          </div>
        </div>

        {defaultValues.whatsappGroupUrl ? (
          <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-xs text-emerald-950">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-emerald-700 shrink-0" />
              <span className="font-semibold text-emerald-900">
                Grupo do WhatsApp do Racha ativo
              </span>
            </div>
            <a
              href={defaultValues.whatsappGroupUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-bold text-emerald-800 hover:underline"
            >
              Abrir link <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : null}

        {defaultValues.autoNotifyReminder ? (
          <div className="flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50/60 px-4 py-3 text-xs text-blue-950">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-600 shrink-0" />
              <span className="font-semibold text-blue-900">
                Lembrete automático via WhatsApp ativo:{" "}
                {defaultValues.autoNotifyHoursBefore ?? 2}h antes do jogo
              </span>
            </div>
            {defaultValues.reminderSentAt ? (
              <span className="font-bold text-emerald-700">
                Enviado em {formatDateTimeShort(defaultValues.reminderSentAt)}
              </span>
            ) : (
              <span className="text-blue-700">Aguardando horário</span>
            )}
          </div>
        ) : null}

        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-xs text-slate-800">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2 w-2 rounded-full shrink-0 ${
                (defaultValues.notifyEnrollmentConfirmation ?? true)
                  ? "bg-emerald-600"
                  : "bg-slate-400"
              }`}
            />
            <span className="font-semibold text-slate-900">
              Confirmação de inscrição no WhatsApp:{" "}
              <span
                className={
                  (defaultValues.notifyEnrollmentConfirmation ?? true)
                    ? "text-emerald-700 font-bold"
                    : "text-slate-500"
                }
              >
                {(defaultValues.notifyEnrollmentConfirmation ?? true)
                  ? "Ativada"
                  : "Desativada"}
              </span>
            </span>
          </div>
        </div>

        {defaultValues.description || defaultValues.rules ? (
          <div className="grid gap-4 md:grid-cols-2 text-sm">
            {defaultValues.description ? (
              <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Descrição
                </span>
                <p className="text-slate-700 text-xs leading-relaxed whitespace-pre-line">
                  {defaultValues.description}
                </p>
              </div>
            ) : null}

            {defaultValues.rules ? (
              <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Regras do Racha
                </span>
                <p className="text-slate-700 text-xs leading-relaxed whitespace-pre-line">
                  {defaultValues.rules}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>
    );
  }

  return (
    <form
      action={action}
      className="space-y-6"
      onSubmitCapture={saveDraftSnapshot}
      ref={formRef}
    >
      {defaultValues?.id ? (
        <input name="id" type="hidden" value={defaultValues.id} />
      ) : null}

      <Card className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <Badge>{isEditing ? "Edição do Racha" : "Dados principais"}</Badge>
            <h2 className="text-2xl font-bold text-slate-950">
              {isEditing ? "Editar configurações do racha" : "Criar um novo racha"}
            </h2>
            <p className="text-sm text-slate-600">
              {isEditing
                ? "Atualize as informações operacionais, datas, local e regras deste racha."
                : "Preencha as informações públicas e operacionais para publicar o racha."}
            </p>
          </div>

          {isEditing ? (
            <Button
              onClick={() => setIsEditingOpen(false)}
              type="button"
              variant="outline"
              size="sm"
              className="flex items-center gap-1.5"
            >
              <X className="h-4 w-4" />
              Recolher edição
            </Button>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2">
            Nome do racha
            <Input
              defaultValue={defaultValues?.title}
              name="title"
              placeholder="Ex.: Racha das Quartas"
              required
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Modalidade
            <Select
              defaultValue={defaultValues?.modality ?? "FUTEBOL"}
              name="modality"
              onChange={(e) => setModality(e.target.value)}
            >
              {modalities.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            {isFutebol ? "Atletas de linha" : "Quantidade de atletas"}
            <Input
              defaultValue={defaultValues?.athleteLimit ?? 20}
              min={4}
              name="athleteLimit"
              type="number"
              required
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2">
            Descrição rápida
            <Textarea
              defaultValue={defaultValues?.description ?? ""}
              name="description"
              placeholder="Explique o clima do racha, nível esperado e qualquer observação útil."
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2">
            Regras do racha
            <Textarea
              defaultValue={defaultValues?.rules}
              name="rules"
              placeholder="Ex.: atraso máximo, forma de escolha dos times, proibição de faltas duras..."
              required
            />
          </label>
        </div>
      </Card>

      {/* ── Seção específica do Futebol ── */}
      {isFutebol ? (
        <Card className="space-y-6">
          <div>
            <h3 className="text-xl font-bold text-slate-950">
              Configurações de futebol
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Defina o formato do jogo e a quantidade de goleiros por time.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Tipo de futebol
              <Select
                defaultValue={defaultValues?.futebolType ?? ""}
                name="futebolType"
              >
                <option value="">Selecione o formato</option>
                {futebolTypeOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </label>

            <label className="space-y-2 text-sm font-medium text-slate-700">
              Vagas para goleiro (por time)
              <Select
                defaultValue={String(defaultValues?.goalkeeperLimit ?? "1")}
                name="goalkeeperLimit"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={String(n)}>
                    {n} {n === 1 ? "goleiro" : "goleiros"}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </Card>
      ) : null}

      {/* ── Seção específica do Vôlei ── */}
      {isVolei ? (
        <Card className="space-y-6">
          <div>
            <h3 className="text-xl font-bold text-slate-950">
              Configurações de vôlei
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Defina o formato do jogo e as regras de levantador.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2">
              Tipo de vôlei
              <Select
                defaultValue={defaultValues?.voleiType ?? ""}
                name="voleiType"
                onChange={(e) => setVoleiType(e.target.value)}
              >
                <option value="">Selecione o formato</option>
                {voleiTypeOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </label>

            {voleiTypesWithSetter.has(voleiType) ? (
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 md:col-span-2">
                <input
                  checked={hasFixedSetter}
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                  name="hasFixedSetter"
                  onChange={(e) => setHasFixedSetter(e.target.checked)}
                  type="checkbox"
                  value="true"
                />
                <span>
                  <strong>Levantador fixo</strong> — o atleta que se inscrever
                  como Levantador ficará fixo nessa função durante o jogo.
                </span>
              </label>
            ) : null}

            {showSetterLimit ? (
              <label className="space-y-2 text-sm font-medium text-slate-700">
                Vagas para levantador
                <Select
                  defaultValue={String(defaultValues?.setterLimit ?? "1")}
                  name="setterLimit"
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={String(n)}>
                      {n} {n === 1 ? "levantador" : "levantadores"}
                    </option>
                  ))}
                </Select>
              </label>
            ) : null}
          </div>
        </Card>
      ) : null}

      <Card className="space-y-6">
        <div>
          <h3 className="text-xl font-bold text-slate-950">
            Data, horário e valor
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Defina quando o racha acontece, se é gratuito ou pago, e as regras de desistência.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-sm font-bold text-slate-900">Tipo de Cobrança do Racha</span>
              <p className="text-xs text-slate-600">Escolha se os participantes pagarão taxa ou se o racha será 100% gratuito.</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setIsFree(false)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  !isFree
                    ? "bg-slate-950 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Cobrar Valor (Pago)
              </button>
              <button
                type="button"
                onClick={() => setIsFree(true)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  isFree
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-emerald-700"
                }`}
              >
                Racha Gratuito (R$ 0,00)
              </button>
            </div>
          </div>

          {isFree ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-950 flex items-start gap-2.5">
              <span className="mt-0.5 inline-block h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              <div>
                <p className="font-bold text-emerald-900">Racha Gratuito Ativado</p>
                <p className="mt-0.5 leading-relaxed text-emerald-800">
                  Os atletas não pagarão taxa para participar. Sem cobrança de PIX e sem prazo de pagamento. Ao se inscreverem, entrarão diretamente na lista de confirmados.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-2 text-sm font-medium text-slate-700">
            Data
            <Input
              defaultValue={
                defaultValues?.eventDate
                  ? formatDateInput(defaultValues.eventDate)
                  : ""
              }
              min={isEditing ? undefined : minEventDate}
              name="eventDate"
              type="date"
              required
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Horário de início
            <Input
              defaultValue={
                defaultValues?.eventDate
                  ? formatTimeInput(defaultValues.eventDate)
                  : ""
              }
              name="eventTime"
              type="time"
              required
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Horário de encerramento
            <Input
              defaultValue={
                defaultValues?.eventEndDate
                  ? formatTimeInput(defaultValues.eventEndDate)
                  : ""
              }
              name="eventEndTime"
              type="time"
            />
          </label>

          <input name="isRecurring" type="hidden" value="false" />
          <input name="recurrenceFrequency" type="hidden" value="" />

          {!isFree ? (
            <>
              <label className="space-y-2 text-sm font-medium text-slate-700">
                Prazo pagamento (data)
                <Input
                  defaultValue={
                    defaultValues?.paymentDeadline
                      ? formatDateInput(defaultValues.paymentDeadline)
                      : ""
                  }
                  min={isEditing ? undefined : minEventDate}
                  name="paymentDeadlineDate"
                  type="date"
                />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Prazo pagamento (hora)
                <Input
                  defaultValue={
                    defaultValues?.paymentDeadline
                      ? formatTimeInput(defaultValues.paymentDeadline)
                      : ""
                  }
                  name="paymentDeadlineTime"
                  type="time"
                />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Valor por atleta (R$)
                <Input
                  defaultValue={
                    defaultValues?.priceInCents
                      ? defaultValues.priceInCents / 100
                      : 10
                  }
                  min={0}
                  name="price"
                  step="0.01"
                  type="number"
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val === 0) {
                      setIsFree(true);
                    }
                  }}
                  required
                />
              </label>
            </>
          ) : (
            <>
              <input name="paymentDeadlineDate" type="hidden" value="" />
              <input name="paymentDeadlineTime" type="hidden" value="" />
              <input name="price" type="hidden" value="0" />
              <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-800 lg:col-span-3 flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-emerald-950">Isento de cobrança</p>
                  <p className="mt-0.5">Valor definido como R$ 0,00 (Gratuito)</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFree(false)}
                  className="text-xs font-semibold underline text-emerald-700 hover:text-emerald-900"
                >
                  Alterar para Pago
                </button>
              </div>
            </>
          )}

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Prazo de desistência (h)
            <Input
              defaultValue={defaultValues?.cancellationWindowHours ?? 2}
              min={1}
              max={48}
              name="cancellationWindowHours"
              type="number"
              required
            />
          </label>
        </div>
      </Card>

      <Card className="space-y-6">
        <div>
          <h3 className="text-xl font-bold text-slate-950">
            Local e Google Maps
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Esses campos alimentam a busca e o mapa exibido na página do racha.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-slate-700">
            Nome do local
            <Input
              defaultValue={defaultValues?.locationName}
              name="locationName"
              placeholder="Ex.: Arena Zona Sul"
              required
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Cidade
            <Input
              defaultValue={defaultValues?.city}
              name="city"
              placeholder="Ex.: São Paulo"
              required
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2">
            Endereço
            <Input
              defaultValue={defaultValues?.address}
              name="address"
              placeholder="Rua, número, bairro"
              required
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Estado (sigla)
            <Input
              defaultValue={defaultValues?.state ?? ""}
              maxLength={2}
              name="state"
              placeholder="SP"
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Consulta do Maps
            <Input
              defaultValue={defaultValues?.mapsQuery ?? ""}
              name="mapsQuery"
              placeholder="Ex.: Arena Zona Sul São Paulo"
            />
          </label>
        </div>
      </Card>

      <Card className="space-y-6">
        <div>
          <h3 className="text-xl font-bold text-slate-950">Mídia e acesso</h3>
          <p className="mt-1 text-sm text-slate-600">
            As imagens são opcionais. Os dados do organizador e do PIX vêm do
            painel administrativo; aqui você só define o que é específico deste
            racha.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2">
            Link do grupo do WhatsApp
            <Input
              defaultValue={defaultValues?.whatsappGroupUrl ?? ""}
              name="whatsappGroupUrl"
              placeholder="https://chat.whatsapp.com/..."
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            URL da capa
            <Input
              defaultValue={defaultValues?.coverImageUrl ?? ""}
              name="coverImageUrl"
              placeholder="https://... (opcional)"
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            URL da imagem de perfil
            <Input
              defaultValue={defaultValues?.profileImageUrl ?? ""}
              name="profileImageUrl"
              placeholder="https://... (opcional)"
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Visibilidade
            <Select
              defaultValue={defaultValues?.visibility ?? "OPEN"}
              name="visibility"
              onChange={(e) => setVisibility(e.target.value)}
            >
              {visibilityOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </label>

          {isPrivateVisibility ? (
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Chave secreta
              <Input
                defaultValue={defaultValues?.accessKey ?? ""}
                name="accessKey"
                placeholder="Ex.: VIP2026"
              />
            </label>
          ) : null}
        </div>
      </Card>

      <Card className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-600 text-white font-semibold">
              WhatsApp BotBot
            </Badge>
            {defaultValues?.reminderSentAt ? (
              <Badge className="border border-emerald-300 bg-emerald-50 text-emerald-800">
                Lembrete já disparado
              </Badge>
            ) : null}
          </div>
          <h3 className="mt-2 text-xl font-bold text-slate-950">
            Lembrete Automático Pré-Jogo via WhatsApp
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Configure o disparo automático de lembrete no WhatsApp para os atletas confirmados na lista oficial antes da partida.
          </p>
        </div>

        <div className="space-y-4">
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <input
              checked={notifyEnrollmentConfirmation}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              name="notifyEnrollmentConfirmation"
              onChange={(e) => setNotifyEnrollmentConfirmation(e.target.checked)}
              type="checkbox"
              value="true"
            />
            <div className="space-y-1">
              <span className="font-bold text-slate-900">
                Enviar confirmação de inscrição para o atleta inscrito
              </span>
              <p className="text-xs text-slate-600">
                Dispara automaticamente uma notificação no WhatsApp do atleta com os dados de confirmação ou dados do PIX logo após ele se inscrever.
              </p>
            </div>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <input
              checked={autoNotifyReminder}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              name="autoNotifyReminder"
              onChange={(e) => setAutoNotifyReminder(e.target.checked)}
              type="checkbox"
              value="true"
            />
            <div className="space-y-1">
              <span className="font-bold text-slate-900">
                Ativar envio de lembrete automático no WhatsApp
              </span>
              <p className="text-xs text-slate-600">
                O sistema enviará a notificação para os atletas confirmados (exclui lista de espera e cancelados), contendo local, data, hora e link para desistência se necessário.
              </p>
            </div>
          </label>

          {autoNotifyReminder ? (
            <div className="grid gap-4 md:grid-cols-2 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
              <label className="space-y-2 text-sm font-medium text-slate-700">
                Horas de antecedência para disparo
                <Input
                  defaultValue={defaultValues?.autoNotifyHoursBefore ?? 2}
                  min={1}
                  max={72}
                  name="autoNotifyHoursBefore"
                  type="number"
                  required
                />
                <span className="block text-xs text-slate-500">
                  Ex.: 2 horas antes do início do racha.
                </span>
              </label>

              <div className="flex flex-col justify-center text-xs text-slate-600 space-y-1">
                <p className="font-bold text-slate-900">🛡️ Proteção Anti-Spam:</p>
                <p>
                  As notificações em massa são enviadas com intervalo de 20 segundos entre cada participante para evitar restrições no número do WhatsApp.
                </p>
              </div>
            </div>
          ) : (
            <input name="autoNotifyHoursBefore" type="hidden" value="" />
          )}

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <input
              checked={notifyEnrollmentConfirmation}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              name="notifyEnrollmentConfirmation"
              onChange={(e) => setNotifyEnrollmentConfirmation(e.target.checked)}
              type="checkbox"
              value="true"
            />
            <div className="space-y-1">
              <span className="font-bold text-slate-900">
                Enviar confirmação de inscrição para o atleta inscrito
              </span>
              <p className="text-xs text-slate-600">
                Dispara automaticamente uma mensagem no WhatsApp do atleta com os dados da inscrição (ou instruções de pagamento via PIX para racha pago) no momento em que ele se inscreve.
              </p>
            </div>
          </label>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton
          pendingLabel={isEditing ? "Atualizando..." : "Criando..."}
        >
          {isEditing ? "Salvar alterações" : "Publicar racha"}
        </SubmitButton>

        {isEditing ? (
          <Button
            onClick={() => setIsEditingOpen(false)}
            type="button"
            variant="outline"
          >
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}
