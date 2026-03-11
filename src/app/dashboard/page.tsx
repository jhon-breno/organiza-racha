import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { deleteRachaAction } from "@/actions";
import { EmptyState } from "@/components/empty-state";
import { FlashMessage } from "@/components/flash-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/submit-button";
import { modalityLabels } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { formatCurrencyFromCents, formatDateTimeShort } from "@/lib/utils";

type SearchParams = Promise<{
  status?: string;
  message?: string;
}>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/dashboard");
  }

  const params = await searchParams;

  const rachas = await prisma.racha.findMany({
    where: { organizerId: session.user.id },
    include: {
      enrollments: true,
    },
    orderBy: [{ eventDate: "asc" }],
  });

  const activeParticipants = rachas.reduce(
    (total, racha) =>
      total +
      racha.enrollments.filter((item) => item.status === "ACTIVE").length,
    0,
  );
  const refundRequests = rachas.reduce(
    (total, racha) =>
      total +
      racha.enrollments.filter(
        (item) => item.paymentStatus === "REFUND_REQUESTED",
      ).length,
    0,
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">
            Painel do organizador
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">
            Controle seus rachas, atletas, PIX e reembolsos.
          </h1>
        </div>
        <Button asChild href="/dashboard/rachas/new">
          Novo racha
        </Button>
      </div>

      <FlashMessage status={params.status} message={params.message} />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">Rachas publicados</p>
          <p className="mt-2 text-3xl font-black text-slate-950">
            {rachas.length}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Participantes confirmados</p>
          <p className="mt-2 text-3xl font-black text-slate-950">
            {activeParticipants}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Pedidos de reembolso</p>
          <p className="mt-2 text-3xl font-black text-slate-950">
            {refundRequests}
          </p>
        </Card>
      </div>

      {rachas.length === 0 ? (
        <EmptyState
          actionHref="/dashboard/rachas/new"
          actionLabel="Criar primeiro racha"
          description="Você ainda não publicou nenhum racha. Comece criando um evento completo com mapa, PIX e regras."
          title="Seu painel ainda está vazio"
        />
      ) : (
        <div className="grid gap-6">
          {rachas.map((racha) => {
            const confirmed = racha.enrollments.filter(
              (item) => item.status === "ACTIVE",
            ).length;
            const waitlist = racha.enrollments.filter(
              (item) => item.status === "WAITLIST",
            ).length;

            return (
              <Card key={racha.id} className="space-y-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge>
                        {modalityLabels[racha.modality] ?? racha.modality}
                      </Badge>
                      <Badge className="bg-slate-100 text-slate-700">
                        {racha.visibility === "PRIVATE" ? "Privado" : "Aberto"}
                      </Badge>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-950">
                      {racha.title}
                    </h2>
                    <p className="text-sm text-slate-600">
                      {formatDateTimeShort(racha.eventDate)} •{" "}
                      {racha.locationName} •{" "}
                      {formatCurrencyFromCents(racha.priceInCents)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      asChild
                      href={`/rachas/${racha.slug}`}
                      variant="outline"
                    >
                      Ver página pública
                    </Button>
                    <Button asChild href={`/dashboard/rachas/${racha.id}/edit`}>
                      Gerenciar
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm">
                    <p className="text-slate-500">Confirmados</p>
                    <p className="mt-1 text-2xl font-bold text-slate-950">
                      {confirmed}/{racha.athleteLimit}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm">
                    <p className="text-slate-500">Lista de espera</p>
                    <p className="mt-1 text-2xl font-bold text-slate-950">
                      {waitlist}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm">
                    <p className="text-slate-500">Pedidos de reembolso</p>
                    <p className="mt-1 text-2xl font-bold text-slate-950">
                      {
                        racha.enrollments.filter(
                          (item) => item.paymentStatus === "REFUND_REQUESTED",
                        ).length
                      }
                    </p>
                  </div>
                </div>

                <form action={deleteRachaAction}>
                  <input name="id" type="hidden" value={racha.id} />
                  <SubmitButton pendingLabel="Removendo..." variant="danger">
                    Remover racha
                  </SubmitButton>
                </form>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
