"use client";

import { useState } from "react";
import { Enrollment, ParticipantStatus, Racha } from "@prisma/client";

type EnrollmentWithNickname = Enrollment & {
  user: { nickname: string | null };
};
import { AllAthletesListModal } from "@/components/all-athletes-list-modal";
import { ConfirmedListModal } from "@/components/confirmed-list-modal";
import { DeleteRachaDialog } from "@/components/delete-racha-dialog";
import { EmptyState } from "@/components/empty-state";
import { PendingPaymentsModal } from "@/components/pending-payments-modal";
import { ShareRachaButton } from "@/components/share-racha-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { modalityLabels } from "@/lib/constants";
import {
  isAwaitingPaymentEnrollment,
  isConfirmedEnrollment,
  isGoalkeeperEnrollment,
  isVisibleEnrollment,
} from "@/lib/enrollment";
import {
  formatCurrencyFromCents,
  formatDateTimeShort,
  isRachaEnded,
} from "@/lib/utils";

type RachaWithEnrollments = Racha & {
  enrollments: EnrollmentWithNickname[];
};

type DashboardRachaListProps = {
  rachas: RachaWithEnrollments[];
  currentUserId: string;
  adminRachaIds: string[];
};

export function DashboardRachaList({
  rachas,
  currentUserId,
  adminRachaIds,
}: DashboardRachaListProps) {
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "ENDED">("ACTIVE");

  const adminRachaIdSet = new Set(adminRachaIds);

  const activeRachas = rachas.filter((racha) => !isRachaEnded(racha));
  const endedRachas = rachas.filter((racha) => isRachaEnded(racha));

  const displayedRachas = activeTab === "ACTIVE" ? activeRachas : endedRachas;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
            activeTab === "ACTIVE"
              ? "bg-teal-700 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
          }`}
          onClick={() => setActiveTab("ACTIVE")}
          type="button"
        >
          <span>Em andamento</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              activeTab === "ACTIVE"
                ? "bg-white/20 text-white"
                : "bg-slate-200 text-slate-700"
            }`}
          >
            {activeRachas.length}
          </span>
        </button>

        <button
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
            activeTab === "ENDED"
              ? "bg-teal-700 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
          }`}
          onClick={() => setActiveTab("ENDED")}
          type="button"
        >
          <span>Encerrados</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              activeTab === "ENDED"
                ? "bg-white/20 text-white"
                : "bg-slate-200 text-slate-700"
            }`}
          >
            {endedRachas.length}
          </span>
        </button>
      </div>

      {displayedRachas.length === 0 ? (
        activeTab === "ACTIVE" ? (
          <EmptyState
            actionHref="/dashboard/rachas/new"
            actionLabel="Criar novo racha"
            description="Você não possui nenhum racha em andamento no momento. Crie um novo racha para liberar inscrições."
            title="Nenhum racha em andamento"
          />
        ) : (
          <EmptyState
            actionHref="/dashboard/rachas/new"
            actionLabel="Criar racha"
            description="Rachas cuja data e horário de encerramento já passaram ficarão arquivados nesta lista."
            title="Nenhum racha encerrado"
          />
        )
      ) : (
        <div className="grid gap-6">
          {displayedRachas.map((racha) => {
            const isInvitedAdmin =
              racha.organizerId !== currentUserId &&
              adminRachaIdSet.has(racha.id);
            const confirmedEnrollments = racha.enrollments.filter((item) =>
              isConfirmedEnrollment(item, racha.priceInCents),
            );
            const confirmed = confirmedEnrollments.filter(
              (item) => !isGoalkeeperEnrollment(item),
            ).length;
            const awaitingPayment = racha.enrollments.filter((item) =>
              isAwaitingPaymentEnrollment(item, racha.priceInCents),
            ).length;
            const waitlist = racha.enrollments.filter(
              (item) => item.status === ParticipantStatus.WAITLIST,
            ).length;
            const pendingEnrollments = racha.enrollments
              .filter((item) =>
                isAwaitingPaymentEnrollment(item, racha.priceInCents),
              )
              .map((item) => ({
                id: item.id,
                participantName: item.participantName,
                participantPhone: item.participantPhone,
                paymentStatus: item.paymentStatus,
              }));
            const totalAthletes = racha.enrollments.filter(
              (item) =>
                isVisibleEnrollment(item) && !isGoalkeeperEnrollment(item),
            ).length;
            const isEnded = isRachaEnded(racha);

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
                      {isEnded ? (
                        <Badge className="bg-slate-200 text-slate-700 font-semibold">
                          Encerrado
                        </Badge>
                      ) : null}
                      {isInvitedAdmin ? (
                        <Badge className="bg-teal-100 text-teal-800">
                          Admin convidado
                        </Badge>
                      ) : null}
                      {!racha.pixKey.trim() ? (
                        <Badge className="bg-amber-100 text-amber-800">
                          Aguardando PIX
                        </Badge>
                      ) : null}
                    </div>
                    <h2 className="text-2xl font-bold text-slate-950">
                      {racha.title}
                    </h2>
                    <p className="text-sm text-slate-600">
                      {formatDateTimeShort(racha.eventDate, racha.eventEndDate)}{" "}
                      • {racha.locationName} •{" "}
                      {formatCurrencyFromCents(racha.priceInCents)}
                    </p>
                    {!racha.pixKey.trim() ? (
                      <p className="text-sm text-amber-700">
                        Configure a chave PIX do organizador para publicar este
                        racha e liberar inscricoes.
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <ShareRachaButton slug={racha.slug} title={racha.title} />
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
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-slate-500">Confirmados</p>
                        <p className="mt-1 text-2xl font-bold text-slate-950">
                          {confirmed}/{racha.athleteLimit}
                        </p>
                      </div>
                      <ConfirmedListModal
                        athleteLimit={racha.athleteLimit}
                        enrollments={confirmedEnrollments.map((item) => ({
                          id: item.id,
                          participantName: item.participantName,
                          participantNickname: item.user?.nickname ?? null,
                          participantPhone: item.participantPhone,
                          participantPosition: item.participantPosition,
                          participantLevel: item.participantLevel,
                          status: item.status,
                          paymentStatus: item.paymentStatus,
                        }))}
                        eventDate={racha.eventDate}
                        goalkeeperLimit={racha.goalkeeperLimit}
                        locationName={racha.locationName}
                        priceInCents={racha.priceInCents}
                        rachaId={racha.id}
                        rachaTitle={racha.title}
                        whatsappGroupUrl={racha.whatsappGroupUrl}
                      />
                    </div>
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
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-slate-500">Todos os atletas</p>
                        <p className="mt-1 text-2xl font-bold text-slate-950">
                          {totalAthletes}
                        </p>
                      </div>
                      <AllAthletesListModal
                        athleteLimit={racha.athleteLimit}
                        enrollments={racha.enrollments.map((item) => ({
                          id: item.id,
                          createdAt: item.createdAt,
                          participantName: item.participantName,
                          participantNickname: item.user?.nickname ?? null,
                          participantPhone: item.participantPhone,
                          participantPosition: item.participantPosition,
                          participantLevel: item.participantLevel,
                          status: item.status,
                          paymentStatus: item.paymentStatus,
                        }))}
                        eventDate={racha.eventDate}
                        goalkeeperLimit={racha.goalkeeperLimit}
                        locationName={racha.locationName}
                        rachaId={racha.id}
                        rachaTitle={racha.title}
                        slug={racha.slug}
                        whatsappGroupUrl={racha.whatsappGroupUrl}
                      />
                    </div>
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
