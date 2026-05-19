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
  getEnrollmentStatusEmoji,
  getEnrollmentStatusLabel,
  isGoalkeeperEnrollment,
  isVisibleEnrollment,
} from "@/lib/enrollment";
import { formatDateTimeShort } from "@/lib/utils";

type AllAthleteEnrollment = {
  id: string;
  createdAt: Date | string;
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
  goalkeeperLimit?: number | null;
  slug: string;
  whatsappGroupUrl?: string | null;
};

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
  ) {
    return "bg-amber-100 text-amber-700";
  }
  if (status === "Cancelado" || status === "Pendente") {
    return "bg-rose-100 text-rose-700";
  }
  return "bg-slate-100 text-slate-700";
}

function generateWhatsappMessage(
  rachaTitle: string,
  eventDate: Date,
  locationName: string,
  lineEnrollments: AllAthleteEnrollment[],
  goalkeeperEnrollments: AllAthleteEnrollment[],
  waitlistEnrollments: AllAthleteEnrollment[],
  athleteLimit: number,
  goalkeeperLimit: number | null | undefined,
  slug: string,
): string {
  const dateStr = formatDateTimeShort(eventDate);
  const inscriptionUrl = `https://organiza-racha.vercel.app/rachas/${slug}`;

  let message = `*${rachaTitle}* - Lista completa (${athleteLimit} Vagas)\n`;
  message += `Local: ${locationName}\n`;
  message += `Data e hora: ${dateStr}\n`;
  message += `Inscrição: ${inscriptionUrl}\n\n`;
  message += `Atletas e status:\n`;

  for (let index = 0; index < athleteLimit; index += 1) {
    const enrollment = lineEnrollments[index];

    if (!enrollment) {
      message += `${index + 1} - \n`;
      continue;
    }

    message += `${index + 1} - ${enrollment.participantName} ${getEnrollmentStatusEmoji(enrollment)}\n`;
  }

  const goalkeeperSlots = Math.max(
    goalkeeperLimit ?? 0,
    goalkeeperEnrollments.length,
  );

  if (goalkeeperSlots > 0) {
    message += `\nGoleiros:\n`;

    for (let index = 0; index < goalkeeperSlots; index += 1) {
      const enrollment = goalkeeperEnrollments[index];

      if (!enrollment) {
        message += `${index + 1} - \n`;
        continue;
      }

      message += `${index + 1} - ${enrollment.participantName} ${getEnrollmentStatusEmoji(enrollment)}\n`;
    }
  }

  if (waitlistEnrollments.length > 0) {
    message += `\nLista de espera:\n`;

    for (let index = 0; index < waitlistEnrollments.length; index += 1) {
      const enrollment = waitlistEnrollments[index]!;
      message += `${index + 1} - ${enrollment.participantName} ${getEnrollmentStatusEmoji(enrollment)}\n`;
    }
  }

  return message;
}

export function AllAthletesListModal({
  rachaId,
  rachaTitle,
  eventDate,
  locationName,
  enrollments,
  athleteLimit,
  goalkeeperLimit,
  slug,
  whatsappGroupUrl,
}: AllAthletesListModalProps) {
  const [open, setOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"whatsapp" | "pdf" | null>(
    null,
  );
  const { toasts, addToast, removeToast } = useToast();

  const activeEnrollments = useMemo(
    () => enrollments.filter(isVisibleEnrollment),
    [enrollments],
  );
  const waitlistEnrollments = useMemo(
    () =>
      activeEnrollments
        .filter((item) => item.status === "WAITLIST")
        .sort(compareEnrollmentsForExport),
    [activeEnrollments],
  );
  const mainEnrollments = useMemo(
    () => activeEnrollments.filter((item) => item.status !== "WAITLIST"),
    [activeEnrollments],
  );
  const lineEnrollments = useMemo(
    () =>
      mainEnrollments
        .filter((item) => !isGoalkeeperEnrollment(item))
        .sort(compareEnrollmentsForExport),
    [mainEnrollments],
  );
  const goalkeeperEnrollments = useMemo(
    () =>
      mainEnrollments
        .filter(isGoalkeeperEnrollment)
        .sort(compareEnrollmentsForExport),
    [mainEnrollments],
  );

  const subtitle = useMemo(() => {
    if (
      lineEnrollments.length === 1 &&
      goalkeeperEnrollments.length === 0 &&
      waitlistEnrollments.length === 0
    ) {
      return "1 atleta inscrito";
    }
    if (goalkeeperEnrollments.length === 0 && waitlistEnrollments.length === 0) {
      return `${lineEnrollments.length} atletas inscritos`;
    }
    const summary = [`${lineEnrollments.length} atletas inscritos`];

    if (goalkeeperEnrollments.length > 0) {
      summary.push(`${goalkeeperEnrollments.length} goleiro(s)`);
    }

    if (waitlistEnrollments.length > 0) {
      summary.push(`${waitlistEnrollments.length} na espera`);
    }

    return summary.join(" + ");
  }, [goalkeeperEnrollments.length, lineEnrollments.length, waitlistEnrollments.length]);

  const whatsappMessage = useMemo(
    () =>
      generateWhatsappMessage(
        rachaTitle,
        eventDate,
        locationName,
        lineEnrollments,
        goalkeeperEnrollments,
        waitlistEnrollments,
        athleteLimit,
        goalkeeperLimit,
        slug,
      ),
    [
      athleteLimit,
      eventDate,
      goalkeeperEnrollments,
      goalkeeperLimit,
      lineEnrollments,
      locationName,
      rachaTitle,
      slug,
      waitlistEnrollments,
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
                <div className="max-h-[38vh] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-900 sm:max-h-[50vh]">
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
                  {lineEnrollments.length === 0 && goalkeeperEnrollments.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                      Não há atletas inscritos neste racha.
                    </div>
                  ) : (
                    <>
                      {lineEnrollments.map((enrollment, index) => {
                        const status = getEnrollmentStatusLabel(enrollment);
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
                      })}

                      {goalkeeperEnrollments.length > 0 ? (
                        <div className="pt-2">
                          <p className="mb-3 text-sm font-semibold text-slate-700">
                            Goleiros
                          </p>
                          <div className="space-y-3">
                            {goalkeeperEnrollments.map((enrollment, index) => {
                              const status = getEnrollmentStatusLabel(enrollment);
                              const statusColor = getStatusColor(status);

                              return (
                                <div
                                  key={enrollment.id}
                                  className="flex items-start justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-3"
                                >
                                  <div className="flex-1 space-y-1">
                                    <p className="text-sm font-bold text-slate-950">
                                      {index + 1}. {enrollment.participantName}
                                    </p>
                                    <p className="text-xs text-slate-600">
                                      {enrollment.participantPhone} •{" "}
                                      {levelLabels[enrollment.participantLevel]}
                                    </p>
                                  </div>
                                  <Badge className={`ml-3 ${statusColor}`}>
                                    {status}
                                  </Badge>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      {waitlistEnrollments.length > 0 ? (
                        <div className="pt-2">
                          <p className="mb-3 text-sm font-semibold text-slate-700">
                            Lista de espera
                          </p>
                          <div className="space-y-3">
                            {waitlistEnrollments.map((enrollment, index) => {
                              const status = getEnrollmentStatusLabel(enrollment);
                              const statusColor = getStatusColor(status);

                              return (
                                <div
                                  key={enrollment.id}
                                  className="flex items-start justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3"
                                >
                                  <div className="flex-1 space-y-1">
                                    <p className="text-sm font-bold text-slate-950">
                                      {index + 1}. {enrollment.participantName}
                                    </p>
                                    <p className="text-xs text-slate-600">
                                      {enrollment.participantPhone} • {enrollment.participantPosition} • {levelLabels[enrollment.participantLevel]}
                                    </p>
                                  </div>
                                  <Badge className={`ml-3 ${statusColor}`}>
                                    {status}
                                  </Badge>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <p className="mb-3 text-sm font-semibold text-slate-700">
                    Exportar como:
                  </p>
                  <div className="flex flex-wrap gap-2">
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
