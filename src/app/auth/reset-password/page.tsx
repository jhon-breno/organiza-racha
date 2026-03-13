import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { resetPasswordAction } from "@/actions";
import { FlashMessage } from "@/components/flash-message";
import { SubmitButton } from "@/components/submit-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type SearchParams = Promise<{
  token?: string;
  status?: string;
  message?: string;
}>;

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();

  if (session?.user) {
    redirect("/");
  }

  const params = await searchParams;
  const token = params.token ?? "";

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="w-full space-y-4">
        <FlashMessage status={params.status} message={params.message} />

        <Card className="space-y-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">
              Redefinir senha
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">
              Crie uma nova senha
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Use o token de recuperação para atualizar o acesso da sua conta.
            </p>
          </div>

          <form action={resetPasswordAction} className="space-y-3">
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Token de recuperação
              <Input
                defaultValue={token}
                name="token"
                placeholder="Cole o token gerado"
                required
              />
            </label>

            <label className="space-y-2 text-sm font-medium text-slate-700">
              Nova senha
              <Input
                autoComplete="new-password"
                name="password"
                placeholder="Mínimo de 6 caracteres"
                required
                type="password"
              />
            </label>

            <label className="space-y-2 text-sm font-medium text-slate-700">
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
              className="w-full"
              pendingLabel="Atualizando senha..."
            >
              Redefinir senha
            </SubmitButton>
          </form>

          <p className="text-sm text-slate-600">
            Voltar para{" "}
            <Link
              className="font-semibold text-teal-700 hover:underline"
              href="/auth/signin"
            >
              tela de login
            </Link>
            .
          </p>
        </Card>
      </div>
    </div>
  );
}
