"use client";

import { useState } from "react";
import {
  signInWithCredentialsAction,
  signInWithGoogleAction,
  signUpWithPasswordAction,
} from "@/actions";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";

type AuthTabsCardProps = {
  callbackUrl: string;
  initialTab: "signin" | "signup";
  isGoogleConfigured: boolean;
};

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
      <path
        d="M21.35 11.1H12v2.98h5.36c-.23 1.52-1.87 4.46-5.36 4.46-3.23 0-5.86-2.67-5.86-5.96s2.63-5.96 5.86-5.96c1.84 0 3.07.78 3.77 1.45l2.57-2.5C16.7 4.05 14.58 3 12 3 7.03 3 3 7.03 3 12s4.03 9 9 9c5.2 0 8.64-3.65 8.64-8.78 0-.59-.06-1.04-.14-1.48Z"
        fill="#FFC107"
      />
      <path
        d="M4.04 7.69 6.49 9.5C7.15 7.86 8.45 6.62 12 6.62c1.84 0 3.07.78 3.77 1.45l2.57-2.5C16.7 4.05 14.58 3 12 3 8.55 3 5.56 4.98 4.04 7.69Z"
        fill="#FF3D00"
      />
      <path
        d="M12 21c2.52 0 4.64-.83 6.19-2.25l-2.86-2.35c-.77.54-1.8.92-3.33.92-3.48 0-5.12-2.94-5.35-4.45l-2.43 1.88C5.72 18.05 8.61 21 12 21Z"
        fill="#4CAF50"
      />
      <path
        d="M21.35 11.1H12v2.98h5.36c-.11.76-.57 1.85-1.56 2.61l2.86 2.35c1.66-1.54 2.69-3.81 2.69-6.82 0-.59-.06-1.04-.14-1.48Z"
        fill="#1976D2"
      />
    </svg>
  );
}

export function AuthTabsCard({
  callbackUrl,
  initialTab,
  isGoogleConfigured,
}: AuthTabsCardProps) {
  const [activeTab, setActiveTab] = useState<"signin" | "signup">(initialTab);

  return (
    <Card className="space-y-5 rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-5 shadow-xl shadow-slate-200/60 backdrop-blur sm:p-6">
      <div className="rounded-2xl bg-slate-100 p-1">
        <div className="grid grid-cols-2 gap-1">
          <button
            aria-selected={activeTab === "signin"}
            className={`h-11 rounded-xl text-sm font-semibold transition ${
              activeTab === "signin"
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
            onClick={() => setActiveTab("signin")}
            role="tab"
            type="button"
          >
            Entrar
          </button>
          <button
            aria-selected={activeTab === "signup"}
            className={`h-11 rounded-xl text-sm font-semibold transition ${
              activeTab === "signup"
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
            onClick={() => setActiveTab("signup")}
            role="tab"
            type="button"
          >
            Criar conta
          </button>
        </div>
      </div>

      <div className="min-h-136 scroll-mt-24 sm:min-h-144">
        {activeTab === "signin" ? (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-slate-950">
                Entrar na sua conta
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Acesse seus rachas, confirme presença e acompanhe tudo em um só
                lugar.
              </p>
            </div>

            <form action={signInWithCredentialsAction} className="space-y-3">
              <input name="callbackUrl" type="hidden" value={callbackUrl} />
              <label className="space-y-2 text-sm font-medium text-slate-700">
                E-mail ou telefone
                <Input
                  autoComplete="username"
                  name="identifier"
                  placeholder="voce@email.com ou 99 9 9999-9999"
                  required
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-700">
                Senha
                <Input
                  autoComplete="current-password"
                  name="password"
                  placeholder="Sua senha"
                  required
                  type="password"
                />
              </label>
              <SubmitButton className="w-full" pendingLabel="Entrando...">
                Entrar
              </SubmitButton>
            </form>

            <form action={signInWithGoogleAction}>
              <input name="callbackUrl" type="hidden" value={callbackUrl} />
              <SubmitButton
                className="w-full border border-slate-200 bg-white text-slate-900 shadow-sm hover:bg-slate-50"
                pendingLabel="Redirecionando..."
                variant="outline"
              >
                <GoogleIcon />
                {isGoogleConfigured
                  ? "Entrar usando Google"
                  : "Configurar Google Login"}
              </SubmitButton>
            </form>

            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
              <Button
                asChild
                className="h-auto px-0 py-0"
                href="/auth/forgot-password"
                variant="ghost"
              >
                Esqueci minha senha
              </Button>
              <Button
                asChild
                className="h-auto px-0 py-0"
                href="/auth/recover-access"
                variant="ghost"
              >
                Esqueci e-mail/telefone
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-slate-950">
                Criar nova conta
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Cadastre-se para entrar em listas, descobrir partidas e publicar
                seus próprios rachas.
              </p>
            </div>

            <form action={signUpWithPasswordAction} className="space-y-3">
              <input name="callbackUrl" type="hidden" value={callbackUrl} />
              <label className="space-y-2 text-sm font-medium text-slate-700">
                Nome completo
                <Input name="name" placeholder="Seu nome" required />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                E-mail (opcional)
                <Input name="email" placeholder="voce@email.com" type="email" />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Telefone (opcional)
                <PhoneInput name="phone" placeholder="99 9 9999-9999" />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Senha
                <Input
                  autoComplete="new-password"
                  name="password"
                  placeholder="Mínimo de 6 caracteres"
                  required
                  type="password"
                />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Confirmar senha
                <Input
                  autoComplete="new-password"
                  name="confirmPassword"
                  placeholder="Repita sua senha"
                  required
                  type="password"
                />
              </label>

              <SubmitButton className="w-full" pendingLabel="Criando conta...">
                Criar conta
              </SubmitButton>
            </form>
          </div>
        )}
      </div>
    </Card>
  );
}
