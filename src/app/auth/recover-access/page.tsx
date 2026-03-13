import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { recoverIdentifierAction } from "@/actions";
import { FlashMessage } from "@/components/flash-message";
import { SubmitButton } from "@/components/submit-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type SearchParams = Promise<{
  status?: string;
  message?: string;
}>;

export default async function RecoverAccessPage({
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
              Recuperar login
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">
              Esqueceu e-mail ou telefone?
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Informe seu nome e um dado de contato que você lembra para receber
              dicas do seu acesso.
            </p>
          </div>

          <form action={recoverIdentifierAction} className="space-y-3">
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Nome
              <Input name="name" placeholder="Seu nome" required />
            </label>

            <label className="space-y-2 text-sm font-medium text-slate-700">
              E-mail ou telefone que você lembra
              <Input
                name="knownIdentifier"
                placeholder="voce@email.com ou 99 9 9999-9999"
                required
              />
            </label>

            <SubmitButton className="w-full" pendingLabel="Buscando...">
              Recuperar meu acesso
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
