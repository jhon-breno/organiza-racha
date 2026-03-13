import { PaymentStatus, ParticipantStatus } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AllAthletesListModal } from "@/components/all-athletes-list-modal";
import { ConfirmedListModal } from "@/components/confirmed-list-modal";
import { EnrollmentManagement } from "@/components/enrollment-management";
import { FlashMessage } from "@/components/flash-message";
import { PendingPaymentsModal } from "@/components/pending-payments-modal";
import { RachaForm } from "@/components/racha-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ status?: string; message?: string }>;

export default async function EditRachaPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/dashboard");
  }

  const { id } = await params;
  const query = await searchParams;

  const racha = await prisma.racha.findUnique({
    where: { id },
    include: {
      enrollments: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  if (!racha || racha.organizerId !== session.user.id) {
    notFound();
  }

  const editPageUrl = `/dashboard/rachas/${racha.id}/edit`;
  const pendingPaymentStatuses: PaymentStatus[] = [
    PaymentStatus.PENDING,
    PaymentStatus.PROOF_SENT,
  ];
  const confirmedEnrollments = racha.enrollments.filter(
    (item) =>
      item.status === ParticipantStatus.ACTIVE &&
      item.paymentStatus === PaymentStatus.PAID,
  );
  const pendingEnrollments = racha.enrollments
    .filter(
      (item) =>
        item.status === ParticipantStatus.ACTIVE &&
        pendingPaymentStatuses.includes(item.paymentStatus),
    )
    .map((item) => ({
      id: item.id,
      participantName: item.participantName,
      participantPhone: item.participantPhone,
      paymentStatus: item.paymentStatus,
    }));
  const waitlistCount = racha.enrollments.filter(
    (item) => item.status === ParticipantStatus.WAITLIST,
  ).length;
  const totalAthletes = racha.enrollments.filter(
    (item) =>
      item.status !== ParticipantStatus.CANCELED &&
      item.paymentStatus !== PaymentStatus.REFUNDED,
  ).length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">
            Gestão do racha
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">
            {racha.title}
          </h1>
        </div>
        <div className="flex gap-3">
          <Button asChild href={`/rachas/${racha.slug}`} variant="outline">
            Ver página pública
          </Button>
          <Button asChild href="/dashboard" variant="ghost">
            Voltar ao painel
          </Button>
        </div>
      </div>

      <FlashMessage status={query.status} message={query.message} />

      <RachaForm defaultValues={racha} />

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">
            Participantes e pagamentos
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Confirme PIX, acompanhe lista de espera e finalize reembolsos.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">Confirmados</p>
                <p className="mt-1 text-2xl font-black text-slate-950">
                  {confirmedEnrollments.length}/{racha.athleteLimit}
                </p>
              </div>
              <ConfirmedListModal
                rachaId={racha.id}
                rachaTitle={racha.title}
                eventDate={racha.eventDate}
                locationName={racha.locationName}
                enrollments={confirmedEnrollments.map((item) => ({
                  id: item.id,
                  participantName: item.participantName,
                  participantPhone: item.participantPhone,
                  participantPosition: item.participantPosition,
                  participantLevel: item.participantLevel,
                  status: item.status,
                  paymentStatus: item.paymentStatus,
                }))}
                athleteLimit={racha.athleteLimit}
                whatsappGroupUrl={racha.whatsappGroupUrl}
              />
            </div>
          </Card>

          <Card className="bg-amber-50 ring-1 ring-amber-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-amber-700">Aguardando pagamento</p>
                <p className="mt-1 text-2xl font-black text-amber-900">
                  {pendingEnrollments.length}
                </p>
              </div>
              <PendingPaymentsModal
                callbackUrl={editPageUrl}
                enrollments={pendingEnrollments}
                rachaTitle={racha.title}
              />
            </div>
          </Card>

          <Card>
            <p className="text-sm text-slate-500">Lista de espera</p>
            <p className="mt-1 text-2xl font-black text-slate-950">
              {waitlistCount}
            </p>
          </Card>

          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">Todos os atletas</p>
                <p className="mt-1 text-2xl font-black text-slate-950">
                  {totalAthletes}
                </p>
              </div>
              <AllAthletesListModal
                rachaId={racha.id}
                rachaTitle={racha.title}
                eventDate={racha.eventDate}
                locationName={racha.locationName}
                enrollments={racha.enrollments.map((item) => ({
                  id: item.id,
                  participantName: item.participantName,
                  participantPhone: item.participantPhone,
                  participantPosition: item.participantPosition,
                  participantLevel: item.participantLevel,
                  status: item.status,
                  paymentStatus: item.paymentStatus,
                }))}
                athleteLimit={racha.athleteLimit}
                slug={racha.slug}
                whatsappGroupUrl={racha.whatsappGroupUrl}
              />
            </div>
          </Card>
        </div>

        <EnrollmentManagement
          enrollments={racha.enrollments}
          modality={racha.modality}
          rachaId={racha.id}
        />
      </section>
    </div>
  );
}
