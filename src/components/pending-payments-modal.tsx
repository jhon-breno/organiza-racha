"use client";

import { useMemo, useState } from "react";
import { Check, Clock3, Trash2, X, AlertCircle } from "lucide-react";
import {
  confirmEnrollmentPaymentAction,
  removeOrganizerPendingEnrollmentAction,
} from "@/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { paymentStatusLabels } from "@/lib/constants";

type PendingEnrollmentItem = {
  id: string;
  participantName: string;
  participantPhone: string;
  paymentStatus: string;
};

type PendingPaymentsModalProps = {
  rachaTitle: string;
  callbackUrl: string;
  enrollments: PendingEnrollmentItem[];
};

type ConfirmationState = {
  enrollmentId: string;
  participantName: string;
  type: "confirm" | "remove" | null;
};

function ActionIconButton({
  label,
  onClick,
  children,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="group relative">
      <button
        aria-label={label}
        className="h-9 w-9 px-0 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        onClick={onClick}
        title={label}
        type="button"
        disabled={disabled}
      >
        {children}
      </button>
      <span className="pointer-events-none absolute -top-10 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-slate-950 px-2 py-1 text-[11px] font-medium whitespace-nowrap text-white opacity-0 shadow transition group-hover:opacity-100">
        {label}
      </span>
    </div>
  );
}

export function PendingPaymentsModal({
  rachaTitle,
  callbackUrl,
  enrollments,
}: PendingPaymentsModalProps) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationState>({
    enrollmentId: "",
    participantName: "",
    type: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const subtitle = useMemo(() => {
    if (enrollments.length === 1) {
      return "1 participante aguardando pagamento";
    }

    return `${enrollments.length} participantes aguardando pagamento`;
  }, [enrollments.length]);

  const handleConfirmPayment = async () => {
    setIsSubmitting(true);
    const formData = new FormData();
    formData.append("enrollmentId", confirmation.enrollmentId);
    formData.append("callbackUrl", callbackUrl);

    try {
      await confirmEnrollmentPaymentAction(formData);
    } catch (error) {
      console.error("Erro ao confirmar pagamento:", error);
    } finally {
      setIsSubmitting(false);
      setConfirmation({ enrollmentId: "", participantName: "", type: null });
    }
  };

  const handleRemoveEnrollment = async () => {
    setIsSubmitting(true);
    const formData = new FormData();
    formData.append("enrollmentId", confirmation.enrollmentId);
    formData.append("callbackUrl", callbackUrl);

    try {
      await removeOrganizerPendingEnrollmentAction(formData);
    } catch (error) {
      console.error("Erro ao remover inscrição:", error);
    } finally {
      setIsSubmitting(false);
      setConfirmation({ enrollmentId: "", participantName: "", type: null });
    }
  };

  return (
    <>
      <Button
        disabled={enrollments.length === 0}
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
        variant="outline"
      >
        <Clock3 className="h-4 w-4" />
        Gerenciar pagamentos
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4">
          <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
                  Gerenciar pagamentos
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-950">
                  {rachaTitle}
                </h3>
                <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
              </div>
              <button
                aria-label="Fechar modal"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:bg-slate-50"
                onClick={() => setOpen(false)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-5">
              {enrollments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                  Não há participantes aguardando pagamento neste racha.
                </div>
              ) : (
                enrollments.map((enrollment) => (
                  <div
                    key={enrollment.id}
                    className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-bold text-slate-950">
                          {enrollment.participantName}
                        </p>
                        <Badge className="bg-amber-100 text-amber-700">
                          {paymentStatusLabels[enrollment.paymentStatus] ??
                            "Aguardando pagamento"}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600">
                        {enrollment.participantPhone}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <ActionIconButton
                        label="Confirmar pagamento"
                        onClick={() =>
                          setConfirmation({
                            enrollmentId: enrollment.id,
                            participantName: enrollment.participantName,
                            type: "confirm",
                          })
                        }
                      >
                        <Check className="h-4 w-4" />
                      </ActionIconButton>

                      <ActionIconButton
                        label="Remover inscrição"
                        onClick={() =>
                          setConfirmation({
                            enrollmentId: enrollment.id,
                            participantName: enrollment.participantName,
                            type: "remove",
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </ActionIconButton>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {confirmation.type === "confirm" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-950">
                    Confirmar pagamento
                  </h3>
                </div>
              </div>
              <button
                aria-label="Fechar modal"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:bg-slate-50"
                onClick={() =>
                  setConfirmation({
                    enrollmentId: "",
                    participantName: "",
                    type: null,
                  })
                }
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-5 space-y-4">
              <div className="space-y-3">
                <p className="text-sm text-slate-700">
                  <span className="font-semibold">
                    {confirmation.participantName}
                  </span>
                </p>
                <p className="text-sm leading-relaxed text-slate-600">
                  Certifique-se que o valor do pagamento está correto e que não
                  houve apenas um agendamento.
                </p>
                <p className="text-sm font-semibold text-slate-950">
                  Deseja confirmar o pagamento?
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() =>
                    setConfirmation({
                      enrollmentId: "",
                      participantName: "",
                      type: null,
                    })
                  }
                  variant="outline"
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  Não
                </Button>
                <Button
                  onClick={handleConfirmPayment}
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Processando..." : "Sim, confirmar"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {confirmation.type === "remove" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4">
          <div className="w-full max-w-md rounded-3xl border border-rose-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-rose-200 bg-rose-50 px-5 py-4">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100">
                  <AlertCircle className="h-5 w-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-rose-900">
                    Remover inscrição
                  </h3>
                </div>
              </div>
              <button
                aria-label="Fechar modal"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 text-rose-700 transition hover:bg-rose-100"
                onClick={() =>
                  setConfirmation({
                    enrollmentId: "",
                    participantName: "",
                    type: null,
                  })
                }
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-5 space-y-4">
              <div className="space-y-3">
                <p className="text-sm text-slate-700">
                  <span className="font-semibold">
                    {confirmation.participantName}
                  </span>
                </p>
                <p className="text-sm leading-relaxed text-slate-600">
                  Você está prestes a remover a inscrição deste participante.
                  Esta ação é irreversível.
                </p>
                <p className="text-sm font-semibold text-rose-700">
                  Tem certeza que deseja continuar?
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() =>
                    setConfirmation({
                      enrollmentId: "",
                      participantName: "",
                      type: null,
                    })
                  }
                  variant="outline"
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  Não, cancelar
                </Button>
                <Button
                  onClick={handleRemoveEnrollment}
                  className="flex-1 bg-rose-600 hover:bg-rose-700"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Removendo..." : "Sim, remover"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
