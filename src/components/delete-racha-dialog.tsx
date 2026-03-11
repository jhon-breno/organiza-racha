"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { deleteRachaAction } from "@/actions";
import { Button, buttonVariants } from "@/components/ui/button";

type DeleteRachaDialogProps = {
  rachaId: string;
  rachaTitle: string;
  rachaPixKey: string;
  enrollments: {
    id: string;
    participantName: string;
    participantPhone: string;
    status: string;
    paymentStatus: string;
    notes?: string | null;
  }[];
};

function getUnifiedEnrollmentStatus(enrollment: {
  status: string;
  paymentStatus: string;
}) {
  if (
    enrollment.status === "CANCELED" ||
    enrollment.paymentStatus === "REFUNDED"
  ) {
    return "Cancelado";
  }

  if (enrollment.paymentStatus === "REFUND_REQUESTED") {
    return "Aguardando reembolso";
  }

  if (enrollment.status === "WAITLIST") {
    return "Lista de espera";
  }

  if (enrollment.paymentStatus === "PAID") {
    return "Confirmado";
  }

  return "Aguardando pagamento";
}

function getParticipantPixKey(notes?: string | null) {
  if (!notes) {
    return "Não informado";
  }

  const match = notes.match(/PIX para devolução:\s*(.+)/i);
  return match?.[1]?.trim() || "Não informado";
}

export function DeleteRachaDialog({
  rachaId,
  rachaTitle,
  rachaPixKey,
  enrollments,
}: DeleteRachaDialogProps) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exportFormat, setExportFormat] = useState<"pdf" | "excel">("pdf");

  const exportHref = useMemo(() => {
    return `/api/dashboard/rachas/${rachaId}/participants-export?format=${exportFormat}`;
  }, [exportFormat, rachaId]);

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="danger">
        Remover racha
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-950">
                Confirmar remoção do racha
              </h3>
              <button
                aria-label="Fechar modal"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setOpen(false);
                  setConfirmDelete(false);
                }}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-slate-700">
                Você está prestes a remover o racha{" "}
                <strong>{rachaTitle}</strong>. Esta ação é irreversível.
              </p>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p>
                  <strong>Inscritos:</strong> {enrollments.length}
                </p>
                <p className="mt-1 break-all">
                  <strong>PIX do racha:</strong> {rachaPixKey}
                </p>
              </div>

              <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 p-3">
                <label className="space-y-2 text-sm font-medium text-slate-700">
                  Exportar inscritos
                  <select
                    className="flex h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                    onChange={(event) =>
                      setExportFormat(event.target.value as "pdf" | "excel")
                    }
                    value={exportFormat}
                  >
                    <option value="pdf">PDF</option>
                    <option value="excel">Excel</option>
                  </select>
                </label>

                <a
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                  href={exportHref}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Exportar
                </a>
              </div>

              <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
                {enrollments.length === 0 ? (
                  <p className="p-4 text-sm text-slate-600">
                    Não há inscritos neste racha.
                  </p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th className="px-3 py-2">Nome</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Telefone</th>
                        <th className="px-3 py-2">Chave PIX</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrollments.map((enrollment) => (
                        <tr
                          className="border-t border-slate-100"
                          key={enrollment.id}
                        >
                          <td className="px-3 py-2">
                            {enrollment.participantName}
                          </td>
                          <td className="px-3 py-2">
                            {getUnifiedEnrollmentStatus(enrollment)}
                          </td>
                          <td className="px-3 py-2">
                            {enrollment.participantPhone}
                          </td>
                          <td className="px-3 py-2">
                            {getParticipantPixKey(enrollment.notes)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <input
                  checked={confirmDelete}
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                  onChange={(event) => setConfirmDelete(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  Confirmo que desejo remover este racha e estou ciente de que a
                  ação não poderá ser desfeita.
                </span>
              </label>

              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  onClick={() => {
                    setOpen(false);
                    setConfirmDelete(false);
                  }}
                  type="button"
                  variant="outline"
                >
                  Fechar
                </Button>

                <form action={deleteRachaAction}>
                  <input name="id" type="hidden" value={rachaId} />
                  <input name="confirmDelete" type="hidden" value="true" />
                  <Button
                    disabled={!confirmDelete}
                    type="submit"
                    variant="danger"
                  >
                    Confirmar remoção
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
