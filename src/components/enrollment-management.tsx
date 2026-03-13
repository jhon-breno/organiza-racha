import {
  addOrganizerEnrollmentAction,
  confirmEnrollmentPaymentAction,
  markEnrollmentRefundedAction,
} from "@/actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import {
  levelLabels,
  levelOptions,
  positionOptions,
  positionOptionsFutebol,
  positionOptionsVolei,
} from "@/lib/constants";
import { formatDateTimeShort } from "@/lib/utils";

function getUnifiedEnrollmentStatus(enrollment: {
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

  if (enrollment.paymentStatus === "PAID") {
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
  const availablePositions =
    modality === "FUTEBOL"
      ? positionOptionsFutebol
      : modality === "VOLEI"
        ? positionOptionsVolei
        : positionOptions;

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-950">
            Incluir participante manualmente
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Adicione atletas no racha com os mesmos dados do formulário de
            inscrição.
          </p>
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
            <Input name="participantPhone" placeholder="11999999999" required />
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
            <Select defaultValue="INTERMEDIARIO" name="participantLevel">
              {levelOptions.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label}
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
                {enrollment.paymentStatus === "PENDING" ||
                enrollment.paymentStatus === "PROOF_SENT" ? (
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
