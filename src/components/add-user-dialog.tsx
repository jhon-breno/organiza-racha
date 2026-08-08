"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { UserPlus, X } from "lucide-react";
import { createOrganizerUserAction } from "@/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { SubmitButton } from "@/components/submit-button";

export function AddUserDialog() {
  const [open, setOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  return (
    <>
      <Button
        className="gap-2 bg-slate-900 text-white hover:bg-slate-800"
        onClick={() => setOpen(true)}
        type="button"
        variant="outline"
      >
        <UserPlus className="h-4 w-4" />
        Add Usuário
      </Button>

      {open &&
        isMounted &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div
              ref={dialogRef}
              aria-labelledby="add-user-title"
              aria-modal="true"
              className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
              role="dialog"
            >
              <button
                aria-label="Fechar"
                className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                onClick={() => setOpen(false)}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="space-y-1">
                <h2
                  id="add-user-title"
                  className="text-2xl font-bold text-slate-950"
                >
                  Adicionar Usuário
                </h2>
                <p className="text-sm text-slate-600">
                  Cadastre um usuário no banco para que ele possa acessar e participar dos rachas.
                </p>
              </div>

              <form action={createOrganizerUserAction} className="mt-6 space-y-4">
                <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                  Nome*
                  <Input name="name" placeholder="Nome completo" required />
                </label>

                <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                  Apelido
                  <Input name="nickname" placeholder="Apelido (opcional)" />
                </label>

                <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                  Telefone* (DDD + Número)
                  <PhoneInput name="phone" placeholder="85999469423" required />
                </label>

                <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                  E-mail
                  <Input
                    name="email"
                    placeholder="email@exemplo.com (opcional)"
                    type="email"
                  />
                </label>

                <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                  Senha*
                  <Input
                    name="password"
                    placeholder="Senha de acesso"
                    required
                    type="password"
                  />
                </label>

                <div className="pt-2">
                  <SubmitButton className="w-full" pendingLabel="Cadastrando...">
                    Cadastrar Usuário
                  </SubmitButton>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
