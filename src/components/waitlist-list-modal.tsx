"use client";

import { useMemo, useState } from "react";
import { Copy, Download, MessageCircle, X } from "lucide-react";
import { ToastContainer } from "@/components/toast-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { levelLabels } from "@/lib/constants";
import {
  compareEnrollmentsForExport,
  getEnrollmentStatusLabel,
} from "@/lib/enrollment";
import { formatDateTimeShort, formatPhone } from "@/lib/utils";

type WaitlistEnrollment = {
  id: string;
  createdAt: Date | string;
  participantName: string;
  participantPhone: string;
  participantPosition: string;
  participantLevel: string;
  status: string;
  paymentStatus: string;
};

type WaitlistListModalProps = {
  rachaId: string;
  rachaTitle: string;
  eventDate: Date;
  locationName: string;
  enrollments: WaitlistEnrollment[];
  whatsappGroupUrl?: string | null;
};

function generateWhatsappMessage(
  rachaTitle: string,
  eventDate: Date,
  locationName: string,
  enrollments: WaitlistEnrollment[],
) {
  const dateStr = formatDateTimeShort(eventDate);

  let message = `*${rachaTitle}*\n`;
  message += `Local: ${locationName}\n`;
  message += `Data e hora: ${dateStr}\n\n`;
  message += `Lista de espera:\n`;

  if (enrollments.length === 0) {
    message += "Sem atletas na lista de espera.";
    return message;
  }

  for (let index = 0; index < enrollments.length; index += 1) {
    const enrollment = enrollments[index]!;
    message += `${index + 1} - ${enrollment.participantName} (${getEnrollmentStatusLabel(enrollment)})\n`;
  }

  return message;
}

export function WaitlistListModal({
  rachaId,
  rachaTitle,
  eventDate,
  locationName,
  enrollments,
  whatsappGroupUrl,
}: WaitlistListModalProps) {
  const [open, setOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"whatsapp" | "pdf" | null>(
    null,
  );
  const { toasts, addToast, removeToast } = useToast();

  const waitlistEnrollments = useMemo(
    () => [...enrollments].sort(compareEnrollmentsForExport),
    [enrollments],
  );

  const whatsappMessage = useMemo(
    () =>
      generateWhatsappMessage(
        rachaTitle,
        eventDate,
        locationName,
        waitlistEnrollments,
      ),
    [eventDate, locationName, rachaTitle, waitlistEnrollments],
  );

  const handleCopyWhatsapp = async () => {
    try {
      await navigator.clipboard.writeText(whatsappMessage);
      addToast("Mensagem copiada para a área de transferência!", "success");
    } catch {
      addToast("Falha ao copiar a mensagem", "error");
    }
  };

  const handleExport = (format: "pdf" | "excel") => {
    const params = new URLSearchParams({
      type: "waitlist",
      format,
      rachaId,
    });

    const extension = format === "pdf" ? "pdf" : "csv";
    const link = document.createElement("a");
    link.href = `/api/export-enrollment?${params.toString()}`;
    link.setAttribute("download", `lista_espera_${rachaId}.${extension}`);
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
        Exportar espera
      </Button>

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4">
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-700">
                  Lista de espera
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-950">
                  {rachaTitle}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {waitlistEnrollments.length} atleta(s) na espera
                </p>
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
                <div className="max-h-[38vh] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-900 sm:max-h-[50vh]">
                  {whatsappMessage}
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    className="flex-1"
                    onClick={handleCopyWhatsapp}
                    type="button"
                  >
                    <Copy className="h-4 w-4" />
                    Copiar mensagem
                  </Button>

                  {whatsappGroupUrl ? (
                    <Button
                      asChild
                      className="flex-1"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <a href={whatsappGroupUrl}>
                        <MessageCircle className="h-4 w-4" />
                        Enviar para grupo
                      </a>
                    </Button>
                  ) : null}

                  <Button
                    onClick={() => setExportFormat(null)}
                    type="button"
                    variant="outline"
                  >
                    Voltar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-0 space-y-4 overflow-y-auto px-5 py-5">
                <div className="space-y-3">
                  {waitlistEnrollments.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                      Não há atletas na lista de espera.
                    </div>
                  ) : (
                    waitlistEnrollments.map((enrollment, index) => (
                      <div
                        key={enrollment.id}
                        className="flex items-start justify-between rounded-2xl border border-slate-200 p-3"
                      >
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-bold text-slate-950">
                            {index + 1}. {enrollment.participantName}
                          </p>
                          <p className="text-xs text-slate-600">
                            {formatPhone(enrollment.participantPhone)} •{" "}
                            {enrollment.participantPosition} •{" "}
                            {levelLabels[enrollment.participantLevel]}
                          </p>
                        </div>
                        <Badge className="ml-3 bg-slate-100 text-slate-700">
                          {getEnrollmentStatusLabel(enrollment)}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <p className="mb-3 text-sm font-semibold text-slate-700">
                    Exportar como:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => setExportFormat("whatsapp")}
                      type="button"
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </Button>
                    <Button
                      onClick={() => handleExport("pdf")}
                      type="button"
                      variant="outline"
                    >
                      <Download className="h-4 w-4" />
                      PDF
                    </Button>
                    <Button
                      onClick={() => handleExport("excel")}
                      type="button"
                      variant="outline"
                    >
                      <Download className="h-4 w-4" />
                      Excel
                    </Button>
                  </div>
                </div>

                <div>
                  <Button
                    className="w-full"
                    onClick={() => setOpen(false)}
                    type="button"
                    variant="outline"
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
