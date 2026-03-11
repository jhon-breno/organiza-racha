import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { cancelEnrollmentAction } from "@/actions";
import { EmptyState } from "@/components/empty-state";
import { FlashMessage } from "@/components/flash-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/submit-button";
import { participantStatusLabels, paymentStatusLabels } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { formatCurrencyFromCents, formatDateTimeShort } from "@/lib/utils";

type SearchParams = Promise<{
  status?: string;
  message?: string;
}>;

export default async function MyEnrollmentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/minhas-inscricoes");
  }

  const params = await searchParams;
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: session.user.id },
    include: {
      racha: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">
          Área do atleta
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">
          Suas inscrições e pedidos de reembolso.
        </h1>
      </div>

      <FlashMessage status={params.status} message={params.message} />

      {enrollments.length === 0 ? (
        <EmptyState
          actionHref="/"
          actionLabel="Explorar rachas"
          description="Você ainda não entrou em nenhum racha. Escolha um evento e confirme sua participação."
          title="Nenhuma inscrição encontrada"
        />
      ) : (
        <div className="grid gap-6">
          {enrollments.map((enrollment) => {
            const deadline = new Date(
              enrollment.racha.eventDate.getTime() -
                enrollment.racha.cancellationWindowHours * 60 * 60 * 1000,
            );
            const canCancel =
              new Date() <= deadline && enrollment.status !== "CANCELED";

            return (
              <Card key={enrollment.id} className="space-y-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-slate-950">
                      {enrollment.racha.title}
                    </h2>
                    <p className="text-sm text-slate-600">
                      {formatDateTimeShort(enrollment.racha.eventDate)} •{" "}
                      {enrollment.racha.locationName}
                    </p>
                    <p className="text-sm text-slate-600">
                      Valor:{" "}
                      {formatCurrencyFromCents(enrollment.racha.priceInCents)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge>
                      {participantStatusLabels[enrollment.status] ??
                        enrollment.status}
                    </Badge>
                    <Badge className="bg-slate-100 text-slate-700">
                      {paymentStatusLabels[enrollment.paymentStatus] ??
                        enrollment.paymentStatus}
                    </Badge>
                  </div>
                </div>

                <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                  <p>Posição: {enrollment.participantPosition}</p>
                  <p>Telefone: {enrollment.participantPhone}</p>
                  <p>
                    Prazo de desistência: {deadline.toLocaleString("pt-BR")}
                  </p>
                  <p>PIX informado: {enrollment.pixPaid ? "Sim" : "Não"}</p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    asChild
                    href={`/rachas/${enrollment.racha.slug}`}
                    variant="outline"
                  >
                    Ver racha
                  </Button>
                  {canCancel ? (
                    <form action={cancelEnrollmentAction}>
                      <input
                        name="enrollmentId"
                        type="hidden"
                        value={enrollment.id}
                      />
                      <SubmitButton
                        pendingLabel="Cancelando..."
                        variant="danger"
                      >
                        Desistir e pedir reembolso
                      </SubmitButton>
                    </form>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
