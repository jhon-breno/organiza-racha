import { redirect } from "next/navigation";
import { PaymentStatus, ParticipantStatus, Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { updateOrganizerDataSettingsAction } from "@/actions";
import { DeleteRachaDialog } from "@/components/delete-racha-dialog";
import { EmptyState } from "@/components/empty-state";
import { FlashMessage } from "@/components/flash-message";
import { PendingPaymentsModal } from "@/components/pending-payments-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

  const userModel = Prisma.dmmf.datamodel.models.find(
    (model) => model.name === "User",
  );
  const supportsNickname = Boolean(
    userModel?.fields.some((field) => field.name === "nickname"),
  );
  const supportsPixKey = Boolean(
    userModel?.fields.some((field) => field.name === "pixKey"),
  );

  const organizerSelect: Record<string, boolean> = {
    email: true,
    name: true,
    phone: true,
  };

  if (supportsNickname) {
    organizerSelect.nickname = true;
  }

  if (supportsPixKey) {
    organizerSelect.pixKey = true;
  }

  const organizerProfile = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: organizerSelect,
  });

  if (!organizerProfile) {
    redirect("/auth/signin?callbackUrl=/dashboard");
  }

  const rachas = await prisma.racha.findMany({
    where: { organizerId: session.user.id },
    include: {
      enrollments: true,
    },
    orderBy: [{ eventDate: "asc" }],
  });

  const confirmedParticipants = rachas.reduce(
    (total, racha) =>
      total +
      racha.enrollments.filter(
        (item) =>
          item.status === ParticipantStatus.ACTIVE &&
          item.paymentStatus === PaymentStatus.PAID,
      ).length,
    0,
  );
  const pendingParticipants = rachas.reduce(
    (total, racha) =>
      total +
      racha.enrollments.filter(
        (item) =>
          item.status === ParticipantStatus.ACTIVE &&
          [PaymentStatus.PENDING, PaymentStatus.PROOF_SENT].includes(
            item.paymentStatus,
          ),
      ).length,
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

      <Card className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">
            Configurações de dados
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Defina os dados padrão do organizador para agilizar a criação dos
            próximos rachas.
          </p>
        </div>

        <form
          action={updateOrganizerDataSettingsAction}
          className="grid gap-4 md:grid-cols-2"
        >
          <label className="space-y-2 text-sm font-medium text-slate-700">
            Apelido (opcional)
            <Input
              defaultValue={organizerProfile.nickname ?? ""}
              name="nickname"
              placeholder={organizerProfile.name ?? "Seu apelido"}
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Telefone
            <Input
              defaultValue={organizerProfile.phone ?? ""}
              name="phone"
              placeholder="5585999999999"
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Chave PIX
            <Input
              defaultValue={organizerProfile.pixKey ?? ""}
              name="pixKey"
              placeholder="CPF, e-mail, telefone ou chave aleatória"
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            E-mail (Google)
            <Input
              defaultValue={organizerProfile.email ?? ""}
              disabled
              readOnly
            />
          </label>

          <div className="md:col-span-2">
            <SubmitButton pendingLabel="Salvando...">
              Salvar configurações
            </SubmitButton>
          </div>
        </form>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm text-slate-500">Rachas publicados</p>
          <p className="mt-2 text-3xl font-black text-slate-950">
            {rachas.length}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Participantes confirmados</p>
          <p className="mt-2 text-3xl font-black text-slate-950">
            {confirmedParticipants}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Aguardando pagamento</p>
          <p className="mt-2 text-3xl font-black text-amber-600">
            {pendingParticipants}
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
              (item) =>
                item.status === ParticipantStatus.ACTIVE &&
                item.paymentStatus === PaymentStatus.PAID,
            ).length;
            const awaitingPayment = racha.enrollments.filter(
              (item) =>
                item.status === ParticipantStatus.ACTIVE &&
                [PaymentStatus.PENDING, PaymentStatus.PROOF_SENT].includes(
                  item.paymentStatus,
                ),
            ).length;
            const waitlist = racha.enrollments.filter(
              (item) => item.status === ParticipantStatus.WAITLIST,
            ).length;
            const pendingEnrollments = racha.enrollments
              .filter(
                (item) =>
                  item.status === ParticipantStatus.ACTIVE &&
                  [PaymentStatus.PENDING, PaymentStatus.PROOF_SENT].includes(
                    item.paymentStatus,
                  ),
              )
              .map((item) => ({
                id: item.id,
                participantName: item.participantName,
                participantPhone: item.participantPhone,
                paymentStatus: item.paymentStatus,
              }));

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

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm">
                    <p className="text-slate-500">Confirmados</p>
                    <p className="mt-1 text-2xl font-bold text-slate-950">
                      {confirmed}/{racha.athleteLimit}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-amber-50 p-4 text-sm ring-1 ring-amber-100">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-amber-700">Aguardando pagamento</p>
                        <p className="mt-1 text-2xl font-bold text-amber-900">
                          {awaitingPayment}
                        </p>
                      </div>
                      <PendingPaymentsModal
                        callbackUrl="/dashboard"
                        enrollments={pendingEnrollments}
                        rachaTitle={racha.title}
                      />
                    </div>
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

                <DeleteRachaDialog
                  enrollments={racha.enrollments}
                  rachaId={racha.id}
                  rachaPixKey={racha.pixKey}
                  rachaTitle={racha.title}
                />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
