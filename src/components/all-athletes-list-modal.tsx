"use client";

import { useMemo, useState } from "react";
import { Download, MessageCircle, X, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToastContainer } from "@/components/toast-container";
import { useToast } from "@/hooks/use-toast";
import { levelLabels } from "@/lib/constants";
import { formatDateTimeShort } from "@/lib/utils";

type AllAthleteEnrollment = {
  id: string;
  participantName: string;
  participantPhone: string;
  participantPosition: string;
  participantLevel: string;
  status: string;
  paymentStatus: string;
};

type AllAthletesListModalProps = {
  rachaId: string;
  rachaTitle: string;
  eventDate: Date;
  locationName: string;
  enrollments: AllAthleteEnrollment[];
  athleteLimit: number;
  slug: string;
  whatsappGroupUrl?: string | null;
};

function getUnifiedStatus(enrollment: AllAthleteEnrollment): string {
  if (enrollment.status === "CANCELED") {
    return "Cancelado";
  }
  if (enrollment.paymentStatus === "REFUNDED") {
    return "Cancelado";
  }
  if (enrollment.paymentStatus === "REFUND_REQUESTED") {
    return "Aguardando reembolso";
  }
  if (enrollment.status === "WAITLIST") {
    return "Lista de espera";
  }
  if (enrollment.status === "ACTIVE" && enrollment.paymentStatus === "PAID") {
    return "Confirmado";
  }
  if (
    enrollment.status === "ACTIVE" &&
    enrollment.paymentStatus === "PENDING"
  ) {
    return "Aguardando pagamento";
  }
  if (
    enrollment.status === "ACTIVE" &&
    enrollment.paymentStatus === "PROOF_SENT"
  ) {
    return "Pagamento em análise";
  }
  return "Pendente";
}

function getStatusColor(
  status: string,
):
  | "bg-emerald-100 text-emerald-700"
  | "bg-amber-100 text-amber-700"
  | "bg-slate-100 text-slate-700"
  | "bg-rose-100 text-rose-700" {
  if (status === "Confirmado") return "bg-emerald-100 text-emerald-700";
  if (
    status === "Aguardando pagamento" ||
    status === "Pagamento em análise" ||
    status === "Aguardando reembolso"
  )
    return "bg-amber-100 text-amber-700";
  if (status === "Cancelado" || status === "Pendente")
    return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function generateWhatsappMessage(
  rachaTitle: string,
  eventDate: Date,
  locationName: string,
  enrollments: AllAthleteEnrollment[],
  athleteLimit: number,
  slug: string,
): string {
  const dateStr = formatDateTimeShort(eventDate);
  const inscriptionUrl = `https://organizaracha.com.br/rachas/${slug}`;

  let message = `*${rachaTitle}* - Lista completa (${athleteLimit} Vagas)\n`;
  message += `Local: ${locationName}\n`;
  message += `Data e hora: ${dateStr}\n`;
  message += `Inscrição: ${inscriptionUrl}\n\n`;
  message += `Atletas e status:\n`;

  const activeEnrollments = enrollments.filter(
    (e) => e.status !== "CANCELED" && e.paymentStatus !== "REFUNDED",
  );

  activeEnrollments.forEach((enrollment, index) => {
    const status = getUnifiedStatus(enrollment);
    message += `${index + 1} - ${enrollment.participantName} (${status})\n`;
  });

  return message;
}

export function AllAthletesListModal({
  rachaId,
  rachaTitle,
  eventDate,
  locationName,
  enrollments,
  athleteLimit,
  slug,
  whatsappGroupUrl,
}: AllAthletesListModalProps) {
  const [open, setOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"whatsapp" | "pdf" | null>(
    null,
  );
  const { toasts, addToast, removeToast } = useToast();

  const activeEnrollments = useMemo(
    () =>
      enrollments.filter(
        (e) => e.status !== "CANCELED" && e.paymentStatus !== "REFUNDED",
      ),
    [enrollments],
  );

  const subtitle = useMemo(() => {
    if (activeEnrollments.length === 1) {
      return "1 atleta inscrito";
    }
    return `${activeEnrollments.length} atletas inscritos`;
  }, [activeEnrollments.length]);

  const whatsappMessage = useMemo(
    () =>
      generateWhatsappMessage(
        rachaTitle,
        eventDate,
        locationName,
        activeEnrollments,
        athleteLimit,
        slug,
      ),
    [
      rachaTitle,
      eventDate,
      locationName,
      activeEnrollments,
      athleteLimit,
      slug,
    ],
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
      type: "all",
      format: "pdf",
      rachaId,
    });

    const link = document.createElement("a");
    link.href = `/api/export-enrollment?${params.toString()}`;
    link.setAttribute("download", `lista_todos_${rachaId}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleExportExcel = async () => {
    const params = new URLSearchParams({
      type: "all",
      format: "excel",
      rachaId,
    });

    const link = document.createElement("a");
    link.href = `/api/export-enrollment?${params.toString()}`;
    link.setAttribute("download", `lista_todos_${rachaId}.csv`);
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
        Exportar todos
      </Button>

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4">
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
                  Todos os atletas
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
                <div className="space-y-2">
                  {activeEnrollments.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                      Não há atletas inscritos neste racha.
                    </div>
                  ) : (
                    activeEnrollments.map((enrollment, index) => {
                      const status = getUnifiedStatus(enrollment);
                      const statusColor = getStatusColor(status);

                      return (
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
                          <Badge className={`ml-3 ${statusColor}`}>
                            {status}
                          </Badge>
                        </div>
                      );
                    })
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
