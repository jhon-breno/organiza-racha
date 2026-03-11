import {
  confirmEnrollmentPaymentAction,
  markEnrollmentRefundedAction,
} from "@/actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/submit-button";
import {
  levelLabels,
  participantStatusLabels,
  paymentStatusLabels,
} from "@/lib/constants";
import { formatDateTimeShort } from "@/lib/utils";

export function EnrollmentManagement({
  enrollments,
}: {
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
  return (
    <div className="space-y-4">
      {enrollments.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">
            Nenhum participante inscrito ainda.
          </p>
        </Card>
      ) : (
        enrollments.map((enrollment) => (
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
                <Badge>
                  {participantStatusLabels[enrollment.status] ??
                    enrollment.status}
                </Badge>
                <Badge className="bg-slate-100 text-slate-700">
                  {paymentStatusLabels[enrollment.paymentStatus] ??
                    enrollment.paymentStatus}
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {enrollment.paymentStatus !== "PAID" ? (
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

              {enrollment.paymentStatus === "REFUND_REQUESTED" ? (
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
              ) : null}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
