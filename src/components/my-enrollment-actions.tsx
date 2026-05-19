"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, X } from "lucide-react";
import {
  cancelEnrollmentAction,
  cancelPendingEnrollmentAction,
} from "@/actions";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { isGoalkeeperPosition } from "@/lib/enrollment";
import { buildPixPaymentPayload } from "@/lib/pix";
import { formatCurrencyFromCents } from "@/lib/utils";

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
  const [paymentQrCodeUrl, setPaymentQrCodeUrl] = useState("");
  const [paymentCopyFeedback, setPaymentCopyFeedback] = useState<
    "key" | "payload" | null
  >(null);
  const [cancelPendingConfirmError, setCancelPendingConfirmError] = useState<
    string | null
  >(null);
  const [refundConfirmError, setRefundConfirmError] = useState<string | null>(
    null,
  );

  const isGoalkeeper = isGoalkeeperPosition(participantPosition);
  const canPay =
    !isGoalkeeper && paymentStatus === "PENDING" && enrollmentStatus !== "CANCELED";
  const canCancelPending =
    enrollmentStatus !== "CANCELED" && (isGoalkeeper || paymentStatus === "PENDING");
  const canRequestRefund =
    !isGoalkeeper && paymentStatus === "PAID" && enrollmentStatus !== "CANCELED";
  const pixPayload = useMemo(
    () =>
      buildPixPaymentPayload({
        pixKey,
        amountInCents: priceInCents,
        merchantName: organizerDisplayName,
        merchantCity: rachaCity,
        description: rachaTitle,
      }),
    [organizerDisplayName, pixKey, priceInCents, rachaCity, rachaTitle],
  );

  const modalTitle = useMemo(() => {
    if (isPaymentModalOpen) {
      return "Realizar pagamento";
    }

    if (isCancelPendingModalOpen) {
      return "Cancelar inscrição";
    }

    if (isRefundModalOpen) {
      return "Solicitar reembolso";
    }

    return "";
  }, [isCancelPendingModalOpen, isPaymentModalOpen, isRefundModalOpen]);

  useEffect(() => {
    let isMounted = true;

    if (!isPaymentModalOpen || !pixPayload) {
      return () => {
        isMounted = false;
      };
    }

    QRCode.toDataURL(pixPayload, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 280,
    })
      .then((dataUrl) => {
        if (isMounted) {
          setPaymentQrCodeUrl(dataUrl);
        }
      })
      .catch(() => {
        if (isMounted) {
          setPaymentQrCodeUrl("");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isPaymentModalOpen, pixPayload]);

  async function handleCopyPaymentValue(value: string, type: "key" | "payload") {
    try {
      await navigator.clipboard.writeText(value);
      setPaymentCopyFeedback(type);
      window.setTimeout(() => setPaymentCopyFeedback(null), 1800);
    } catch {
      setPaymentCopyFeedback(null);
    }
  }

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-950">{modalTitle}</h3>
              <button
                aria-label="Fechar modal"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setIsPaymentModalOpen(false);
                  setIsCancelPendingModalOpen(false);
                  setIsRefundModalOpen(false);
                  setPaymentCopyFeedback(null);
                  setCancelPendingConfirmError(null);
                  setRefundConfirmError(null);
                }}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isPaymentModalOpen ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  Escaneie o QR Code ou copie os dados do PIX. Após a confirmação
                  do organizador, o status será alterado para pago.
                </p>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Valor</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">
                    {formatCurrencyFromCents(priceInCents)}
                  </p>
                </div>

                <div className="flex flex-col items-center gap-4 rounded-2xl border border-teal-200 bg-teal-50 p-4">
                  {paymentQrCodeUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={`QR Code PIX para ${rachaTitle}`}
                      className="h-64 w-64 rounded-2xl border border-white bg-white p-3"
                      src={paymentQrCodeUrl}
                    />
                  ) : (
                    <div className="flex h-64 w-64 items-center justify-center rounded-2xl border border-dashed border-teal-300 bg-white text-sm text-slate-500">
                      Gerando QR Code PIX...
                    </div>
                  )}

                  <p className="text-center text-sm text-teal-900">
                    Use o app do banco para escanear e pagar exatamente o valor do racha.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-950">Chave PIX</p>
                  <p className="mt-2 break-all">{pixKey}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      onClick={() => handleCopyPaymentValue(pixKey, "key")}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {paymentCopyFeedback === "key" ? (
                        <>
                          <Check className="h-4 w-4" />
                          Chave copiada
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copiar chave
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleCopyPaymentValue(pixPayload, "payload")}
                      disabled={!pixPayload}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {paymentCopyFeedback === "payload" ? (
                        <>
                          <Check className="h-4 w-4" />
                          PIX copiado
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copiar PIX copia e cola
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {paymentDeadline ? (
                  <p className="text-sm text-slate-600">
                    Prazo para pagamento: <strong>{paymentDeadline}</strong>
                  </p>
                ) : null}
                <div className="flex justify-end">
                  <Button
                    onClick={() => setIsPaymentModalOpen(false)}
                    type="button"
                    variant="outline"
                  >
                    Entendi
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
      )}
    </>
  );
}
