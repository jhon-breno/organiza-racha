import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { changePasswordAction } from "@/actions";
import { FlashMessage } from "@/components/flash-message";
import { SubmitButton } from "@/components/submit-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ShieldAlert, KeyRound } from "lucide-react";

type SearchParams = Promise<{
  callbackUrl?: string;
  required?: string;
  status?: string;
  message?: string;
}>;

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/auth/change-password");
  }

  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? "/";
  const isRequired = params.required === "true" || Boolean(session.user.mustChangePassword);

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="w-full space-y-4">
        <FlashMessage status={params.status} message={params.message} />

        {isRequired && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm">
            <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
            <div className="space-y-1">
              <p className="font-bold text-sm">Alteração de senha obrigatória</p>
              <p className="text-xs text-amber-800 leading-relaxed">
                Sua conta foi cadastrada por um organizador. Por questões de segurança, crie uma senha pessoal antes de continuar acessando o sistema.
              </p>
            </div>
          </div>
        )}

        <Card className="space-y-6">
          <div>
            <div className="flex items-center gap-2 text-teal-700">
              <KeyRound className="h-5 w-5" />
              <p className="text-sm font-semibold uppercase tracking-[0.2em]">
                Segurança da Conta
              </p>
            </div>
            <h1 className="mt-2 text-2xl font-black text-slate-950">
              Alterar senha de acesso
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Defina uma nova senha forte para proteger sua conta.
            </p>
          </div>

          <form action={changePasswordAction} className="space-y-4">
            <input type="hidden" name="callbackUrl" value={callbackUrl} />

            <label className="block space-y-2 text-sm font-medium text-slate-700">
              Senha atual (fornecida pelo organizador)
              <Input
                autoComplete="current-password"
                name="currentPassword"
                placeholder="Sua senha atual"
                required
                type="password"
              />
            </label>

            <label className="block space-y-2 text-sm font-medium text-slate-700">
              Nova senha
              <Input
                autoComplete="new-password"
                name="newPassword"
                placeholder="Mínimo de 6 caracteres"
                required
                type="password"
              />
            </label>

            <label className="block space-y-2 text-sm font-medium text-slate-700">
              Confirmar nova senha
              <Input
                autoComplete="new-password"
                name="confirmPassword"
                placeholder="Repita a nova senha"
                required
                type="password"
              />
            </label>

            <SubmitButton
              className="w-full bg-slate-900 text-white hover:bg-slate-800"
              pendingLabel="Salvando nova senha..."
            >
              Alterar senha e continuar
            </SubmitButton>
          </form>

          <p className="text-xs text-slate-500 text-center">
            Dúvidas? Entre em contato com o organizador do seu racha.
          </p>
        </Card>
      </div>
    </div>
  );
}
