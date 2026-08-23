"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  cancelEnrollmentAction,
  cancelPendingEnrollmentAction,
} from "@/actions";
import { PixPaymentCard } from "@/components/pix-payment-card";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { isGoalkeeperPosition } from "@/lib/enrollment";


type MyEnrollmentActionsProps = {
  enrollmentId: string;
  rachaSlug: string;
  rachaTitle: string;
  rachaCity: string;
  organizerDisplayName: string;
  enrollmentStatus: string;
  paymentStatus: string;
  participantPosition: string;
  pixKey: string;
  priceInCents: number;
  paymentDeadline?: string | null;
};

export function MyEnrollmentActions({
  enrollmentId,
  rachaSlug,
  rachaTitle,
  rachaCity,
  organizerDisplayName,
  enrollmentStatus,
  paymentStatus,
  participantPosition,
  pixKey,
  priceInCents,
  paymentDeadline,
}: MyEnrollmentActionsProps) {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCancelPendingModalOpen, setIsCancelPendingModalOpen] =
    useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [cancelPendingConfirmError, setCancelPendingConfirmError] = useState<
    string | null
  >(null);
  const [refundConfirmError, setRefundConfirmError] = useState<string | null>(
    null,
  );

  const isFree = priceInCents === 0;
  const isGoalkeeper = isGoalkeeperPosition(participantPosition);
  const canPay =
    !isFree && !isGoalkeeper && paymentStatus === "PENDING" && enrollmentStatus !== "CANCELED";
  const canCancelPending =
    enrollmentStatus !== "CANCELED" && (isFree || isGoalkeeper || paymentStatus === "PENDING");
  const canRequestRefund =
    !isFree && !isGoalkeeper && paymentStatus === "PAID" && enrollmentStatus !== "CANCELED";

  const modalTitle = useMemo(() => {
    if (isPaymentModalOpen) {
      return "Realizar Pagamento via PIX";
    }

    if (isCancelPendingModalOpen) {
      return "Cancelar inscrição";
    }

    if (isRefundModalOpen) {
      return "Solicitar reembolso";
    }

    return "";
  }, [isCancelPendingModalOpen, isPaymentModalOpen, isRefundModalOpen]);


  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Button asChild href={`/rachas/${rachaSlug}`} variant="outline">
          Ver racha
        </Button>

        {canPay ? (
          <Button onClick={() => setIsPaymentModalOpen(true)} type="button">
            Realizar pagamento
          </Button>
        ) : null}

        {canCancelPending ? (
          <Button
            onClick={() => {
              setCancelPendingConfirmError(null);
              setIsCancelPendingModalOpen(true);
            }}
            type="button"
            variant="outline"
          >
            Cancelar inscrição
          </Button>
        ) : null}

        {canRequestRefund ? (
          <Button
            onClick={() => {
              setRefundConfirmError(null);
              setIsRefundModalOpen(true);
            }}
            type="button"
            variant="danger"
          >
            Cancelar inscrição - Solicitar reembolso
          </Button>
        ) : null}
      </div>

      {(isPaymentModalOpen ||
        isCancelPendingModalOpen ||
        isRefundModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-xs">
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 bg-white">
              <h3 className="text-lg font-bold text-slate-950">{modalTitle}</h3>
              <button
                aria-label="Fechar modal"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:bg-slate-50"
                onClick={() => {
                  setIsPaymentModalOpen(false);
                  setIsCancelPendingModalOpen(false);
                  setIsRefundModalOpen(false);
                  setCancelPendingConfirmError(null);
                  setRefundConfirmError(null);
                }}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
              {isPaymentModalOpen ? (
                <div className="space-y-4">
                  <p className="text-xs text-slate-600">
                    Realize o pagamento via PIX para garantir sua vaga no racha. O
                    organizador confirmará sua inscrição após o recebimento.
                  </p>

                  <PixPaymentCard
                    organizerDisplayName={organizerDisplayName}
                    pixKey={pixKey}
                    priceInCents={priceInCents}
                    rachaCity={rachaCity}
                    rachaTitle={rachaTitle}
                  />

                  {paymentDeadline ? (
                    <p className="text-xs text-slate-600">
                      Prazo para pagamento: <strong>{paymentDeadline}</strong>
                    </p>
                  ) : null}
                  <div className="flex justify-end pt-2 pb-1">
                    <Button
                      onClick={() => setIsPaymentModalOpen(false)}
                      type="button"
                      variant="outline"
                    >
                      Fechar
                    </Button>
                  </div>
                </div>
              ) : null}

            {isCancelPendingModalOpen ? (
              <form
                action={cancelPendingEnrollmentAction}
                className="space-y-4"
                onSubmit={(event) => {
                  const confirmCheckbox =
                    event.currentTarget.elements.namedItem(
                      "confirmCancellation",
                    ) as HTMLInputElement | null;

                  if (!confirmCheckbox?.checked) {
                    event.preventDefault();
                    setCancelPendingConfirmError(
                      "É necessário selecionar a caixa de confirmação.",
                    );
                    return;
                  }

                  setCancelPendingConfirmError(null);
                }}
              >
                <input name="enrollmentId" type="hidden" value={enrollmentId} />

                <p className="text-sm text-slate-600">
                  Essa ação remove sua inscrição. Você poderá se inscrever
                  novamente se ainda houver vagas.
                </p>

                <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <input
                    className="mt-1 h-4 w-4 rounded border-slate-300"
                    name="confirmCancellation"
                    onChange={(event) => {
                      if (event.target.checked) {
                        setCancelPendingConfirmError(null);
                      }
                    }}
                    required
                    type="checkbox"
                  />
                  <span>Confirmo que desejo cancelar esta inscrição.</span>
                </label>

                {cancelPendingConfirmError ? (
                  <p className="text-sm font-medium text-rose-600">
                    {cancelPendingConfirmError}
                  </p>
                ) : null}

                <label className="space-y-2 text-sm font-medium text-slate-700">
                  Motivo do cancelamento
                  <textarea
                    className="flex min-h-25 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    name="cancelReason"
                    placeholder="Ex.: não poderei comparecer por compromisso pessoal"
                    required
                  />
                </label>

                <div className="flex flex-wrap justify-end gap-3">
                  <Button
                    onClick={() => setIsCancelPendingModalOpen(false)}
                    type="button"
                    variant="outline"
                  >
                    Fechar
                  </Button>
                  <SubmitButton pendingLabel="Cancelando..." variant="danger">
                    Confirmar cancelamento
                  </SubmitButton>
                </div>
              </form>
            ) : null}

            {isRefundModalOpen ? (
              <form
                action={cancelEnrollmentAction}
                className="space-y-4"
                onSubmit={(event) => {
                  const confirmCheckbox =
                    event.currentTarget.elements.namedItem(
                      "confirmCancellation",
                    ) as HTMLInputElement | null;

                  if (!confirmCheckbox?.checked) {
                    event.preventDefault();
                    setRefundConfirmError(
                      "É necessário selecionar a caixa de confirmação.",
                    );
                    return;
                  }

                  setRefundConfirmError(null);
                }}
              >
                <input name="enrollmentId" type="hidden" value={enrollmentId} />

                <label className="space-y-2 text-sm font-medium text-slate-700">
                  Motivo do reembolso
                  <select
                    className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                    defaultValue=""
                    name="refundReason"
                    required
                  >
                    <option disabled value="">
                      Selecione um motivo
                    </option>
                    <option value="Imprevisto pessoal">
                      Imprevisto pessoal
                    </option>
                    <option value="Lesão">Lesão</option>
                    <option value="Conflito de horário">
                      Conflito de horário
                    </option>
                    <option value="Outro">Outro</option>
                  </select>
                </label>

                <label className="space-y-2 text-sm font-medium text-slate-700">
                  Chave PIX para devolução
                  <input
                    className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                    name="refundPixKey"
                    placeholder="CPF, e-mail, telefone ou chave aleatória"
                    required
                  />
                </label>

                <label className="space-y-2 text-sm font-medium text-slate-700">
                  Nome da conta
                  <input
                    className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                    name="refundPixAccountName"
                    placeholder="Ex.: Nubank, Inter, Caixa"
                    required
                  />
                </label>

                <label className="space-y-2 text-sm font-medium text-slate-700">
                  Nome igual ao da conta
                  <input
                    className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                    name="refundPixHolderName"
                    placeholder="Nome completo do titular"
                    required
                  />
                </label>

                <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <input
                    className="mt-1 h-4 w-4 rounded border-slate-300"
                    name="confirmCancellation"
                    onChange={(event) => {
                      if (event.target.checked) {
                        setRefundConfirmError(null);
                      }
                    }}
                    required
                    type="checkbox"
                  />
                  <span>
                    Confirmo que desejo cancelar minha participação e solicitar
                    reembolso.
                  </span>
                </label>

                {refundConfirmError ? (
                  <p className="text-sm font-medium text-rose-600">
                    {refundConfirmError}
                  </p>
                ) : null}

                <div className="flex flex-wrap justify-end gap-3">
                  <Button
                    onClick={() => setIsRefundModalOpen(false)}
                    type="button"
                    variant="outline"
                  >
                    Fechar
                  </Button>
                  <SubmitButton pendingLabel="Solicitando..." variant="danger">
                    Solicitar reembolso
                  </SubmitButton>
                </div>
              </form>
            ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
