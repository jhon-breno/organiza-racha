"use client";

import { useState } from "react";
import {
  addOrganizerEnrollmentAction,
  bulkAddOrganizerEnrollmentsAction,
  confirmEnrollmentPaymentAction,
  markEnrollmentRefundedAction,
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
import { formatDateTimeShort } from "@/lib/utils";

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
    createdAt: Date;
  }[];
}) {
  const [showBulkImport, setShowBulkImport] = useState(false);
  const availablePositions =
    modality === "FUTEBOL"
      ? positionOptionsFutebol
      : modality === "VOLEI"
        ? positionOptionsVolei
        : positionOptions;

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
            {showBulkImport ? "Fechar importacao em massa" : "Subir atletas massivamente"}
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
            <PhoneInput
              name="participantPhone"
              placeholder="99 9 9999-9999"
              required
            />
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
              <span className="font-semibold"> nome;telefone;nivel;funcao</span>.
              Se a funcao vier vazia, o sistema usa Versatil.
            </p>
          </div>

          <form action={bulkAddOrganizerEnrollmentsAction} className="space-y-4">
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

      {enrollments.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">
            Nenhum participante inscrito ainda.
          </p>
        </Card>
      ) : (
        enrollments.map((enrollment) => {
          const unifiedStatus = getUnifiedEnrollmentStatus(enrollment);

          return (
            <Card key={enrollment.id} className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-950">
                    {enrollment.participantName}
                  </h3>
                  <p className="text-sm text-slate-600">
                    {enrollment.participantPhone} •{" "}
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
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
