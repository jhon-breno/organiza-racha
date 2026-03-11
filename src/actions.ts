"use server";

import { PaymentStatus, ParticipantStatus, Visibility } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth, isGoogleConfigured, signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  combineDateAndTime,
  demoAccessSchema,
  enrollmentSchema,
  rachaFormSchema,
} from "@/lib/validations";
import {
  buildMessageUrl,
  getPrivateRachaAccessCookieName,
  slugify,
} from "@/lib/utils";

function getStringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getFirstIssueFieldName(issues: { path: PropertyKey[] }[]) {
  const firstPathEntry = issues[0]?.path?.[0];
  return typeof firstPathEntry === "string" ? firstPathEntry : undefined;
}

type ValidatePrivateAccessKeyState = {
  success: boolean;
  message?: string;
};

export async function validatePrivateAccessKeyAction(
  _previousState: ValidatePrivateAccessKeyState,
  formData: FormData,
): Promise<ValidatePrivateAccessKeyState> {
  const rachaId = getStringValue(formData, "rachaId");
  const accessKey = getStringValue(formData, "accessKey");

  if (!rachaId) {
    return {
      success: false,
      message: "Racha não encontrado.",
    };
  }

  if (!accessKey) {
    return {
      success: false,
      message: "Informe a chave secreta para continuar.",
    };
  }

  const racha = await prisma.racha.findUnique({
    where: { id: rachaId },
    select: { accessKey: true, visibility: true },
  });

  if (!racha) {
    return {
      success: false,
      message: "Racha não encontrado.",
    };
  }

  if (racha.visibility !== Visibility.PRIVATE) {
    return { success: true };
  }

  if (!racha.accessKey || accessKey !== racha.accessKey) {
    return {
      success: false,
      message: "Chave secreta inválida.",
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(getPrivateRachaAccessCookieName(rachaId), "granted", {
    httpOnly: true,
    maxAge: 60 * 60 * 12,
    path: "/",
    sameSite: "lax",
  });

  return { success: true };
}

async function requireUser(callbackUrl?: string) {
  const session = await auth();

  if (!session?.user?.id) {
    const target = callbackUrl
      ? `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : "/auth/signin";

    redirect(target);
  }

  return session.user;
}

async function generateUniqueSlug(title: string, currentId?: string) {
  const baseSlug = slugify(title);
  let finalSlug = baseSlug;
  let suffix = 1;

  while (true) {
    const found = await prisma.racha.findFirst({
      where: {
        slug: finalSlug,
        ...(currentId ? { NOT: { id: currentId } } : {}),
      },
      select: { id: true },
    });

    if (!found) {
      return finalSlug;
    }

    suffix += 1;
    finalSlug = `${baseSlug}-${suffix}`;
  }
}

export async function signInWithGoogleAction(formData: FormData) {
  const callbackUrl = getStringValue(formData, "callbackUrl") || "/";

  if (!isGoogleConfigured) {
    redirect(
      buildMessageUrl(
        `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`,
        "error",
        "Configure AUTH_GOOGLE_ID e AUTH_GOOGLE_SECRET para ativar o Google Login.",
      ),
    );
  }

  await signIn("google", { redirectTo: callbackUrl });
}

export async function demoAccessAction(formData: FormData) {
  const parsed = demoAccessSchema.safeParse({
    name: getStringValue(formData, "name"),
    email: getStringValue(formData, "email"),
    callbackUrl: getStringValue(formData, "callbackUrl"),
  });

  if (!parsed.success) {
    redirect(
      buildMessageUrl(
        "/auth/signin",
        "error",
        parsed.error.issues[0]?.message ??
          "Não foi possível entrar no modo demo.",
      ),
    );
  }

  await signIn("credentials", {
    name: parsed.data.name,
    email: parsed.data.email,
    callbackUrl: parsed.data.callbackUrl,
    redirectTo: parsed.data.callbackUrl || "/",
  });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

export async function createRachaAction(formData: FormData) {
  const user = await requireUser("/dashboard/rachas/new");

  const parsed = rachaFormSchema.safeParse({
    title: getStringValue(formData, "title"),
    modality: getStringValue(formData, "modality"),
    description: getStringValue(formData, "description"),
    rules: getStringValue(formData, "rules"),
    athleteLimit: getStringValue(formData, "athleteLimit"),
    eventDate: getStringValue(formData, "eventDate"),
    eventTime: getStringValue(formData, "eventTime"),
    locationName: getStringValue(formData, "locationName"),
    address: getStringValue(formData, "address"),
    city: getStringValue(formData, "city"),
    state: getStringValue(formData, "state"),
    mapsQuery: getStringValue(formData, "mapsQuery"),
    price: getStringValue(formData, "price"),
    organizerDisplayName: getStringValue(formData, "organizerDisplayName"),
    phoneWhatsapp: getStringValue(formData, "phoneWhatsapp"),
    whatsappGroupUrl: getStringValue(formData, "whatsappGroupUrl"),
    pixKey: getStringValue(formData, "pixKey"),
    coverImageUrl: getStringValue(formData, "coverImageUrl"),
    profileImageUrl: getStringValue(formData, "profileImageUrl"),
    visibility: getStringValue(formData, "visibility") || "OPEN",
    accessKey: getStringValue(formData, "accessKey"),
    cancellationWindowHours: getStringValue(
      formData,
      "cancellationWindowHours",
    ),
    futebolType: getStringValue(formData, "futebolType"),
    goalkeeperLimit: getStringValue(formData, "goalkeeperLimit"),
    voleiType: getStringValue(formData, "voleiType"),
    hasFixedSetter: formData.get("hasFixedSetter") === "true",
    setterLimit: getStringValue(formData, "setterLimit"),
  });

  if (!parsed.success) {
    const field = getFirstIssueFieldName(parsed.error.issues);
    redirect(
      buildMessageUrl(
        "/dashboard/rachas/new",
        "error",
        parsed.error.issues[0]?.message ?? "Não foi possível criar o racha.",
        { field },
      ),
    );
  }

  const eventDate = combineDateAndTime(
    parsed.data.eventDate,
    parsed.data.eventTime,
  );
  const slug = await generateUniqueSlug(parsed.data.title);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      phone: parsed.data.phoneWhatsapp,
      name: user.name ?? parsed.data.organizerDisplayName,
    },
  });

  await prisma.racha.create({
    data: {
      slug,
      title: parsed.data.title,
      modality: parsed.data.modality as never,
      description: parsed.data.description || null,
      rules: parsed.data.rules,
      athleteLimit: parsed.data.athleteLimit,
      eventDate,
      locationName: parsed.data.locationName,
      address: parsed.data.address,
      city: parsed.data.city,
      state: parsed.data.state || null,
      mapsQuery:
        parsed.data.mapsQuery ||
        `${parsed.data.locationName}, ${parsed.data.address}, ${parsed.data.city}`,
      priceInCents: Math.round(parsed.data.price * 100),
      organizerDisplayName: parsed.data.organizerDisplayName,
      phoneWhatsapp: parsed.data.phoneWhatsapp,
      whatsappGroupUrl: parsed.data.whatsappGroupUrl || null,
      pixKey: parsed.data.pixKey,
      coverImageUrl: parsed.data.coverImageUrl || null,
      profileImageUrl: parsed.data.profileImageUrl || user.image || null,
      visibility: parsed.data.visibility,
      accessKey:
        parsed.data.visibility === Visibility.PRIVATE
          ? parsed.data.accessKey || null
          : null,
      cancellationWindowHours: parsed.data.cancellationWindowHours,
      futebolType: parsed.data.futebolType || null,
      goalkeeperLimit: parsed.data.goalkeeperLimit || null,
      voleiType: parsed.data.voleiType || null,
      hasFixedSetter: parsed.data.hasFixedSetter ?? false,
      setterLimit: parsed.data.setterLimit || null,
      organizerId: user.id,
    },
  });

  revalidatePath("/");
  revalidatePath("/dashboard");

  redirect(
    buildMessageUrl("/dashboard", "success", "Racha criado com sucesso."),
  );
}

export async function updateRachaAction(formData: FormData) {
  const user = await requireUser("/dashboard");
  const id = getStringValue(formData, "id");

  const existing = await prisma.racha.findUnique({ where: { id } });

  if (!existing || existing.organizerId !== user.id) {
    redirect(buildMessageUrl("/dashboard", "error", "Racha não encontrado."));
  }

  const parsed = rachaFormSchema.safeParse({
    id,
    title: getStringValue(formData, "title"),
    modality: getStringValue(formData, "modality"),
    description: getStringValue(formData, "description"),
    rules: getStringValue(formData, "rules"),
    athleteLimit: getStringValue(formData, "athleteLimit"),
    eventDate: getStringValue(formData, "eventDate"),
    eventTime: getStringValue(formData, "eventTime"),
    locationName: getStringValue(formData, "locationName"),
    address: getStringValue(formData, "address"),
    city: getStringValue(formData, "city"),
    state: getStringValue(formData, "state"),
    mapsQuery: getStringValue(formData, "mapsQuery"),
    price: getStringValue(formData, "price"),
    organizerDisplayName: getStringValue(formData, "organizerDisplayName"),
    phoneWhatsapp: getStringValue(formData, "phoneWhatsapp"),
    whatsappGroupUrl: getStringValue(formData, "whatsappGroupUrl"),
    pixKey: getStringValue(formData, "pixKey"),
    coverImageUrl: getStringValue(formData, "coverImageUrl"),
    profileImageUrl: getStringValue(formData, "profileImageUrl"),
    visibility: getStringValue(formData, "visibility") || "OPEN",
    accessKey: getStringValue(formData, "accessKey"),
    cancellationWindowHours: getStringValue(
      formData,
      "cancellationWindowHours",
    ),
    futebolType: getStringValue(formData, "futebolType"),
    goalkeeperLimit: getStringValue(formData, "goalkeeperLimit"),
    voleiType: getStringValue(formData, "voleiType"),
    hasFixedSetter: formData.get("hasFixedSetter") === "true",
    setterLimit: getStringValue(formData, "setterLimit"),
  });

  if (!parsed.success) {
    const field = getFirstIssueFieldName(parsed.error.issues);
    redirect(
      buildMessageUrl(
        `/dashboard/rachas/${id}/edit`,
        "error",
        parsed.error.issues[0]?.message ??
          "Não foi possível atualizar o racha.",
        { field },
      ),
    );
  }

  const eventDate = combineDateAndTime(
    parsed.data.eventDate,
    parsed.data.eventTime,
  );
  const slug = await generateUniqueSlug(parsed.data.title, id);

  await prisma.racha.update({
    where: { id },
    data: {
      slug,
      title: parsed.data.title,
      modality: parsed.data.modality as never,
      description: parsed.data.description || null,
      rules: parsed.data.rules,
      athleteLimit: parsed.data.athleteLimit,
      eventDate,
      locationName: parsed.data.locationName,
      address: parsed.data.address,
      city: parsed.data.city,
      state: parsed.data.state || null,
      mapsQuery:
        parsed.data.mapsQuery ||
        `${parsed.data.locationName}, ${parsed.data.address}, ${parsed.data.city}`,
      priceInCents: Math.round(parsed.data.price * 100),
      organizerDisplayName: parsed.data.organizerDisplayName,
      phoneWhatsapp: parsed.data.phoneWhatsapp,
      whatsappGroupUrl: parsed.data.whatsappGroupUrl || null,
      pixKey: parsed.data.pixKey,
      coverImageUrl: parsed.data.coverImageUrl || null,
      profileImageUrl: parsed.data.profileImageUrl || user.image || null,
      visibility: parsed.data.visibility,
      accessKey:
        parsed.data.visibility === Visibility.PRIVATE
          ? parsed.data.accessKey || null
          : null,
      cancellationWindowHours: parsed.data.cancellationWindowHours,
      futebolType: parsed.data.futebolType || null,
      goalkeeperLimit: parsed.data.goalkeeperLimit || null,
      voleiType: parsed.data.voleiType || null,
      hasFixedSetter: parsed.data.hasFixedSetter ?? false,
      setterLimit: parsed.data.setterLimit || null,
    },
  });

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath(`/rachas/${slug}`);
  revalidatePath(`/dashboard/rachas/${id}/edit`);

  redirect(
    buildMessageUrl(
      `/dashboard/rachas/${id}/edit`,
      "success",
      "Racha atualizado com sucesso.",
    ),
  );
}

export async function deleteRachaAction(formData: FormData) {
  const user = await requireUser("/dashboard");
  const id = getStringValue(formData, "id");

  const existing = await prisma.racha.findUnique({ where: { id } });

  if (!existing || existing.organizerId !== user.id) {
    redirect(buildMessageUrl("/dashboard", "error", "Racha não encontrado."));
  }

  await prisma.racha.delete({ where: { id } });

  revalidatePath("/");
  revalidatePath("/dashboard");
  redirect(
    buildMessageUrl("/dashboard", "success", "Racha removido com sucesso."),
  );
}

export async function joinRachaAction(formData: FormData) {
  const slug = getStringValue(formData, "slug");
  const callbackUrl = `/rachas/${slug}`;
  const user = await requireUser(callbackUrl);
  const rachaId = getStringValue(formData, "rachaId");

  const parsed = enrollmentSchema.safeParse({
    rachaId,
    slug,
    participantName: getStringValue(formData, "participantName"),
    participantPhone: getStringValue(formData, "participantPhone"),
    participantPosition: getStringValue(formData, "participantPosition"),
    participantLevel: getStringValue(formData, "participantLevel"),
    notes: getStringValue(formData, "notes"),
    acceptedRules: formData.get("acceptedRules") === "on",
    pixPaid: formData.get("pixPaid") === "on",
    accessKey: getStringValue(formData, "accessKey"),
  });

  if (!parsed.success) {
    redirect(
      buildMessageUrl(
        callbackUrl,
        "error",
        parsed.error.issues[0]?.message ??
          "Não foi possível concluir sua inscrição.",
      ),
    );
  }

  const racha = await prisma.racha.findUnique({ where: { id: rachaId } });

  if (!racha) {
    redirect(buildMessageUrl("/", "error", "Racha não encontrado."));
  }

  const cookieStore = await cookies();
  const hasPrivateAccessCookie =
    cookieStore.get(getPrivateRachaAccessCookieName(rachaId))?.value ===
    "granted";

  if (
    racha.visibility === Visibility.PRIVATE &&
    !hasPrivateAccessCookie &&
    parsed.data.accessKey !== racha.accessKey
  ) {
    redirect(buildMessageUrl(callbackUrl, "error", "Chave secreta inválida."));
  }

  if (racha.eventDate <= new Date()) {
    redirect(
      buildMessageUrl(
        callbackUrl,
        "error",
        "Este racha já aconteceu ou foi encerrado.",
      ),
    );
  }

  // Validação de vagas por posição específica
  if (
    racha.modality === "FUTEBOL" &&
    parsed.data.participantPosition === "Goleiro" &&
    racha.goalkeeperLimit
  ) {
    const goalkeeperCount = await prisma.enrollment.count({
      where: {
        rachaId,
        status: ParticipantStatus.ACTIVE,
        participantPosition: "Goleiro",
      },
    });
    if (goalkeeperCount >= racha.goalkeeperLimit) {
      redirect(
        buildMessageUrl(
          callbackUrl,
          "error",
          "Não há mais vagas para goleiro. Selecione uma posição de linha.",
        ),
      );
    }
  }

  if (
    racha.modality === "VOLEI" &&
    parsed.data.participantPosition === "Levantador" &&
    racha.hasFixedSetter &&
    racha.setterLimit
  ) {
    const setterCount = await prisma.enrollment.count({
      where: {
        rachaId,
        status: ParticipantStatus.ACTIVE,
        participantPosition: "Levantador",
      },
    });
    if (setterCount >= racha.setterLimit) {
      redirect(
        buildMessageUrl(
          callbackUrl,
          "error",
          "Não há mais vagas de levantador fixo. Selecione outra posição.",
        ),
      );
    }
  }

  const existing = await prisma.enrollment.findUnique({
    where: {
      rachaId_userId: {
        rachaId,
        userId: user.id,
      },
    },
  });

  if (existing && existing.status !== ParticipantStatus.CANCELED) {
    redirect(
      buildMessageUrl(
        callbackUrl,
        "error",
        "Você já está inscrito neste racha.",
      ),
    );
  }

  const confirmedCount = await prisma.enrollment.count({
    where: {
      rachaId,
      status: ParticipantStatus.ACTIVE,
    },
  });

  const nextStatus =
    confirmedCount >= racha.athleteLimit
      ? ParticipantStatus.WAITLIST
      : ParticipantStatus.ACTIVE;

  if (existing) {
    await prisma.enrollment.update({
      where: { id: existing.id },
      data: {
        participantName: parsed.data.participantName,
        participantPhone: parsed.data.participantPhone,
        participantPosition: parsed.data.participantPosition,
        participantLevel: parsed.data.participantLevel,
        acceptedRules: true,
        pixPaid: true,
        notes: parsed.data.notes || null,
        status: nextStatus,
        paymentStatus: PaymentStatus.PROOF_SENT,
        canceledAt: null,
        refundRequestedAt: null,
      },
    });
  } else {
    await prisma.enrollment.create({
      data: {
        rachaId,
        userId: user.id,
        participantName: parsed.data.participantName,
        participantPhone: parsed.data.participantPhone,
        participantPosition: parsed.data.participantPosition,
        participantLevel: parsed.data.participantLevel,
        acceptedRules: true,
        pixPaid: true,
        notes: parsed.data.notes || null,
        status: nextStatus,
        paymentStatus: PaymentStatus.PROOF_SENT,
      },
    });
  }

  revalidatePath(callbackUrl);
  revalidatePath("/minhas-inscricoes");
  revalidatePath("/dashboard");

  redirect(
    buildMessageUrl(
      callbackUrl,
      "success",
      nextStatus === ParticipantStatus.WAITLIST
        ? "Você entrou na lista de espera. O organizador poderá te chamar se surgir vaga."
        : "Inscrição registrada com sucesso.",
    ),
  );
}

export async function cancelEnrollmentAction(formData: FormData) {
  const user = await requireUser("/minhas-inscricoes");
  const enrollmentId = getStringValue(formData, "enrollmentId");

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { racha: true },
  });

  if (!enrollment || enrollment.userId !== user.id) {
    redirect(
      buildMessageUrl(
        "/minhas-inscricoes",
        "error",
        "Inscrição não encontrada para cancelamento.",
      ),
    );
  }

  const deadline = new Date(
    enrollment.racha.eventDate.getTime() -
      enrollment.racha.cancellationWindowHours * 60 * 60 * 1000,
  );

  if (new Date() > deadline) {
    redirect(
      buildMessageUrl(
        "/minhas-inscricoes",
        "error",
        "O prazo para desistência já expirou.",
      ),
    );
  }

  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: {
      status: ParticipantStatus.CANCELED,
      paymentStatus: PaymentStatus.REFUND_REQUESTED,
      canceledAt: new Date(),
      refundRequestedAt: new Date(),
    },
  });

  revalidatePath("/minhas-inscricoes");
  revalidatePath(`/rachas/${enrollment.racha.slug}`);
  revalidatePath(`/dashboard/rachas/${enrollment.rachaId}/edit`);

  redirect(
    buildMessageUrl(
      "/minhas-inscricoes",
      "success",
      "Desistência registrada e pedido de reembolso enviado ao organizador.",
    ),
  );
}

export async function confirmEnrollmentPaymentAction(formData: FormData) {
  const user = await requireUser("/dashboard");
  const enrollmentId = getStringValue(formData, "enrollmentId");

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { racha: true },
  });

  if (!enrollment || enrollment.racha.organizerId !== user.id) {
    redirect(
      buildMessageUrl("/dashboard", "error", "Participante não encontrado."),
    );
  }

  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: {
      paymentStatus: PaymentStatus.PAID,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/rachas/${enrollment.rachaId}/edit`);
  redirect(
    buildMessageUrl(
      `/dashboard/rachas/${enrollment.rachaId}/edit`,
      "success",
      "Pagamento confirmado.",
    ),
  );
}

export async function markEnrollmentRefundedAction(formData: FormData) {
  const user = await requireUser("/dashboard");
  const enrollmentId = getStringValue(formData, "enrollmentId");

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { racha: true },
  });

  if (!enrollment || enrollment.racha.organizerId !== user.id) {
    redirect(
      buildMessageUrl("/dashboard", "error", "Participante não encontrado."),
    );
  }

  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: {
      paymentStatus: PaymentStatus.REFUNDED,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/rachas/${enrollment.rachaId}/edit`);
  redirect(
    buildMessageUrl(
      `/dashboard/rachas/${enrollment.rachaId}/edit`,
      "success",
      "Reembolso marcado como concluído.",
    ),
  );
}
