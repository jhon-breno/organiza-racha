"use client";

import { useMemo, useState } from "react";
import {
  MessageCircle,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Users,
} from "lucide-react";
import {
  bulkAddOrganizerEnrollmentsAction,
  cancelPendingPaymentEnrollmentsAction,
  confirmEnrollmentPaymentAction,
  markEnrollmentRefundedAction,
  removeOrganizerEnrollmentAction,
  sendWhatsappReminderToAllParticipantsAction,
  sendWhatsappReminderToParticipantAction,
  toggleOrganizerEnrollmentFemaleAction,
  toggleOrganizerNextRachaBlockAction,
  updateOrganizerEnrollmentLevelAction,
  updateOrganizerEnrollmentPositionAction,
  updateOrganizerEnrollmentStatusAction,
} from "@/actions";
import { AddAthleteModal } from "@/components/add-athlete-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import {
  levelLabels,
  levelOptions,
  positionOptions,
  positionOptionsFutebol,
  positionOptionsVolei,
} from "@/lib/constants";
import {
  isAwaitingPaymentEnrollment,
  isConfirmedEnrollment,
  isGoalkeeperEnrollment,
} from "@/lib/enrollment";
import { formatDateTimeShort, formatPhone } from "@/lib/utils";

const participantStatusOptions = [
  { value: "ACTIVE", label: "Ativa" },
  { value: "WAITLIST", label: "Lista de espera" },
  { value: "CANCELED", label: "Cancelada" },
];

const paymentStatusOptions = [
  { value: "PENDING", label: "Aguardando pagamento" },
  { value: "PROOF_SENT", label: "Comprovante enviado" },
  { value: "PAID", label: "Pago" },
  { value: "REFUND_REQUESTED", label: "Reembolso solicitado" },
  { value: "REFUNDED", label: "Reembolsado" },
];

type FilterTab = "ALL" | "CONFIRMED" | "PENDING" | "WAITLIST" | "SPECIAL";

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function getUnifiedEnrollmentStatus(
  enrollment: {
    participantPosition?: string;
    status: string;
    paymentStatus: string;
  },
  rachaPriceInCents?: number,
) {
  if (
    enrollment.status === "CANCELED" ||
    enrollment.paymentStatus === "REFUNDED"
  ) {
    return {
      label: "Cancelado",
      badgeClassName: "bg-rose-100 text-rose-700",
    };
  }

  if (enrollment.paymentStatus === "REFUND_REQUESTED") {
    return {
      label: "Aguardando reembolso",
      badgeClassName: "bg-amber-100 text-amber-700",
    };
  }

  if (enrollment.status === "WAITLIST") {
    return {
      label: "Lista de espera",
      badgeClassName: "bg-slate-100 text-slate-700",
    };
  }

  if (isConfirmedEnrollment(enrollment, rachaPriceInCents)) {
    return {
      label: "Confirmado",
      badgeClassName: "bg-emerald-100 text-emerald-800 font-semibold",
    };
  }

  return {
    label: "Aguardando pagamento",
    badgeClassName: "bg-amber-100 text-amber-800 font-semibold",
  };
}

export function EnrollmentManagement({
  enrollments,
  modality,
  priceInCents,
  rachaId,
}: {
  rachaId: string;
  modality: string;
  priceInCents?: number;
  enrollments: {
    id: string;
    participantName: string;
    participantNickname?: string | null;
    participantPhone: string;
    participantPosition: string;
    participantLevel: string;
    isFemale?: boolean;
    status: string;
    paymentStatus: string;
    blockedForNextRacha?: boolean;
    createdAt: Date;
  }[];
}) {
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [participantSearch, setParticipantSearch] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [expandedAthleteIds, setExpandedAthleteIds] = useState<Set<string>>(
    new Set(),
  );

  const toggleAthleteExpanded = (id: string) => {
    setExpandedAthleteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isFutebol = modality === "FUTEBOL";
  const isVolei = modality === "VOLEI";

  const availablePositions = isFutebol
    ? positionOptionsFutebol
    : isVolei
      ? positionOptionsVolei
      : positionOptions;

  const normalizedSearch = normalizeSearchValue(participantSearch);

  const confirmedList = useMemo(
    () => enrollments.filter((e) => isConfirmedEnrollment(e, priceInCents)),
    [enrollments, priceInCents],
  );

  const pendingList = useMemo(
    () =>
      enrollments.filter((e) => isAwaitingPaymentEnrollment(e, priceInCents)),
    [enrollments, priceInCents],
  );

  const waitlistList = useMemo(
    () => enrollments.filter((e) => e.status === "WAITLIST"),
    [enrollments],
  );

  const specialList = useMemo(
    () =>
      enrollments.filter(
        (e) =>
          (isFutebol && e.participantPosition === "Goleiro") ||
          (isVolei && e.participantPosition === "Levantador"),
      ),
    [enrollments, isFutebol, isVolei],
  );

  const filteredEnrollments = useMemo(() => {
    let list = enrollments;

    if (activeTab === "CONFIRMED") {
      list = confirmedList;
    } else if (activeTab === "PENDING") {
      list = pendingList;
    } else if (activeTab === "WAITLIST") {
      list = waitlistList;
    } else if (activeTab === "SPECIAL") {
      list = specialList;
    }

    if (!normalizedSearch) {
      return list;
    }

    return list.filter((enrollment) =>
      [
        enrollment.participantName,
        enrollment.participantNickname ?? "",
        enrollment.participantPhone,
        enrollment.participantPosition,
        levelLabels[enrollment.participantLevel] ?? enrollment.participantLevel,
      ].some((value) => normalizeSearchValue(value).includes(normalizedSearch)),
    );
  }, [
    enrollments,
    activeTab,
    confirmedList,
    pendingList,
    waitlistList,
    specialList,
    normalizedSearch,
  ]);

  return (
    <div className="space-y-4">
      {/* ── Barra de Ações Principais do Organizador ── */}
      <Card className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-950">
              Gestão de Participantes
            </h3>
            <p className="mt-0.5 text-sm text-slate-600">
              Adicione atletas, envie lembretes via WhatsApp e controle pagamentos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <AddAthleteModal modality={modality} rachaId={rachaId} />

            <Button
              onClick={() => setShowBulkImport((current) => !current)}
              type="button"
              variant={showBulkImport ? "secondary" : "outline"}
              size="sm"
            >
              {showBulkImport
                ? "Fechar importação"
                : "Subir atletas massivamente"}
            </Button>

            <form action={sendWhatsappReminderToAllParticipantsAction}>
              <input name="rachaId" type="hidden" value={rachaId} />
              <SubmitButton
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                pendingLabel="Enviando WhatsApp..."
                size="sm"
              >
                <MessageCircle className="h-4 w-4 mr-1.5" />
                Notificar todos via WhatsApp
              </SubmitButton>
            </form>
          </div>
        </div>
      </Card>

      {/* ── Importação em massa recolhível ── */}
      {showBulkImport ? (
        <Card className="space-y-4 border-slate-300 shadow-sm">
          <div>
            <h3 className="text-lg font-bold text-slate-950">
              Importação em massa de atletas
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Cole uma linha por atleta usando o formato:
              <span className="font-semibold text-slate-900">
                {" "}
                nome;telefone;nivel;funcao
              </span>
              . Se a função vier vazia, o sistema usa Versátil.
            </p>
          </div>

          <form
            action={bulkAddOrganizerEnrollmentsAction}
            className="space-y-4"
          >
            <input name="rachaId" type="hidden" value={rachaId} />

            <label className="block space-y-2 text-sm font-medium text-slate-700">
              Lista de atletas
              <Textarea
                className="min-h-40 font-mono text-xs"
                name="bulkEntries"
                placeholder={[
                  "nome;telefone;nivel;funcao",
                  "Joao Silva;85999999999;3;Atacante",
                  "Pedro Lima;85988888888;STAR_4;",
                  "Carlos Souza;85977777777;5;Goleiro",
                ].join("\n")}
                required
              />
            </label>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
              Níveis aceitos: 1 a 5, STAR_1 a STAR_5, INICIANTE, INTERMEDIARIO e AVANCADO.
            </div>

            <div className="flex gap-2">
              <SubmitButton pendingLabel="Importando..." size="sm">
                Importar atletas
              </SubmitButton>
              <Button
                onClick={() => setShowBulkImport(false)}
                type="button"
                variant="outline"
                size="sm"
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {/* ── Filtros e Busca ── */}
      <Card className="space-y-4">
        {/* Tabs de Filtro */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("ALL")}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              activeTab === "ALL"
                ? "bg-slate-950 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            }`}
          >
            Todos ({enrollments.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("CONFIRMED")}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              activeTab === "CONFIRMED"
                ? "bg-emerald-700 text-white shadow-xs"
                : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            }`}
          >
            Confirmados ({confirmedList.length})
          </button>
          {Boolean(priceInCents && priceInCents > 0) && (
            <button
              type="button"
              onClick={() => setActiveTab("PENDING")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                activeTab === "PENDING"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-amber-50 text-amber-800 hover:bg-amber-100"
              }`}
            >
              Aguardando PIX ({pendingList.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab("WAITLIST")}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              activeTab === "WAITLIST"
                ? "bg-slate-700 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Lista de Espera ({waitlistList.length})
          </button>
          {(isFutebol || isVolei) && (
            <button
              type="button"
              onClick={() => setActiveTab("SPECIAL")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                activeTab === "SPECIAL"
                  ? "bg-indigo-700 text-white shadow-xs"
                  : "bg-indigo-50 text-indigo-800 hover:bg-indigo-100"
              }`}
            >
              {isFutebol ? "Goleiros" : "Levantadores"} ({specialList.length})
            </button>
          )}
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full max-w-md">
            <Input
              onChange={(event) => setParticipantSearch(event.target.value)}
              placeholder="Buscar por nome, apelido, telefone ou posição..."
              value={participantSearch}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {Boolean(priceInCents && priceInCents > 0 && pendingList.length > 0) && (
              <form action={cancelPendingPaymentEnrollmentsAction}>
                <input name="rachaId" type="hidden" value={rachaId} />
                <SubmitButton
                  pendingLabel="Cancelando..."
                  size="sm"
                  variant="danger"
                >
                  Cancelar {pendingList.length} pendentes
                </SubmitButton>
              </form>
            )}

            <p className="text-xs text-slate-500">
              Exibindo {filteredEnrollments.length} de {enrollments.length} atleta(s)
            </p>
          </div>
        </div>
      </Card>

      {/* ── Lista de Atletas ── */}
      {enrollments.length === 0 ? (
        <Card className="py-12 text-center">
          <Users className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-semibold text-slate-700">
            Nenhum participante inscrito ainda.
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Adicione atletas pelo botão acima ou compartilhe a página do racha.
          </p>
        </Card>
      ) : filteredEnrollments.length === 0 ? (
        <Card className="py-12 text-center">
          <p className="text-sm font-semibold text-slate-700">
            Nenhum participante encontrado com esse filtro.
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Tente buscar com outro termo ou selecionar outra aba.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredEnrollments.map((enrollment, index) => {
            const unifiedStatus = getUnifiedEnrollmentStatus(
              enrollment,
              priceInCents,
            );

            const positionOptionsForCard = Array.from(
              new Set(
                [...availablePositions, enrollment.participantPosition].filter(
                  Boolean,
                ),
              ),
            );

            const isExpanded = expandedAthleteIds.has(enrollment.id);
            const displayName =
              enrollment.participantNickname?.trim() || enrollment.participantName;

            return (
              <Card
                key={enrollment.id}
                className={`transition duration-150 ${
                  isExpanded ? "ring-1 ring-slate-300" : ""
                }`}
              >
                {/* Linha Principal do Atleta */}
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-black text-slate-700">
                      {index + 1}
                    </span>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-base font-bold text-slate-950">
                          {enrollment.participantName}
                        </h4>

                        {enrollment.participantNickname ? (
                          <Badge className="bg-slate-100 text-slate-700 font-semibold">
                            @{enrollment.participantNickname}
                          </Badge>
                        ) : null}

                        {enrollment.isFemale && (
                          <Badge className="border border-pink-200 bg-pink-100 text-pink-700 font-medium">
                            ♀ Mulher
                          </Badge>
                        )}

                        <Badge className={unifiedStatus.badgeClassName}>
                          {unifiedStatus.label}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <span className="font-semibold text-slate-800">
                          {formatPhone(enrollment.participantPhone)}
                        </span>
                        <span>•</span>
                        <span className="font-medium text-teal-800">
                          {enrollment.participantPosition}
                        </span>
                        <span>•</span>
                        <span className="text-slate-500">
                          {levelLabels[enrollment.participantLevel] ??
                            enrollment.participantLevel}
                        </span>
                        <span>•</span>
                        <span className="text-slate-400">
                          {formatDateTimeShort(enrollment.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ações Rápidas */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0">
                    {/* Botão de Notificar WhatsApp individual */}
                    <form action={sendWhatsappReminderToParticipantAction}>
                      <input
                        name="enrollmentId"
                        type="hidden"
                        value={enrollment.id}
                      />
                      <SubmitButton
                        variant="outline"
                        size="sm"
                        pendingLabel="Enviando..."
                        className="border-emerald-300 bg-emerald-50/50 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900 font-semibold"
                        title={`Enviar lembrete via WhatsApp para ${displayName}`}
                      >
                        <MessageCircle className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                        Notificar WhatsApp
                      </SubmitButton>
                    </form>

                    {/* Botão de Confirmação Rápida de PIX */}
                    {!isGoalkeeperEnrollment(enrollment) &&
                    (enrollment.paymentStatus === "PENDING" ||
                      enrollment.paymentStatus === "PROOF_SENT") ? (
                      <form action={confirmEnrollmentPaymentAction}>
                        <input
                          name="enrollmentId"
                          type="hidden"
                          value={enrollment.id}
                        />
                        <SubmitButton
                          pendingLabel="Confirmando..."
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                        >
                          Confirmar PIX
                        </SubmitButton>
                      </form>
                    ) : null}

                    {/* Botão para abrir os controles detalhados */}
                    <Button
                      onClick={() => toggleAthleteExpanded(enrollment.id)}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-slate-600 hover:text-slate-900"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5 mr-1 text-slate-500" />
                      {isExpanded ? "Ocultar ajustes" : "Ajustar"}
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5 ml-1" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 ml-1" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* ── Painel de Ajustes Expandido ── */}
                {isExpanded ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Ajustes operacionais para {displayName}
                    </p>

                    <div className="flex flex-wrap items-center gap-3">
                      {/* Alterar Nível */}
                      <form
                        action={updateOrganizerEnrollmentLevelAction}
                        className="flex items-center gap-1.5"
                      >
                        <input
                          name="enrollmentId"
                          type="hidden"
                          value={enrollment.id}
                        />
                        <Select
                          defaultValue={enrollment.participantLevel}
                          name="participantLevel"
                          className="text-xs"
                        >
                          {levelOptions.map((level) => (
                            <option key={level.value} value={level.value}>
                              {level.visual} {level.label}
                            </option>
                          ))}
                        </Select>
                        <SubmitButton
                          pendingLabel="Salvando..."
                          size="sm"
                          variant="outline"
                        >
                          Salvar nível
                        </SubmitButton>
                      </form>

                      {/* Alterar Posição */}
                      <form
                        action={updateOrganizerEnrollmentPositionAction}
                        className="flex items-center gap-1.5"
                      >
                        <input
                          name="enrollmentId"
                          type="hidden"
                          value={enrollment.id}
                        />
                        <Select
                          defaultValue={enrollment.participantPosition}
                          name="participantPosition"
                          className="text-xs"
                        >
                          {positionOptionsForCard.map((pos) => (
                            <option key={pos} value={pos}>
                              {pos}
                            </option>
                          ))}
                        </Select>
                        <SubmitButton
                          pendingLabel="Salvando..."
                          size="sm"
                          variant="outline"
                        >
                          Salvar posição
                        </SubmitButton>
                      </form>

                      {/* Flag Mulher */}
                      <form action={toggleOrganizerEnrollmentFemaleAction}>
                        <input
                          name="enrollmentId"
                          type="hidden"
                          value={enrollment.id}
                        />
                        <input
                          name="isFemale"
                          type="hidden"
                          value={enrollment.isFemale ? "false" : "true"}
                        />
                        <SubmitButton
                          className={
                            enrollment.isFemale
                              ? "border-pink-300 bg-pink-50 text-pink-700 hover:bg-pink-100 font-medium"
                              : ""
                          }
                          pendingLabel="Atualizando..."
                          size="sm"
                          variant="outline"
                        >
                          {enrollment.isFemale
                            ? "♀ Mulher (Ativo)"
                            : "♀ Flag Mulher"}
                        </SubmitButton>
                      </form>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 border-t border-slate-200/80 pt-3">
                      {/* Alterar Status */}
                      <form
                        action={updateOrganizerEnrollmentStatusAction}
                        className="flex flex-wrap items-center gap-1.5"
                      >
                        <input
                          name="enrollmentId"
                          type="hidden"
                          value={enrollment.id}
                        />
                        <Select
                          className="min-w-32 text-xs"
                          defaultValue={enrollment.status}
                          name="status"
                        >
                          {participantStatusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                        <Select
                          className="min-w-44 text-xs"
                          defaultValue={enrollment.paymentStatus}
                          name="paymentStatus"
                        >
                          {paymentStatusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                        <SubmitButton
                          pendingLabel="Salvando..."
                          size="sm"
                          variant="outline"
                        >
                          Salvar status
                        </SubmitButton>
                      </form>

                      {enrollment.paymentStatus === "REFUND_REQUESTED" && (
                        <form action={markEnrollmentRefundedAction}>
                          <input
                            name="enrollmentId"
                            type="hidden"
                            value={enrollment.id}
                          />
                          <SubmitButton
                            pendingLabel="Atualizando..."
                            size="sm"
                            variant="outline"
                          >
                            Marcar reembolso
                          </SubmitButton>
                        </form>
                      )}

                      {/* Bloquear para o próximo racha */}
                      <form
                        action={toggleOrganizerNextRachaBlockAction}
                        className="flex flex-wrap items-center gap-1.5"
                      >
                        <input
                          name="enrollmentId"
                          type="hidden"
                          value={enrollment.id}
                        />
                        <input
                          name="active"
                          type="hidden"
                          value={
                            enrollment.blockedForNextRacha ? "false" : "true"
                          }
                        />
                        {!enrollment.blockedForNextRacha ? (
                          <Input
                            className="max-w-52 text-xs"
                            name="reason"
                            placeholder="Motivo do bloqueio (opcional)"
                          />
                        ) : null}
                        <SubmitButton
                          pendingLabel="Atualizando..."
                          size="sm"
                          variant="outline"
                        >
                          {enrollment.blockedForNextRacha
                            ? "Desbloquear próximo racha"
                            : "Bloquear próximo racha"}
                        </SubmitButton>
                      </form>

                      {/* Remover Atleta */}
                      <form action={removeOrganizerEnrollmentAction}>
                        <input
                          name="enrollmentId"
                          type="hidden"
                          value={enrollment.id}
                        />
                        <SubmitButton
                          pendingLabel="Removendo..."
                          size="sm"
                          variant="danger"
                        >
                          Remover participante
                        </SubmitButton>
                      </form>
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
