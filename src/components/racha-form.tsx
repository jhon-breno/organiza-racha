"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createRachaAction, updateRachaAction } from "@/actions";
import { SubmitButton } from "@/components/submit-button";
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
import { formatDateInput, formatTimeInput } from "@/lib/utils";

type RachaFormValues = {
  id?: string;
  title?: string;
  modality?: string;
  description?: string | null;
  rules?: string;
  athleteLimit?: number;
  eventDate?: Date;
  locationName?: string;
  address?: string;
  city?: string;
  state?: string | null;
  mapsQuery?: string | null;
  priceInCents?: number;
  organizerDisplayName?: string;
  phoneWhatsapp?: string;
  whatsappGroupUrl?: string | null;
  pixKey?: string;
  coverImageUrl?: string | null;
  profileImageUrl?: string | null;
  visibility?: string;
  accessKey?: string | null;
  cancellationWindowHours?: number;
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
  const [voleiType, setVoleiType] = useState(defaultValues?.voleiType ?? "");
  const [hasFixedSetter, setHasFixedSetter] = useState(
    defaultValues?.hasFixedSetter ?? false,
  );

  const isFutebol = modality === "FUTEBOL";
  const isVolei = modality === "VOLEI";
  const showSetterLimit =
    isVolei && hasFixedSetter && voleiTypesWithSetter.has(voleiType);

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

            if (element.name === "modality" || element.name === "voleiType") {
              element.dispatchEvent(new Event("change", { bubbles: true }));
            }
          });
        }
      };

      requestAnimationFrame(() => {
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
  }, [fieldWithError, hasValidationError, modality, voleiType, hasFixedSetter]);

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
        <div className="space-y-2">
          <Badge>Dados principais</Badge>
          <h2 className="text-2xl font-bold text-slate-950">
            {isEditing ? "Editar racha" : "Criar um novo racha"}
          </h2>
          <p className="text-sm text-slate-600">
            Preencha as informações públicas e operacionais para publicar o
            racha.
          </p>
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
            Defina quando o racha acontece, quanto custa e qual a janela de
            desistência.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-2 text-sm font-medium text-slate-700">
            Data
            <Input
              defaultValue={
                defaultValues?.eventDate
                  ? formatDateInput(defaultValues.eventDate)
                  : ""
              }
              name="eventDate"
              type="date"
              required
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Horário
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
            Valor por atleta (R$)
            <Input
              defaultValue={
                defaultValues?.priceInCents
                  ? defaultValues.priceInCents / 100
                  : 0
              }
              min={0}
              name="price"
              step="0.01"
              type="number"
              required
            />
          </label>

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
          <h3 className="text-xl font-bold text-slate-950">
            Organizador e pagamento
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Dados usados para contato, ingresso no grupo e conferência manual do
            PIX.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-slate-700">
            Nome do organizador
            <Input
              defaultValue={defaultValues?.organizerDisplayName}
              name="organizerDisplayName"
              placeholder="Seu nome público no racha"
              required
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            WhatsApp
            <Input
              defaultValue={defaultValues?.phoneWhatsapp}
              name="phoneWhatsapp"
              placeholder="11999999999"
              required
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Link do grupo do WhatsApp
            <Input
              defaultValue={defaultValues?.whatsappGroupUrl ?? ""}
              name="whatsappGroupUrl"
              placeholder="https://chat.whatsapp.com/..."
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Chave PIX
            <Input
              defaultValue={defaultValues?.pixKey}
              name="pixKey"
              placeholder="CPF, e-mail, telefone ou chave aleatória"
              required
            />
          </label>
        </div>
      </Card>

      <Card className="space-y-6">
        <div>
          <h3 className="text-xl font-bold text-slate-950">Mídia e acesso</h3>
          <p className="mt-1 text-sm text-slate-600">
            Você pode manter URLs de imagens externas e definir se o racha será
            aberto ou privado.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-slate-700">
            URL da capa
            <Input
              defaultValue={defaultValues?.coverImageUrl ?? ""}
              name="coverImageUrl"
              placeholder="https://..."
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            URL da imagem de perfil
            <Input
              defaultValue={defaultValues?.profileImageUrl ?? ""}
              name="profileImageUrl"
              placeholder="https://..."
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Visibilidade
            <Select
              defaultValue={defaultValues?.visibility ?? "OPEN"}
              name="visibility"
            >
              {visibilityOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Chave secreta
            <Input
              defaultValue={defaultValues?.accessKey ?? ""}
              name="accessKey"
              placeholder="Ex.: VIP2026"
            />
          </label>
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <SubmitButton
          pendingLabel={isEditing ? "Atualizando..." : "Criando..."}
        >
          {isEditing ? "Salvar alterações" : "Publicar racha"}
        </SubmitButton>
      </div>
    </form>
  );
}
