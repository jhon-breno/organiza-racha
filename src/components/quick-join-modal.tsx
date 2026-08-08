"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, MapPin, Share2, Trophy, Users, Zap, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { modalityLabels } from "@/lib/constants";
import { formatCurrencyFromCents, formatDateTimeShort } from "@/lib/utils";

type QuickJoinModalProps = {
  racha: {
    id: string;
    slug: string;
    title: string;
    modality: string;
    eventDate: Date | string;
    locationName: string;
    priceInCents: number;
    athleteLimit: number;
    confirmedCount: number;
    visibility: "OPEN" | "PRIVATE";
  };
  isAuthenticated: boolean;
  hasEnrollment?: boolean;
  defaultOpen?: boolean;
};

export function QuickJoinModal({
  racha,
  isAuthenticated,
  hasEnrollment = false,
  defaultOpen = false,
}: QuickJoinModalProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isQuickJoinParam = searchParams.get("quickJoin") === "true";
  const [open, setOpen] = useState(defaultOpen || isQuickJoinParam);
  const dialogRef = useRef<HTMLDivElement>(null);

  const [prevQuickJoin, setPrevQuickJoin] = useState(isQuickJoinParam);
  if (isQuickJoinParam && !prevQuickJoin) {
    setPrevQuickJoin(true);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function handleEnterRacha() {
    if (!isAuthenticated) {
      const callbackUrl = `/rachas/${racha.slug}?quickJoin=true`;
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }

    setOpen(false);
    // Scroll smoothly to join form
    const joinForm = document.getElementById("join-racha-form");
    if (joinForm) {
      joinForm.scrollIntoView({ behavior: "smooth" });
    }
  }

  const dateFormatted = formatDateTimeShort(
    typeof racha.eventDate === "string" ? new Date(racha.eventDate) : racha.eventDate,
  );

  return (
    <>
      <Button
        className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md hover:from-emerald-700 hover:to-teal-700"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Zap className="h-4 w-4 fill-white/20" />
        Entrada Rápida
      </Button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div
              ref={dialogRef}
              aria-labelledby="quick-join-title"
              aria-modal="true"
              className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
              role="dialog"
            >
              <div className="bg-gradient-to-br from-slate-900 to-teal-950 p-6 text-white sm:p-8">
                <button
                  aria-label="Fechar"
                  className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40">
                    {modalityLabels[racha.modality] ?? racha.modality}
                  </Badge>
                  <Badge className="bg-white/10 text-white/80">
                    {racha.visibility === "PRIVATE" ? "Privado" : "Aberto"}
                  </Badge>
                </div>

                <h2
                  id="quick-join-title"
                  className="mt-3 text-3xl font-black tracking-tight text-white"
                >
                  {racha.title}
                </h2>
                <p className="mt-1 text-sm text-teal-200/80">
                  Convite de participação rápida no racha
                </p>
              </div>

              <div className="p-6 sm:p-8 space-y-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
                    <Calendar className="mt-0.5 h-5 w-5 text-teal-600 shrink-0" />
                    <div>
                      <p className="text-xs uppercase font-semibold text-slate-400">Data e Hora</p>
                      <p className="text-sm font-semibold text-slate-900">{dateFormatted}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
                    <MapPin className="mt-0.5 h-5 w-5 text-teal-600 shrink-0" />
                    <div>
                      <p className="text-xs uppercase font-semibold text-slate-400">Local</p>
                      <p className="text-sm font-semibold text-slate-900">{racha.locationName}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
                    <Trophy className="mt-0.5 h-5 w-5 text-teal-600 shrink-0" />
                    <div>
                      <p className="text-xs uppercase font-semibold text-slate-400">Modalidade</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {modalityLabels[racha.modality] ?? racha.modality}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
                    <Users className="mt-0.5 h-5 w-5 text-teal-600 shrink-0" />
                    <div>
                      <p className="text-xs uppercase font-semibold text-slate-400">Vagas / Valor</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {racha.confirmedCount}/{racha.athleteLimit} • {formatCurrencyFromCents(racha.priceInCents)}
                      </p>
                    </div>
                  </div>
                </div>

                {hasEnrollment ? (
                  <div className="rounded-2xl bg-emerald-50 p-4 border border-emerald-200 text-center space-y-2">
                    <div className="inline-flex items-center gap-2 text-emerald-800 font-bold text-base">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      Você já está inscrito neste racha!
                    </div>
                    <p className="text-xs text-emerald-700">
                      Sua vaga está garantida. Veja detalhes nas suas inscrições.
                    </p>
                  </div>
                ) : (
                  <Button
                    className="w-full py-6 text-base font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-lg"
                    onClick={handleEnterRacha}
                    type="button"
                  >
                    {isAuthenticated ? "Entrar no racha agora" : "Entrar no racha (Fazer Login)"}
                  </Button>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
