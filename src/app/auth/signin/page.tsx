import { redirect } from "next/navigation";
import { auth, isGoogleConfigured } from "@/auth";
import { demoAccessAction, signInWithGoogleAction } from "@/actions";
import { FlashMessage } from "@/components/flash-message";
import { SubmitButton } from "@/components/submit-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type SearchParams = Promise<{
  callbackUrl?: string;
  status?: string;
  message?: string;
}>;

export default async function SignInPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();

  if (session?.user) {
    redirect("/");
  }

  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? "/";

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-7xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="space-y-6 bg-linear-to-br from-slate-950 to-teal-900 text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-200">
            Acesso rápido
          </p>
          <h1 className="text-4xl font-black tracking-tight">
            Entre para criar rachas, gerenciar atletas e acompanhar pagamentos.
          </h1>
          <p className="max-w-xl text-sm leading-7 text-white/75">
            O projeto já está preparado para Google Login. Enquanto você
            configura as credenciais OAuth, o modo demo local também fica
            disponível para testes e demonstrações.
          </p>
        </Card>

        <div className="space-y-4">
          <FlashMessage status={params.status} message={params.message} />

          <Card className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-950">Google Login</h2>
            <p className="text-sm leading-6 text-slate-600">
              Recomendado para a experiência real dos usuários.
            </p>
            <form action={signInWithGoogleAction}>
              <input name="callbackUrl" type="hidden" value={callbackUrl} />
              <SubmitButton className="w-full" pendingLabel="Redirecionando...">
                {isGoogleConfigured
                  ? "Entrar com Google"
                  : "Configurar Google Login"}
              </SubmitButton>
            </form>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-950">
              Modo demo local
            </h2>
            <p className="text-sm leading-6 text-slate-600">
              Ideal para validar rapidamente o fluxo sem depender do OAuth.
            </p>
            <form action={demoAccessAction} className="space-y-4">
              <input name="callbackUrl" type="hidden" value={callbackUrl} />
              <label className="space-y-2 text-sm font-medium text-slate-700">
                Nome
                <Input name="name" placeholder="Seu nome" required />
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-700">
                E-mail
                <Input
                  name="email"
                  placeholder="voce@email.com"
                  type="email"
                  required
                />
              </label>
              <SubmitButton
                className="w-full"
                pendingLabel="Entrando..."
                variant="outline"
              >
                Entrar no modo demo
              </SubmitButton>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
