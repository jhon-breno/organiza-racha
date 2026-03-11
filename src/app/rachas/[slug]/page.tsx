import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { MessageCircleIcon, Users } from "lucide-react";
import { auth } from "@/auth";
import { FlashMessage } from "@/components/flash-message";
import { JoinRachaForm } from "@/components/join-racha-form";
import { MapPreview } from "@/components/map-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  futebolTypeLabels,
  modalityLabels,
  participantStatusLabels,
  paymentStatusLabels,
  voleiTypeLabels,
} from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import {
  formatCurrencyFromCents,
  formatDateTime,
  getPrivateRachaAccessCookieName,
  getRachaCoverImageUrl,
  getInitials,
} from "@/lib/utils";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ status?: string; message?: string }>;

export default async function RachaDetailsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const session = await auth();

  const racha = await prisma.racha.findUnique({
    where: { slug },
    include: {
      organizer: {
        select: {
          image: true,
          name: true,
        },
      },
      enrollments: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  if (!racha) {
    notFound();
  }

  const cookieStore = await cookies();
  const hasPrivateAccess =
    racha.visibility !== "PRIVATE" ||
    cookieStore.get(getPrivateRachaAccessCookieName(racha.id))?.value ===
      "granted";

  const myEnrollment = session?.user?.id
    ? racha.enrollments.find((item) => item.userId === session.user.id)
    : null;
  const confirmedParticipants = racha.enrollments.filter(
    (item) => item.status === "ACTIVE",
  );
  const coverImageUrl = getRachaCoverImageUrl(
    racha.modality,
    racha.coverImageUrl,
  );
  const organizerAvatarUrl =
    racha.profileImageUrl || racha.organizer.image || null;
  const organizerDisplayName =
    racha.organizerDisplayName || racha.organizer.name || "Organizador";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <div
        className="overflow-hidden rounded-4xl border border-slate-200 bg-slate-900 text-white"
        style={{
          backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.45), rgba(15, 23, 42, 0.75)), url(${coverImageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="grid gap-8 px-6 py-10 lg:grid-cols-[1.2fr_0.8fr] lg:px-10">
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-white/15 text-white ring-1 ring-white/20">
                {modalityLabels[racha.modality] ?? racha.modality}
              </Badge>
              {racha.modality === "FUTEBOL" && racha.futebolType ? (
                <Badge className="bg-white/15 text-white ring-1 ring-white/20">
                  {futebolTypeLabels[racha.futebolType] ?? racha.futebolType}
                </Badge>
              ) : null}
              {racha.modality === "VOLEI" && racha.voleiType ? (
                <Badge className="bg-white/15 text-white ring-1 ring-white/20">
                  {voleiTypeLabels[racha.voleiType] ?? racha.voleiType}
                </Badge>
              ) : null}
              <Badge className="bg-white/15 text-white ring-1 ring-white/20">
                {racha.visibility === "PRIVATE" ? "Privado" : "Aberto"}
              </Badge>
            </div>

            <div className="space-y-3">
              <h1 className="text-4xl font-black tracking-tight">
                {racha.title}
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-white/80">
                {racha.description ||
                  "Racha esportivo com gestão centralizada, inscrições controladas e comunicação simplificada."}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Card className="border-white/10 bg-white/10 p-4 text-white shadow-none">
                <p className="text-xs uppercase tracking-[0.18em] text-white/60">
                  Data
                </p>
                <p className="mt-2 text-sm font-semibold">
                  {formatDateTime(racha.eventDate)}
                </p>
              </Card>
              <Card className="border-white/10 bg-white/10 p-4 text-white shadow-none">
                <p className="text-xs uppercase tracking-[0.18em] text-white/60">
                  Local
                </p>
                <p className="mt-2 text-sm font-semibold">
                  {racha.locationName}
                </p>
              </Card>
              <Card className="border-white/10 bg-white/10 p-4 text-white shadow-none">
                <p className="text-xs uppercase tracking-[0.18em] text-white/60">
                  Valor
                </p>
                <p className="mt-2 text-sm font-semibold">
                  {formatCurrencyFromCents(racha.priceInCents)}
                </p>
              </Card>
              <Card className="border-white/10 bg-white/10 p-4 text-white shadow-none">
                <p className="text-xs uppercase tracking-[0.18em] text-white/60">
                  Vagas
                </p>
                <p className="mt-2 text-sm font-semibold">
                  {confirmedParticipants.length}/{racha.athleteLimit}
                </p>
                {racha.modality === "FUTEBOL" && racha.goalkeeperLimit ? (
                  <p className="mt-1 text-xs text-white/70">
                    {racha.goalkeeperLimit}{" "}
                    {racha.goalkeeperLimit === 1 ? "goleiro" : "goleiros"}{" "}
                    vaga(s)
                  </p>
                ) : null}
                {racha.modality === "VOLEI" &&
                racha.hasFixedSetter &&
                racha.setterLimit ? (
                  <p className="mt-1 text-xs text-white/70">
                    {racha.setterLimit} levantador(es) fixo(s)
                  </p>
                ) : null}
              </Card>
            </div>
          </div>

          <Card className="space-y-4 bg-white/95">
            <div className="flex items-center gap-4">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-600 text-xl font-black text-white"
                style={
                  organizerAvatarUrl
                    ? {
                        backgroundImage: `url(${organizerAvatarUrl})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : undefined
                }
              >
                {organizerAvatarUrl ? "" : getInitials(organizerDisplayName)}
              </div>
              <div>
                <p className="text-sm text-slate-500">Organizador</p>
                <p className="text-lg font-bold text-slate-950">
                  {organizerDisplayName}
                </p>
                <p className="text-sm text-slate-600">
                  WhatsApp: {racha.phoneWhatsapp}
                </p>
              </div>
            </div>

            <div className="grid gap-3">
              <Button
                asChild
                href={`https://wa.me/${racha.phoneWhatsapp.replace(/\D/g, "")}`}
                rel="noopener noreferrer"
                target="_blank"
                variant="outline"
              >
                <>
                  <MessageCircleIcon className="h-4 w-4 text-green-500" />
                  Falar com Organizador
                </>
              </Button>
              {hasPrivateAccess && racha.whatsappGroupUrl ? (
                <Button
                  asChild
                  href={racha.whatsappGroupUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                  variant="secondary"
                >
                  <>
                    <Users className="h-4 w-4 text-green-500" />
                    Grupo WhatsApp
                  </>
                </Button>
              ) : null}
            </div>
          </Card>
        </div>
      </div>

      <FlashMessage status={query.status} message={query.message} />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Card className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-950">
              Regras do racha
            </h2>
            <p className="whitespace-pre-line text-sm leading-7 text-slate-700">
              {racha.rules}
            </p>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-950">Localização</h2>
            <p className="text-sm text-slate-600">
              {racha.locationName} • {racha.address} • {racha.city}
              {racha.state ? `/${racha.state}` : ""}
            </p>
            <MapPreview query={racha.mapsQuery} title={racha.title} />
          </Card>

          {hasPrivateAccess ? (
            <Card className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-950">Atletas</h2>
                  <p className="text-sm text-slate-600">
                    Participantes inscritos e status atual.
                  </p>
                </div>
                <Badge>{confirmedParticipants.length} confirmados</Badge>
              </div>

              <div className="grid gap-3">
                {racha.enrollments.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Ainda não há participantes inscritos.
                  </p>
                ) : (
                  racha.enrollments.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex flex-col gap-2 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-semibold text-slate-950">
                          {participant.participantName}
                        </p>
                        <p className="text-sm text-slate-600">
                          {participant.participantPosition} •{" "}
                          {participant.participantPhone}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge>
                          {participantStatusLabels[participant.status] ??
                            participant.status}
                        </Badge>
                        <Badge className="bg-slate-100 text-slate-700">
                          {paymentStatusLabels[participant.paymentStatus] ??
                            participant.paymentStatus}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          {myEnrollment ? (
            <Card className="space-y-4 border-emerald-200 bg-emerald-50">
              <h2 className="text-2xl font-bold text-emerald-900">
                Você já está neste racha
              </h2>
              <p className="text-sm leading-6 text-emerald-800">
                Status:{" "}
                {participantStatusLabels[myEnrollment.status] ??
                  myEnrollment.status}{" "}
                • Pagamento:{" "}
                {paymentStatusLabels[myEnrollment.paymentStatus] ??
                  myEnrollment.paymentStatus}
              </p>
              <Button asChild href="/minhas-inscricoes" variant="outline">
                Ver minhas inscrições
              </Button>
            </Card>
          ) : (
            <JoinRachaForm
              privateAccessGranted={hasPrivateAccess}
              racha={racha}
              sessionUser={session?.user}
            />
          )}

          <Card className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-950">
              Política de desistência
            </h2>
            <p className="text-sm leading-7 text-slate-600">
              O organizador definiu {racha.cancellationWindowHours} hora(s)
              antes do início como prazo para cancelar presença e solicitar
              reembolso.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
