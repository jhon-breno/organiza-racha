"use client";

import { useState } from "react";
import { CheckCircle2, Flag, Lock, RotateCcw, X } from "lucide-react";
import { closeRachaAction, reopenRachaAction } from "@/actions";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";

type CloseRachaDialogProps = {
  rachaId: string;
  rachaTitle: string;
  status?: string;
  isEnded?: boolean;
  callbackUrl?: string;
  size?: "default" | "sm";
  variant?: "default" | "outline" | "ghost" | "secondary";
};

export function CloseRachaDialog({
  rachaId,
  rachaTitle,
  status,
  isEnded,
  callbackUrl,
  size = "default",
  variant = "outline",
}: CloseRachaDialogProps) {
  const [open, setOpen] = useState(false);
  const isCompleted = status === "COMPLETED" || Boolean(isEnded);

  return (
    <>
      {isCompleted ? (
        <Button
          onClick={() => setOpen(true)}
          size={size}
          variant={variant}
          className="border-emerald-200 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900"
        >
          <RotateCcw className="h-4 w-4" />
          Reabrir racha
        </Button>
      ) : (
        <Button
          onClick={() => setOpen(true)}
          size={size}
          variant={variant}
          className="border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
        >
          <Flag className="h-4 w-4 text-amber-600" />
          Encerrar racha
        </Button>
      )}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {isCompleted ? (
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <RotateCcw className="h-5 w-5" />
                  </div>
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    <Lock className="h-5 w-5" />
                  </div>
                )}
                <h3 className="text-lg font-bold text-slate-950">
                  {isCompleted ? "Reabrir Racha" : "Encerrar Racha"}
                </h3>
              </div>
              <button
                aria-label="Fechar modal"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                onClick={() => setOpen(false)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {isCompleted ? (
                <>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    Você está prestes a reabrir o racha{" "}
                    <strong className="text-slate-950">{rachaTitle}</strong>.
                  </p>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-950 space-y-2">
                    <p className="font-semibold text-emerald-900 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                      Ao reabrir o racha:
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-xs text-emerald-900">
                      <li>As inscrições públicas serão novamente permitidas se a data for futura.</li>
                      <li>O racha voltará a ser exibido na lista de rachas ativos.</li>
                    </ul>
                  </div>

                  <div className="flex flex-wrap justify-end gap-3 pt-2">
                    <Button
                      onClick={() => setOpen(false)}
                      type="button"
                      variant="outline"
                    >
                      Cancelar
                    </Button>
                    <form action={reopenRachaAction}>
                      <input name="rachaId" type="hidden" value={rachaId} />
                      {callbackUrl ? (
                        <input name="callbackUrl" type="hidden" value={callbackUrl} />
                      ) : null}
                      <SubmitButton
                        pendingLabel="Reabrindo..."
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                      >
                        Confirmar e Reabrir
                      </SubmitButton>
                    </form>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    Tem certeza de que deseja encerrar o racha{" "}
                    <strong className="text-slate-950">{rachaTitle}</strong>?
                  </p>
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-950 space-y-2">
                    <p className="font-semibold text-amber-900 flex items-center gap-2">
                      <Lock className="h-4 w-4 text-amber-700" />
                      Ao encerrar o racha:
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-xs text-amber-900">
                      <li>As novas inscrições na página pública serão bloqueadas imediatamente.</li>
                      <li>O racha será movido para a aba de <strong>Rachas Encerrados</strong> no painel.</li>
                      <li>Você ainda terá acesso total à lista de participantes e aos comprovantes.</li>
                      <li>Você poderá reabrir o racha a qualquer momento se desejar.</li>
                    </ul>
                  </div>

                  <div className="flex flex-wrap justify-end gap-3 pt-2">
                    <Button
                      onClick={() => setOpen(false)}
                      type="button"
                      variant="outline"
                    >
                      Voltar
                    </Button>
                    <form action={closeRachaAction}>
                      <input name="rachaId" type="hidden" value={rachaId} />
                      {callbackUrl ? (
                        <input name="callbackUrl" type="hidden" value={callbackUrl} />
                      ) : null}
                      <SubmitButton
                        pendingLabel="Encerrando..."
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                      >
                        Confirmar e Encerrar Racha
                      </SubmitButton>
                    </form>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
