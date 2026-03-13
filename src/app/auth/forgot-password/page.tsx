import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { forgotPasswordAction } from "@/actions";
import { FlashMessage } from "@/components/flash-message";
import { SubmitButton } from "@/components/submit-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type SearchParams = Promise<{
  status?: string;
  message?: string;
}>;

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();

  if (session?.user) {
    redirect("/");
  }

  const params = await searchParams;

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="w-full space-y-4">
        <FlashMessage status={params.status} message={params.message} />

        <Card className="space-y-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">
              Recuperar senha
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">
              Esqueceu sua senha?
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Informe seu e-mail ou telefone para gerar um token de redefinição.
            </p>
          </div>

          <form action={forgotPasswordAction} className="space-y-3">
            <label className="space-y-2 text-sm font-medium text-slate-700">
              E-mail ou telefone
              <Input
                name="identifier"
                placeholder="voce@email.com ou 99 9 9999-9999"
                required
              />
            </label>

            <SubmitButton className="w-full" pendingLabel="Gerando token...">
              Gerar token de recuperação
            </SubmitButton>
          </form>

          <p className="text-sm text-slate-600">
            Lembrou sua senha?{" "}
            <Link
              className="font-semibold text-teal-700 hover:underline"
              href="/auth/signin"
            >
              Voltar para login
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
