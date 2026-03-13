import { redirect } from "next/navigation";
import { auth, isGoogleConfigured } from "@/auth";
import { AuthTabsCard } from "@/components/auth-tabs-card";
import { FlashMessage } from "@/components/flash-message";
import { Card } from "@/components/ui/card";

type SearchParams = Promise<{
  callbackUrl?: string;
  status?: string;
  message?: string;
  tab?: string;
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
  const activeTab = params.tab === "signup" ? "signup" : "signin";

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-7xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="space-y-6 bg-linear-to-br from-slate-950 to-teal-900 text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-200">
            Acesse mais rápido
          </p>
          <h1 className="text-4xl font-black tracking-tight">
            Descubra seu próximo racha ou organize o seu com muito menos
            esforço.
          </h1>
          <p className="max-w-xl text-sm leading-7 text-white/75">
            Entre para participar de partidas, confirmar presença, acompanhar
            pagamentos e criar rachas com tudo organizado em um só lugar.
          </p>
        </Card>

        <div className="space-y-4">
          <FlashMessage status={params.status} message={params.message} />

          <AuthTabsCard
            callbackUrl={callbackUrl}
            initialTab={activeTab}
            isGoogleConfigured={isGoogleConfigured}
          />
        </div>
      </div>
    </div>
  );
}
