"use client";

import { useMemo, useState } from "react";
import {
  addOrganizerEnrollmentAction,
  bulkAddOrganizerEnrollmentsAction,
  cancelPendingPaymentEnrollmentsAction,
  confirmEnrollmentPaymentAction,
  markEnrollmentRefundedAction,
  removeOrganizerEnrollmentAction,
  toggleOrganizerNextRachaBlockAction,
  updateOrganizerEnrollmentLevelAction,
  updateOrganizerEnrollmentStatusAction,
} from "@/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
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

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function getUnifiedEnrollmentStatus(enrollment: {
  participantPosition?: string;
  status: string;
  paymentStatus: string;
}) {
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

  if (isConfirmedEnrollment(enrollment)) {
    return {
      label: "Confirmado",
      badgeClassName: "bg-emerald-100 text-emerald-700",
    };
  }

  return {
    label: "Aguardando pagamento",
    badgeClassName: "bg-amber-100 text-amber-700",
  };
}

export function EnrollmentManagement({
  enrollments,
  modality,
  rachaId,
}: {
  rachaId: string;
  modality: string;
  enrollments: {
    id: string;
    participantName: string;
    participantPhone: string;
    participantPosition: string;
    participantLevel: string;
    status: string;
    paymentStatus: string;
    blockedForNextRacha?: boolean;
    createdAt: Date;
  }[];
}) {
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [participantSearch, setParticipantSearch] = useState("");
  const availablePositions =
    modality === "FUTEBOL"
      ? positionOptionsFutebol
      : modality === "VOLEI"
        ? positionOptionsVolei
        : positionOptions;
  const normalizedSearch = normalizeSearchValue(participantSearch);
  const filteredEnrollments = useMemo(() => {
    if (!normalizedSearch) {
      return enrollments;
    }

    return enrollments.filter((enrollment) =>
      [
        enrollment.participantName,
        enrollment.participantPhone,
        enrollment.participantPosition,
        levelLabels[enrollment.participantLevel] ?? enrollment.participantLevel,
      ].some((value) => normalizeSearchValue(value).includes(normalizedSearch)),
    );
  }, [enrollments, normalizedSearch]);

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-950">
              Incluir participante manualmente
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Adicione atletas no racha com os mesmos dados do formulário de
              inscrição.
            </p>
          </div>

          <Button
            onClick={() => setShowBulkImport((current) => !current)}
            size="sm"
            type="button"
            variant={showBulkImport ? "secondary" : "outline"}
          >
            {showBulkImport
              ? "Fechar importacao em massa"
              : "Subir atletas massivamente"}
          </Button>
        </div>

        <form
          action={addOrganizerEnrollmentAction}
          className="grid gap-4 md:grid-cols-2"
        >
          <input name="rachaId" type="hidden" value={rachaId} />

          <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2">
            Nome
            <Input
              name="participantName"
              placeholder="Nome completo do participante"
              required
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Telefone
            <PhoneInput name="participantPhone" placeholder="99 9 9999-9999" />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Posição
            <Select defaultValue="Versátil" name="participantPosition">
              {availablePositions.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </Select>
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Nível
            <Select defaultValue="STAR_3" name="participantLevel">
              {levelOptions.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.visual} {level.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2">
            Observação (opcional)
            <textarea
              className="flex min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              name="notes"
              placeholder="Ex.: chega 10 min antes, joga melhor na direita..."
            />
          </label>

          <div className="md:col-span-2">
            <SubmitButton pendingLabel="Incluindo..." size="sm">
              Incluir participante
            </SubmitButton>
          </div>
        </form>
      </Card>

      {showBulkImport ? (
        <Card className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-slate-950">
              Importacao em massa
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Cole uma linha por atleta usando o formato:
              <span className="font-semibold"> nome;telefone;nivel;funcao</span>
              . Se a funcao vier vazia, o sistema usa Versatil.
            </p>
          </div>

          <form
            action={bulkAddOrganizerEnrollmentsAction}
            className="space-y-4"
          >
            <input name="rachaId" type="hidden" value={rachaId} />

            <label className="space-y-2 text-sm font-medium text-slate-700">
              Lista de atletas
              <Textarea
                className="min-h-48"
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

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              Niveis aceitos: 1, 2, 3, 4, 5, STAR_1 a STAR_5, INICIANTE,
              INTERMEDIARIO e AVANCADO.
            </div>

            <div>
              <SubmitButton pendingLabel="Importando..." size="sm">
                Importar atletas
              </SubmitButton>
            </div>
          </form>
        </Card>
      ) : null}

      <Card className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-950">
              Localizar participante
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Busque por nome, telefone, posição ou nível para encontrar mais
              rápido.
            </p>
          </div>

          <div className="w-full max-w-md">
            <Input
              onChange={(event) => setParticipantSearch(event.target.value)}
              placeholder="Ex.: João, 8599..., Atacante"
              value={participantSearch}
            />
          </div>
        </div>

        <form action={cancelPendingPaymentEnrollmentsAction}>
          <input name="rachaId" type="hidden" value={rachaId} />
          <SubmitButton pendingLabel="Cancelando..." size="sm" variant="danger">
            Cancelar Inscrições Pendentes Pagamento.
          </SubmitButton>
        </form>

        <p className="text-xs text-slate-500">
          {filteredEnrollments.length} de {enrollments.length} participante(s)
          exibido(s)
        </p>
      </Card>

      {enrollments.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">
            Nenhum participante inscrito ainda.
          </p>
        </Card>
      ) : filteredEnrollments.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">
            Nenhum participante encontrado com esse filtro.
          </p>
        </Card>
      ) : (
        filteredEnrollments.map((enrollment) => {
          const unifiedStatus = getUnifiedEnrollmentStatus(enrollment);

          return (
            <Card key={enrollment.id} className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-950">
                    {enrollment.participantName}
                  </h3>
                  <p className="text-sm text-slate-600">
                    {formatPhone(enrollment.participantPhone)} •{" "}
                    {enrollment.participantPosition} •{" "}
                    {levelLabels[enrollment.participantLevel] ??
                      enrollment.participantLevel}
                  </p>
                  <p className="text-xs text-slate-500">
                    Inscrito em {formatDateTimeShort(enrollment.createdAt)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge className={unifiedStatus.badgeClassName}>
                    {unifiedStatus.label}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <form
                  action={updateOrganizerEnrollmentLevelAction}
                  className="flex items-center gap-2"
                >
                  <input
                    name="enrollmentId"
                    type="hidden"
                    value={enrollment.id}
                  />
                  <Select
                    defaultValue={enrollment.participantLevel}
                    name="participantLevel"
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

                <form
                  action={updateOrganizerEnrollmentStatusAction}
                  className="flex flex-wrap items-center gap-2"
                >
                  <input
                    name="enrollmentId"
                    type="hidden"
                    value={enrollment.id}
                  />
                  <Select
                    className="min-w-40"
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
                    className="min-w-52"
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

                {!isGoalkeeperEnrollment(enrollment) &&
                (enrollment.paymentStatus === "PENDING" ||
                  enrollment.paymentStatus === "PROOF_SENT") ? (
                  <form action={confirmEnrollmentPaymentAction}>
                    <input
                      name="enrollmentId"
                      type="hidden"
                      value={enrollment.id}
                    />
                    <SubmitButton pendingLabel="Confirmando..." size="sm">
                      Confirmar PIX
                    </SubmitButton>
                  </form>
                ) : null}

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

                <form action={removeOrganizerEnrollmentAction}>
                  <input
                    name="enrollmentId"
                    type="hidden"
                    value={enrollment.id}
                  />
                  <SubmitButton
                    pendingLabel="Removendo..."
                    size="sm"
                    variant="outline"
                  >
                    Remover participante
                  </SubmitButton>
                </form>

                <form
                  action={toggleOrganizerNextRachaBlockAction}
                  className="space-y-2"
                >
                  <input
                    name="enrollmentId"
                    type="hidden"
                    value={enrollment.id}
                  />
                  <input
                    name="active"
                    type="hidden"
                    value={enrollment.blockedForNextRacha ? "false" : "true"}
                  />
                  {!enrollment.blockedForNextRacha ? (
                    <Input
                      className="max-w-64"
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
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
