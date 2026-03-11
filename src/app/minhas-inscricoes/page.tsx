import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { EmptyState } from "@/components/empty-state";
import { FlashMessage } from "@/components/flash-message";
import { MyEnrollmentActions } from "@/components/my-enrollment-actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { formatCurrencyFromCents, formatDateTimeShort } from "@/lib/utils";

type SearchParams = Promise<{
  status?: string;
  message?: string;
}>;

function getUnifiedEnrollmentStatus(enrollment: {
  status: string;
  paymentStatus: string;
}) {
  if (
    enrollment.status === "CANCELED" ||
    enrollment.paymentStatus === "REFUND_REQUESTED"
  ) {
    return {
      label: "Cancelado",
      badgeClassName: "bg-rose-100 text-rose-700",
    };
  }

  if (enrollment.status === "WAITLIST") {
    return {
      label: "Lista de espera",
      badgeClassName: "bg-slate-100 text-slate-700",
    };
  }

  if (enrollment.paymentStatus === "PAID") {
    return {
      label: "Confirmado",
      badgeClassName: "bg-emerald-100 text-emerald-700",
    };
  }

  return {
    label: "Aguardando pagamento",
    badgeClassName: "bg-amber-100 text-amber-700",
  };
}

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
    where: {
      userId: session.user.id,
      paymentStatus: {
        not: "REFUNDED",
      },
    },
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
            const unifiedStatus = getUnifiedEnrollmentStatus(enrollment);
            const paymentDeadlineLabel = enrollment.racha.paymentDeadline
              ? formatDateTimeShort(enrollment.racha.paymentDeadline)
              : null;

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
                    <Badge className={unifiedStatus.badgeClassName}>
                      {unifiedStatus.label}
                    </Badge>
                  </div>
                </div>

                <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                  <p>Posição: {enrollment.participantPosition}</p>
                  <p>Telefone: {enrollment.participantPhone}</p>
                  <p>
                    Prazo de desistência: {deadline.toLocaleString("pt-BR")}
                  </p>
                  {paymentDeadlineLabel ? (
                    <p>Prazo para pagamento: {paymentDeadlineLabel}</p>
                  ) : null}
                </div>

                <MyEnrollmentActions
                  enrollmentId={enrollment.id}
                  enrollmentStatus={enrollment.status}
                  paymentStatus={enrollment.paymentStatus}
                  paymentDeadline={paymentDeadlineLabel}
                  pixKey={enrollment.racha.pixKey}
                  rachaSlug={enrollment.racha.slug}
                />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
