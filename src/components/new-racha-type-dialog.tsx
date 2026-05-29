"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Props = {
  /** Conteúdo renderizado dentro do botão gatilho (ignorado no modo controlado) */
  children?: React.ReactNode;
  /** Variante visual do botão gatilho */
  variant?: "default" | "outline" | "ghost" | "secondary";
  /** Classe extra para o botão gatilho */
  className?: string;
  /** Callback antes de abrir — ex.: fechar menu mobile (modo não-controlado) */
  onBeforeOpen?: () => void;
  /**
   * Modo controlado: estado externo do diálogo.
   * Quando fornecido, o botão gatilho NÃO é renderizado.
   */
  open?: boolean;
  /** Modo controlado: callback para mudar o estado */
  onOpenChange?: (open: boolean) => void;
};

export function NewRachaTypeDialog({
  children = "Novo racha",
  variant,
  className,
  onBeforeOpen,
  open: controlledOpen,
  onOpenChange,
}: Props) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const open = isControlled ? controlledOpen : internalOpen;
  const dialogRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  function setOpen(value: boolean) {
    if (isControlled) {
      onOpenChange?.(value);
    } else {
      setInternalOpen(value);
    }
  }

  // Garante que o portal só renderiza no cliente (evita erro de SSR)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fecha ao clicar fora do painel ou pressionar Escape
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      {/* Botão gatilho — omitido no modo controlado */}
      {!isControlled && (
        <Button
          className={className}
          variant={variant}
          onClick={() => {
            onBeforeOpen?.();
            setOpen(true);
          }}
        >
          {children}
        </Button>
      )}

      {/* Portal: renderiza no document.body, fora de qualquer stacking context */}
      {open &&
        isMounted &&
        createPortal(
          <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 p-4">
            <div
              ref={dialogRef}
              className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="racha-type-title"
            >
              <h2
                id="racha-type-title"
                className="mb-6 text-2xl font-black tracking-tight text-slate-950"
              >
                Qual tipo de racha você quer criar?
              </h2>

              <div className="flex flex-col gap-3">
                {/* Racha único */}
                <button
                  onClick={() => {
                    setOpen(false);
                    router.push("/dashboard/rachas/new");
                  }}
                  title="Evento pontual que não se repete. Ideal para um racha avulso."
                  className="group flex flex-col items-start gap-1 rounded-2xl border-2 border-teal-600 bg-teal-50 px-5 py-4 text-left transition hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                >
                  <span className="text-base font-bold text-teal-800">
                    Criar racha único
                  </span>
                  <span className="block text-xs text-teal-600 sm:hidden">
                    Não se repete
                  </span>
                  <span className="hidden text-xs text-teal-600 opacity-0 transition-opacity group-hover:opacity-100 sm:block">
                    Não se repete
                  </span>
                </button>

                {/* Grupo de rachas — em breve */}
                <button
                  disabled
                  title="Mantém dados e usuários entre rachas, com funcionalidades avançadas. Em breve!"
                  className="group flex flex-col items-start gap-1 rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-4 text-left opacity-60 cursor-not-allowed"
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="text-base font-bold text-slate-700">
                      Grupo de rachas
                    </span>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Em breve
                    </span>
                  </div>
                  <span className="block text-xs text-slate-500 sm:hidden">
                    Mantém dados, usuários e mais funcionalidades
                  </span>
                  <span className="hidden text-xs text-slate-500 opacity-0 transition-opacity group-hover:opacity-100 sm:block">
                    Mantém dados, usuários e mais funcionalidades
                  </span>
                </button>
              </div>

              <button
                onClick={() => setOpen(false)}
                className="mt-6 w-full rounded-xl py-2 text-sm text-slate-400 transition hover:text-slate-600"
              >
                Cancelar
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
