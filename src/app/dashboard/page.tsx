import { redirect } from "next/navigation";
import { ParticipantStatus, Prisma } from "@prisma/client";
import { auth } from "@/auth";
import {
  updateOrganizerDataSettingsAction,
  updateOrganizerPixSettingsAction,
} from "@/actions";
import { AllAthletesListModal } from "@/components/all-athletes-list-modal";
import { ConfirmedListModal } from "@/components/confirmed-list-modal";
import { DeleteRachaDialog } from "@/components/delete-racha-dialog";
import { EmptyState } from "@/components/empty-state";
import { FlashMessage } from "@/components/flash-message";
import { PageActionFeedbackController } from "@/components/page-action-feedback-controller";
import { PendingPaymentsModal } from "@/components/pending-payments-modal";
import { NewRachaTypeDialog } from "@/components/new-racha-type-dialog";
import { AddUserDialog } from "@/components/add-user-dialog";
import { DashboardRachaList } from "@/components/dashboard-racha-list";
import { ShareRachaButton } from "@/components/share-racha-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { SubmitButton } from "@/components/submit-button";
import { modalityLabels } from "@/lib/constants";
import {
  isAwaitingPaymentEnrollment,
  isConfirmedEnrollment,
  isGoalkeeperEnrollment,
  isVisibleEnrollment,
} from "@/lib/enrollment";
import { prisma } from "@/lib/prisma";
import { formatCurrencyFromCents, formatDateTimeShort } from "@/lib/utils";

type SearchParams = Promise<{
  status?: string;
  message?: string;
  field?: string;
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
  const supportsPixBankName = Boolean(
    userModel?.fields.some((field) => field.name === "pixBankName"),
  );
  const supportsPixHolderName = Boolean(
    userModel?.fields.some((field) => field.name === "pixHolderName"),
  );
  const supportsRachaAdminModel = Boolean(
    Prisma.dmmf.datamodel.models.some((model) => model.name === "RachaAdmin"),
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

  if (supportsPixBankName) {
    organizerSelect.pixBankName = true;
  }

  if (supportsPixHolderName) {
    organizerSelect.pixHolderName = true;
  }

  const organizerProfile = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: organizerSelect,
  });

  if (!organizerProfile) {
    redirect("/auth/signin?callbackUrl=/dashboard");
  }

  const organizerNickname =
    typeof organizerProfile.nickname === "string"
      ? organizerProfile.nickname
      : "";
  const organizerName =
    typeof organizerProfile.name === "string" ? organizerProfile.name : "";
  const organizerPhone =
    typeof organizerProfile.phone === "string" ? organizerProfile.phone : "";
  const organizerPixKey =
    typeof organizerProfile.pixKey === "string" ? organizerProfile.pixKey : "";
  const organizerPixBankName =
    typeof organizerProfile.pixBankName === "string"
      ? organizerProfile.pixBankName
      : "";
  const organizerPixHolderName =
    typeof organizerProfile.pixHolderName === "string"
      ? organizerProfile.pixHolderName
      : "";
  const organizerEmail =
    typeof organizerProfile.email === "string" ? organizerProfile.email : "";

  const adminRachaLinks = supportsRachaAdminModel
    ? await prisma.rachaAdmin.findMany({
        where: {
          userId: session.user.id,
        },
        select: {
          rachaId: true,
        },
      })
    : [];
  const adminRachaIds = adminRachaLinks.map((item) => item.rachaId);
  const adminRachaIdSet = new Set(adminRachaIds);

  const rachas = await prisma.racha.findMany({
    where: {
      OR: [
        { organizerId: session.user.id },
        ...(adminRachaIds.length > 0 ? [{ id: { in: adminRachaIds } }] : []),
      ],
    },
    include: {
      enrollments: {
        include: {
          user: { select: { nickname: true } },
        },
      },
    },
    orderBy: [{ eventDate: "desc" }],
  });

  const confirmedParticipants = rachas.reduce(
    (total, racha) =>
      total +
      racha.enrollments.filter(
        (item) =>
          isConfirmedEnrollment(item, racha.priceInCents) &&
          !isGoalkeeperEnrollment(item),
      ).length,
    0,
  );
  const pendingParticipants = rachas.reduce(
    (total, racha) =>
      total +
      racha.enrollments.filter((item) =>
        isAwaitingPaymentEnrollment(item, racha.priceInCents),
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
    <div
      className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8"
      id="dashboard-page"
    >
      <PageActionFeedbackController
        field={params.field}
        scopeId="dashboard-page"
        status={params.status}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">
            Painel do organizador
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">
            Controle seus rachas, atletas, PIX e reembolsos.
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AddUserDialog />
          <NewRachaTypeDialog />
        </div>
      </div>

      <FlashMessage status={params.status} message={params.message} />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-950">
              Configurações de dados
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Defina os dados padrão do organizador usados nos próximos rachas.
            </p>
          </div>

          <form
            action={updateOrganizerDataSettingsAction}
            className="grid gap-4 md:grid-cols-2"
          >
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Nome completo
              <Input defaultValue={organizerName} disabled readOnly />
            </label>

            <label className="space-y-2 text-sm font-medium text-slate-700">
              Apelido (opcional)
              <Input
                defaultValue={organizerNickname}
                name="nickname"
                placeholder={organizerName || "Seu apelido"}
              />
            </label>

            <label className="space-y-2 text-sm font-medium text-slate-700">
              Telefone
              <PhoneInput
                defaultValue={organizerPhone}
                name="phone"
                placeholder="99 9 9999-9999"
              />
            </label>

            <label className="space-y-2 text-sm font-medium text-slate-700">
              E-mail da conta
              <Input defaultValue={organizerEmail} disabled readOnly />
            </label>

            <div className="md:col-span-2">
              <SubmitButton pendingLabel="Salvando...">
                Salvar dados
              </SubmitButton>
            </div>
          </form>
        </Card>

        <Card className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-950">
              Configuração de PIX
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Esses dados serão usados automaticamente nos rachas publicados.
            </p>
          </div>

          <form
            action={updateOrganizerPixSettingsAction}
            className="grid gap-4"
          >
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Chave PIX
              <Input
                defaultValue={organizerPixKey}
                name="pixKey"
                placeholder="CPF, e-mail, telefone ou chave aleatória"
              />
            </label>

            <label className="space-y-2 text-sm font-medium text-slate-700">
              Nome do banco
              <Input
                defaultValue={organizerPixBankName}
                name="pixBankName"
                placeholder="Ex.: Nubank, Inter, Caixa"
              />
            </label>

            <label className="space-y-2 text-sm font-medium text-slate-700">
              Nome completo do titular
              <Input
                defaultValue={organizerPixHolderName}
                name="pixHolderName"
                placeholder="Nome igual ao cadastro da conta"
              />
            </label>

            <div>
              <SubmitButton pendingLabel="Salvando...">Salvar PIX</SubmitButton>
            </div>
          </form>
        </Card>
      </div>

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

      <DashboardRachaList
        adminRachaIds={adminRachaIds}
        currentUserId={session.user.id}
        rachas={rachas}
      />
    </div>
  );
}
