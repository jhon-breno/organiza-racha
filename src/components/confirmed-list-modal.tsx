"use client";

import { useMemo, useState } from "react";
import { Download, MessageCircle, X, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToastContainer } from "@/components/toast-container";
import { useToast } from "@/hooks/use-toast";
import { participantStatusLabels, levelLabels } from "@/lib/constants";
import { formatDateTimeShort } from "@/lib/utils";

type ExportableEnrollment = {
  id: string;
  participantName: string;
  participantPhone: string;
  participantPosition: string;
  participantLevel: string;
  status: string;
  paymentStatus: string;
};

type ConfirmedListModalProps = {
  rachaId: string;
  rachaTitle: string;
  eventDate: Date;
  locationName: string;
  enrollments: ExportableEnrollment[];
  athleteLimit: number;
  whatsappGroupUrl?: string | null;
};

function getUnifiedStatus(enrollment: ExportableEnrollment): string {
  if (enrollment.status === "ACTIVE" && enrollment.paymentStatus === "PAID") {
    return "Confirmado";
  }
  return participantStatusLabels[enrollment.status] ?? enrollment.status;
}

function generateWhatsappMessage(
  rachaTitle: string,
  eventDate: Date,
  locationName: string,
  enrollments: ExportableEnrollment[],
  athleteLimit: number,
): string {
  const dateStr = formatDateTimeShort(eventDate);

  let message = `*${rachaTitle}*\n`;
  message += `Local: ${locationName}\n`;
  message += `Data e hora: ${dateStr}\n\n`;
  message += `Lista de atletas:\n`;

  for (let i = 0; i < athleteLimit; i++) {
    if (i < enrollments.length) {
      const status = getUnifiedStatus(enrollments[i]!);
      message += `${i + 1} - ${enrollments[i]!.participantName} (${status})\n`;
    } else {
      message += `${i + 1} - \n`;
    }
  }

  return message;
}

export function ConfirmedListModal({
  rachaId,
  rachaTitle,
  eventDate,
  locationName,
  enrollments,
  athleteLimit,
  whatsappGroupUrl,
}: ConfirmedListModalProps) {
  const [open, setOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"whatsapp" | "pdf" | null>(
    null,
  );
  const { toasts, addToast, removeToast } = useToast();

  const subtitle = useMemo(() => {
    if (enrollments.length === 1) {
      return `1 de ${athleteLimit} confirmado`;
    }
    return `${enrollments.length} de ${athleteLimit} confirmados`;
  }, [enrollments.length, athleteLimit]);

  const whatsappMessage = useMemo(
    () =>
      generateWhatsappMessage(
        rachaTitle,
        eventDate,
        locationName,
        enrollments,
        athleteLimit,
      ),
    [rachaTitle, eventDate, locationName, enrollments, athleteLimit],
  );

  const handleCopyWhatsapp = async () => {
    try {
      await navigator.clipboard.writeText(whatsappMessage);
      addToast("Mensagem copiada para a área de transferência!", "success");
    } catch {
      addToast("Falha ao copiar a mensagem", "error");
      console.error("Falha ao copiar");
    }
  };

  const handleExportPDF = async () => {
    const params = new URLSearchParams({
      type: "confirmed",
      format: "pdf",
      rachaId,
    });

    const link = document.createElement("a");
    link.href = `/api/export-enrollment?${params.toString()}`;
    link.setAttribute("download", `lista_confirmados_${rachaId}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleExportExcel = async () => {
    const params = new URLSearchParams({
      type: "confirmed",
      format: "excel",
      rachaId,
    });

    const link = document.createElement("a");
    link.href = `/api/export-enrollment?${params.toString()}`;
    link.setAttribute("download", `lista_confirmados_${rachaId}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
        variant="outline"
      >
        <Download className="h-4 w-4" />
        Exportar lista
      </Button>

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4">
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
                  Lista de confirmados
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-950">
                  {rachaTitle}
                </h3>
                <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
              </div>
              <button
                aria-label="Fechar modal"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:bg-slate-50"
                onClick={() => {
                  setOpen(false);
                  setExportFormat(null);
                }}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {exportFormat === "whatsapp" ? (
              <div className="flex-1 min-h-0 space-y-4 overflow-y-auto px-5 py-5">
                <div className="max-h-[38vh] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-900 whitespace-pre-wrap sm:max-h-[50vh]">
                  {whatsappMessage}
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handleCopyWhatsapp}
                    className="flex-1"
                    type="button"
                  >
                    <Copy className="h-4 w-4" />
                    Copiar mensagem
                  </Button>

                  {whatsappGroupUrl ? (
                    <Button
                      asChild
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1"
                    >
                      <a href={whatsappGroupUrl}>
                        <MessageCircle className="h-4 w-4" />
                        Enviar para grupo
                      </a>
                    </Button>
                  ) : null}

                  <Button
                    onClick={() => setExportFormat(null)}
                    variant="outline"
                    type="button"
                  >
                    Voltar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-0 space-y-4 overflow-y-auto px-5 py-5">
                <div className="space-y-3">
                  {enrollments.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                      Não há participantes confirmados neste racha.
                    </div>
                  ) : (
                    enrollments.map((enrollment, index) => (
                      <div
                        key={enrollment.id}
                        className="flex items-start justify-between rounded-2xl border border-slate-200 p-3"
                      >
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-bold text-slate-950">
                            {index + 1}. {enrollment.participantName}
                          </p>
                          <p className="text-xs text-slate-600">
                            {enrollment.participantPhone} •{" "}
                            {enrollment.participantPosition} •{" "}
                            {levelLabels[enrollment.participantLevel]}
                          </p>
                        </div>
                        <Badge className="ml-3 bg-emerald-100 text-emerald-700">
                          Confirmado
                        </Badge>
                      </div>
                    ))
                  )}
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <p className="mb-3 text-sm font-semibold text-slate-700">
                    Exportar como:
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={() => setExportFormat("whatsapp")}
                      variant="default"
                      type="button"
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </Button>
                    <Button
                      onClick={handleExportPDF}
                      variant="outline"
                      type="button"
                    >
                      <Download className="h-4 w-4" />
                      PDF
                    </Button>
                    <Button
                      onClick={handleExportExcel}
                      variant="outline"
                      type="button"
                    >
                      <Download className="h-4 w-4" />
                      Excel
                    </Button>
                  </div>
                </div>

                <div>
                  <Button
                    onClick={() => setOpen(false)}
                    variant="outline"
                    className="w-full"
                    type="button"
                  >
                    Fechar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
