"use server";

import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import {
  PaymentStatus,
  ParticipantStatus,
  Prisma,
  Visibility,
} from "@prisma/client";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth, isGoogleConfigured, signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  cancelPendingEnrollmentSchema,
  combineDateAndTime,
  credentialsSignInSchema,
  enrollmentSchema,
  forgotPasswordSchema,
  organizerEnrollmentSchema,
  organizerDataSettingsSchema,
  organizerPixSettingsSchema,
  recoverIdentifierSchema,
  resetPasswordSchema,
  refundRequestSchema,
  rachaFormSchema,
  signUpSchema,
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

function supportsUserField(fieldName: string) {
  const userModel = Prisma.dmmf.datamodel.models.find(
    (model) => model.name === "User",
  );

  return Boolean(userModel?.fields.some((field) => field.name === fieldName));
}

function normalizePhoneValue(phone: string) {
  const rawDigits = phone.replace(/\D/g, "");
  const digits =
    rawDigits.length > 11 && rawDigits.startsWith("55")
      ? rawDigits.slice(2, 13)
      : rawDigits.slice(0, 11);

  return digits || phone.trim().toLowerCase();
}

function normalizeEmailValue(email: string) {
  return email.trim().toLowerCase();
}

function maskEmail(email: string) {
  const [localPart, domainPart] = email.split("@");

  if (!localPart || !domainPart) {
    return email;
  }

  const visibleLocal =
    localPart.length <= 2 ? localPart : localPart.slice(0, 2);
  return `${visibleLocal}${"*".repeat(Math.max(localPart.length - visibleLocal.length, 1))}@${domainPart}`;
}

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (digits.length <= 4) {
    return `****${digits}`;
  }

  return `${digits.slice(0, 2)}*****${digits.slice(-2)}`;
}

async function getOrganizerRachaSettings(userId: string) {
  const organizer = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      nickname: true,
      phone: true,
      pixKey: true,
    },
  });

  if (!organizer) {
    return null;
  }

  return {
    organizerDisplayName:
      organizer.nickname?.trim() || organizer.name?.trim() || "",
    phoneWhatsapp: organizer.phone?.trim() || "",
    pixKey: organizer.pixKey?.trim() || "",
  };
}

async function hasDuplicatedPhoneEnrollment(
  rachaId: string,
  phone: string,
  excludeEnrollmentId?: string,
) {
  const normalizedPhone = normalizePhoneValue(phone);

  const activeEnrollments = await prisma.enrollment.findMany({
    where: {
      rachaId,
      status: {
        not: ParticipantStatus.CANCELED,
      },
      paymentStatus: {
        not: PaymentStatus.REFUNDED,
      },
      ...(excludeEnrollmentId ? { NOT: { id: excludeEnrollmentId } } : {}),
    },
    select: {
      participantPhone: true,
    },
  });

  return activeEnrollments.some(
    (enrollment) =>
      normalizePhoneValue(enrollment.participantPhone) === normalizedPhone,
  );
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

export async function signInWithCredentialsAction(formData: FormData) {
  const callbackUrl = getStringValue(formData, "callbackUrl") || "/";
  const parsed = credentialsSignInSchema.safeParse({
    identifier: getStringValue(formData, "identifier"),
    password: getStringValue(formData, "password"),
    callbackUrl,
  });

  if (!parsed.success) {
    redirect(
      buildMessageUrl(
        `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`,
        "error",
        parsed.error.issues[0]?.message ?? "Não foi possível fazer login.",
      ),
    );
  }

  try {
    await signIn("credentials", {
      identifier: parsed.data.identifier,
      password: parsed.data.password,
      redirectTo: callbackUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(
        buildMessageUrl(
          `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`,
          "error",
          "E-mail/telefone ou senha inválidos.",
        ),
      );
    }

    throw error;
  }
}

export async function signUpWithPasswordAction(formData: FormData) {
  const callbackUrl = getStringValue(formData, "callbackUrl") || "/";
  const parsed = signUpSchema.safeParse({
    name: getStringValue(formData, "name"),
    email: getStringValue(formData, "email"),
    phone: getStringValue(formData, "phone"),
    password: getStringValue(formData, "password"),
    confirmPassword: getStringValue(formData, "confirmPassword"),
    callbackUrl,
  });

  if (!parsed.success) {
    redirect(
      buildMessageUrl(
        `/auth/signin?tab=signup&callbackUrl=${encodeURIComponent(callbackUrl)}`,
        "error",
        parsed.error.issues[0]?.message ?? "Não foi possível criar a conta.",
      ),
    );
  }

  const email = parsed.data.email
    ? normalizeEmailValue(parsed.data.email)
    : null;
  const phone = parsed.data.phone
    ? normalizePhoneValue(parsed.data.phone)
    : null;

  if (email) {
    const emailTaken = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (emailTaken) {
      redirect(
        buildMessageUrl(
          `/auth/signin?tab=signup&callbackUrl=${encodeURIComponent(callbackUrl)}`,
          "error",
          "Este e-mail já está em uso.",
        ),
      );
    }
  }

  if (phone) {
    const phoneTaken = await prisma.user.findUnique({
      where: { phone },
      select: { id: true },
    });

    if (phoneTaken) {
      redirect(
        buildMessageUrl(
          `/auth/signin?tab=signup&callbackUrl=${encodeURIComponent(callbackUrl)}`,
          "error",
          "Este telefone já está em uso.",
        ),
      );
    }
  }

  const passwordHash = await hash(parsed.data.password, 10);

  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      phone,
      passwordHash,
    },
  });

  const identifier = email ?? phone;

  if (!identifier) {
    redirect(
      buildMessageUrl(
        "/auth/signin",
        "success",
        "Conta criada com sucesso. Faça login para continuar.",
      ),
    );
  }

  try {
    await signIn("credentials", {
      identifier,
      password: parsed.data.password,
      redirectTo: callbackUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(
        buildMessageUrl(
          "/auth/signin",
          "success",
          "Conta criada com sucesso. Faça login para continuar.",
        ),
      );
    }

    throw error;
  }
}

export async function forgotPasswordAction(formData: FormData) {
  const parsed = forgotPasswordSchema.safeParse({
    identifier: getStringValue(formData, "identifier"),
  });

  if (!parsed.success) {
    redirect(
      buildMessageUrl(
        "/auth/forgot-password",
        "error",
        parsed.error.issues[0]?.message ??
          "Não foi possível iniciar a recuperação de senha.",
      ),
    );
  }

  const identifier = parsed.data.identifier.trim();
  const isEmail = identifier.includes("@");

  const user = isEmail
    ? await prisma.user.findUnique({
        where: { email: normalizeEmailValue(identifier) },
        select: { id: true },
      })
    : await prisma.user.findFirst({
        where: {
          OR: [
            { phone: identifier },
            { phone: normalizePhoneValue(identifier) },
          ],
        },
        select: { id: true },
      });

  if (!user) {
    redirect(
      buildMessageUrl(
        "/auth/forgot-password",
        "success",
        "Se o cadastro existir, as instruções de redefinição foram geradas.",
      ),
    );
  }

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: token,
      passwordResetExpires: expiresAt,
    },
  });

  redirect(
    buildMessageUrl(
      `/auth/reset-password?token=${token}`,
      "success",
      "Token de recuperação gerado. Defina sua nova senha.",
    ),
  );
}

export async function resetPasswordAction(formData: FormData) {
  const token = getStringValue(formData, "token");
  const parsed = resetPasswordSchema.safeParse({
    token,
    password: getStringValue(formData, "password"),
    confirmPassword: getStringValue(formData, "confirmPassword"),
  });

  if (!parsed.success) {
    redirect(
      buildMessageUrl(
        `/auth/reset-password?token=${encodeURIComponent(token)}`,
        "error",
        parsed.error.issues[0]?.message ??
          "Não foi possível redefinir a senha.",
      ),
    );
  }

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: parsed.data.token,
      passwordResetExpires: {
        gt: new Date(),
      },
    },
    select: { id: true },
  });

  if (!user) {
    redirect(
      buildMessageUrl(
        "/auth/forgot-password",
        "error",
        "Token inválido ou expirado. Solicite uma nova recuperação.",
      ),
    );
  }

  const passwordHash = await hash(parsed.data.password, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });

  redirect(
    buildMessageUrl(
      "/auth/signin",
      "success",
      "Senha redefinida com sucesso. Faça login para continuar.",
    ),
  );
}

export async function recoverIdentifierAction(formData: FormData) {
  const parsed = recoverIdentifierSchema.safeParse({
    name: getStringValue(formData, "name"),
    knownIdentifier: getStringValue(formData, "knownIdentifier"),
  });

  if (!parsed.success) {
    redirect(
      buildMessageUrl(
        "/auth/recover-access",
        "error",
        parsed.error.issues[0]?.message ??
          "Não foi possível recuperar seu acesso.",
      ),
    );
  }

  const knownIdentifier = parsed.data.knownIdentifier.trim();
  const isEmail = knownIdentifier.includes("@");

  const user = isEmail
    ? await prisma.user.findFirst({
        where: {
          name: {
            contains: parsed.data.name,
            mode: "insensitive",
          },
          email: normalizeEmailValue(knownIdentifier),
        },
        select: {
          email: true,
          phone: true,
        },
      })
    : await prisma.user.findFirst({
        where: {
          name: {
            contains: parsed.data.name,
            mode: "insensitive",
          },
          OR: [
            { phone: knownIdentifier },
            { phone: normalizePhoneValue(knownIdentifier) },
          ],
        },
        select: {
          email: true,
          phone: true,
        },
      });

  if (!user) {
    redirect(
      buildMessageUrl(
        "/auth/recover-access",
        "error",
        "Não encontramos um cadastro com os dados informados.",
      ),
    );
  }

  const hints: string[] = [];

  if (user.email) {
    hints.push(`E-mail: ${maskEmail(user.email)}`);
  }

  if (user.phone) {
    hints.push(`Telefone: ${maskPhone(user.phone)}`);
  }

  if (hints.length === 0) {
    redirect(
      buildMessageUrl(
        "/auth/recover-access",
        "error",
        "Encontramos o cadastro, mas não há contato disponível para recuperação.",
      ),
    );
  }

  redirect(
    buildMessageUrl(
      "/auth/signin",
      "success",
      `Encontramos seu acesso. ${hints.join(" • ")}`,
    ),
  );
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

export async function updateOrganizerDataSettingsAction(formData: FormData) {
  const user = await requireUser("/dashboard");

  const parsed = organizerDataSettingsSchema.safeParse({
    nickname: getStringValue(formData, "nickname"),
    phone: getStringValue(formData, "phone"),
    pixKey: getStringValue(formData, "pixKey"),
  });

  if (!parsed.success) {
    redirect(
      buildMessageUrl(
        "/dashboard",
        "error",
        parsed.error.issues[0]?.message ??
          "Não foi possível atualizar suas configurações.",
      ),
    );
  }

  const canUseNickname = supportsUserField("nickname");

  const updateData: Record<string, string | null> = {
    phone: parsed.data.phone ? normalizePhoneValue(parsed.data.phone) : null,
  };

  if (canUseNickname) {
    updateData.nickname = parsed.data.nickname || null;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: updateData,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/rachas/new");

  redirect(
    buildMessageUrl(
      "/dashboard",
      "success",
      "Configurações de dados atualizadas com sucesso.",
    ),
  );
}

export async function updateOrganizerPixSettingsAction(formData: FormData) {
  const user = await requireUser("/dashboard");

  const parsed = organizerPixSettingsSchema.safeParse({
    pixKey: getStringValue(formData, "pixKey"),
    pixBankName: getStringValue(formData, "pixBankName"),
    pixHolderName: getStringValue(formData, "pixHolderName"),
  });

  if (!parsed.success) {
    redirect(
      buildMessageUrl(
        "/dashboard",
        "error",
        parsed.error.issues[0]?.message ??
          "Não foi possível atualizar as configurações de PIX.",
      ),
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      pixKey: parsed.data.pixKey || null,
      pixBankName: parsed.data.pixBankName || null,
      pixHolderName: parsed.data.pixHolderName || null,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/rachas/new");

  redirect(
    buildMessageUrl(
      "/dashboard",
      "success",
      "Configurações de PIX atualizadas com sucesso.",
    ),
  );
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
    paymentDeadlineDate: getStringValue(formData, "paymentDeadlineDate"),
    paymentDeadlineTime: getStringValue(formData, "paymentDeadlineTime"),
    locationName: getStringValue(formData, "locationName"),
    address: getStringValue(formData, "address"),
    city: getStringValue(formData, "city"),
    state: getStringValue(formData, "state"),
    mapsQuery: getStringValue(formData, "mapsQuery"),
    price: getStringValue(formData, "price"),
    whatsappGroupUrl: getStringValue(formData, "whatsappGroupUrl"),
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
  const paymentDeadline =
    parsed.data.paymentDeadlineDate && parsed.data.paymentDeadlineTime
      ? combineDateAndTime(
          parsed.data.paymentDeadlineDate,
          parsed.data.paymentDeadlineTime,
        )
      : null;
  const slug = await generateUniqueSlug(parsed.data.title);
  const organizerSettings = await getOrganizerRachaSettings(user.id);

  if (
    !organizerSettings?.organizerDisplayName ||
    !organizerSettings.phoneWhatsapp ||
    !organizerSettings.pixKey
  ) {
    redirect(
      buildMessageUrl(
        "/dashboard",
        "error",
        "Antes de criar um racha, configure apelido/nome, telefone e chave PIX no painel do organizador.",
      ),
    );
  }

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
      organizerDisplayName: organizerSettings.organizerDisplayName,
      phoneWhatsapp: organizerSettings.phoneWhatsapp,
      whatsappGroupUrl: parsed.data.whatsappGroupUrl || null,
      pixKey: organizerSettings.pixKey,
      coverImageUrl: parsed.data.coverImageUrl || null,
      profileImageUrl: parsed.data.profileImageUrl || user.image || null,
      visibility: parsed.data.visibility,
      accessKey:
        parsed.data.visibility === Visibility.PRIVATE
          ? parsed.data.accessKey || null
          : null,
      cancellationWindowHours: parsed.data.cancellationWindowHours,
      paymentDeadline,
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
    paymentDeadlineDate: getStringValue(formData, "paymentDeadlineDate"),
    paymentDeadlineTime: getStringValue(formData, "paymentDeadlineTime"),
    locationName: getStringValue(formData, "locationName"),
    address: getStringValue(formData, "address"),
    city: getStringValue(formData, "city"),
    state: getStringValue(formData, "state"),
    mapsQuery: getStringValue(formData, "mapsQuery"),
    price: getStringValue(formData, "price"),
    whatsappGroupUrl: getStringValue(formData, "whatsappGroupUrl"),
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
  const paymentDeadline =
    parsed.data.paymentDeadlineDate && parsed.data.paymentDeadlineTime
      ? combineDateAndTime(
          parsed.data.paymentDeadlineDate,
          parsed.data.paymentDeadlineTime,
        )
      : null;
  const slug = await generateUniqueSlug(parsed.data.title, id);
  const organizerSettings = await getOrganizerRachaSettings(user.id);

  if (
    !organizerSettings?.organizerDisplayName ||
    !organizerSettings.phoneWhatsapp ||
    !organizerSettings.pixKey
  ) {
    redirect(
      buildMessageUrl(
        "/dashboard",
        "error",
        "Antes de atualizar um racha, configure apelido/nome, telefone e chave PIX no painel do organizador.",
      ),
    );
  }

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
      organizerDisplayName: organizerSettings.organizerDisplayName,
      phoneWhatsapp: organizerSettings.phoneWhatsapp,
      whatsappGroupUrl: parsed.data.whatsappGroupUrl || null,
      pixKey: organizerSettings.pixKey,
      coverImageUrl: parsed.data.coverImageUrl || null,
      profileImageUrl: parsed.data.profileImageUrl || user.image || null,
      visibility: parsed.data.visibility,
      accessKey:
        parsed.data.visibility === Visibility.PRIVATE
          ? parsed.data.accessKey || null
          : null,
      cancellationWindowHours: parsed.data.cancellationWindowHours,
      paymentDeadline,
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
  const confirmDelete = getStringValue(formData, "confirmDelete");

  if (confirmDelete !== "true") {
    redirect(
      buildMessageUrl(
        "/dashboard",
        "error",
        "Confirme a remoção do racha antes de continuar.",
      ),
    );
  }

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
    paymentCommitment: formData.get("paymentCommitment") === "on",
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

  if (racha.paymentDeadline && new Date() > racha.paymentDeadline) {
    await prisma.enrollment.updateMany({
      where: {
        rachaId,
        status: {
          not: ParticipantStatus.CANCELED,
        },
        paymentStatus: {
          in: [PaymentStatus.PENDING, PaymentStatus.PROOF_SENT],
        },
      },
      data: {
        status: ParticipantStatus.CANCELED,
        canceledAt: new Date(),
      },
    });

    redirect(
      buildMessageUrl(
        callbackUrl,
        "error",
        "O prazo de pagamento deste racha já foi encerrado.",
      ),
    );
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

  if (existing?.paymentStatus === PaymentStatus.REFUND_REQUESTED) {
    redirect(
      buildMessageUrl(
        callbackUrl,
        "error",
        "Você tem um reembolso em andamento. Aguarde o estorno para se inscrever novamente.",
      ),
    );
  }

  const duplicatedPhone = await hasDuplicatedPhoneEnrollment(
    rachaId,
    parsed.data.participantPhone,
    existing?.id,
  );

  if (duplicatedPhone) {
    redirect(
      buildMessageUrl(
        callbackUrl,
        "error",
        "O telefone informado já está inscrito no racha. Por favor, verifique o telefone ou veja se você já está incluso.",
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
        pixPaid: false,
        notes: parsed.data.notes || null,
        status: nextStatus,
        paymentStatus: PaymentStatus.PENDING,
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
        pixPaid: false,
        notes: parsed.data.notes || null,
        status: nextStatus,
        paymentStatus: PaymentStatus.PENDING,
      },
    });
  }

  revalidatePath(callbackUrl);
  revalidatePath("/minhas-inscricoes");
  revalidatePath("/dashboard");

  redirect(
    buildMessageUrl(
      "/minhas-inscricoes",
      "success",
      nextStatus === ParticipantStatus.WAITLIST
        ? "Inscrição registrada na lista de espera. Acompanhe em Minhas inscrições."
        : "Inscrição registrada com sucesso. Realize o pagamento para seguir no racha.",
    ),
  );
}

export async function addOrganizerEnrollmentAction(formData: FormData) {
  const user = await requireUser("/dashboard");
  const rachaId = getStringValue(formData, "rachaId");

  const parsed = organizerEnrollmentSchema.safeParse({
    rachaId,
    participantName: getStringValue(formData, "participantName"),
    participantPhone: getStringValue(formData, "participantPhone"),
    participantPosition: getStringValue(formData, "participantPosition"),
    participantLevel: getStringValue(formData, "participantLevel"),
    notes: getStringValue(formData, "notes"),
  });

  const callbackUrl = `/dashboard/rachas/${rachaId}/edit`;

  if (!parsed.success) {
    redirect(
      buildMessageUrl(
        callbackUrl,
        "error",
        parsed.error.issues[0]?.message ??
          "Não foi possível adicionar o participante.",
      ),
    );
  }

  const racha = await prisma.racha.findUnique({
    where: { id: parsed.data.rachaId },
  });

  if (!racha || racha.organizerId !== user.id) {
    redirect(buildMessageUrl("/dashboard", "error", "Racha não encontrado."));
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

  const duplicatedPhone = await hasDuplicatedPhoneEnrollment(
    parsed.data.rachaId,
    parsed.data.participantPhone,
  );

  if (duplicatedPhone) {
    redirect(
      buildMessageUrl(
        callbackUrl,
        "error",
        "O telefone informado já está inscrito no racha. Por favor, verifique o telefone ou veja se você já está incluso.",
      ),
    );
  }

  if (
    racha.modality === "FUTEBOL" &&
    parsed.data.participantPosition === "Goleiro" &&
    racha.goalkeeperLimit
  ) {
    const goalkeeperCount = await prisma.enrollment.count({
      where: {
        rachaId: parsed.data.rachaId,
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
        rachaId: parsed.data.rachaId,
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

  const confirmedCount = await prisma.enrollment.count({
    where: {
      rachaId: parsed.data.rachaId,
      status: ParticipantStatus.ACTIVE,
    },
  });

  const nextStatus =
    confirmedCount >= racha.athleteLimit
      ? ParticipantStatus.WAITLIST
      : ParticipantStatus.ACTIVE;

  const participantUser = await prisma.user.create({
    data: {
      name: parsed.data.participantName,
      phone: parsed.data.participantPhone,
    },
  });

  await prisma.enrollment.create({
    data: {
      rachaId: parsed.data.rachaId,
      userId: participantUser.id,
      participantName: parsed.data.participantName,
      participantPhone: parsed.data.participantPhone,
      participantPosition: parsed.data.participantPosition,
      participantLevel: parsed.data.participantLevel,
      acceptedRules: true,
      pixPaid: false,
      notes: parsed.data.notes || null,
      status: nextStatus,
      paymentStatus: PaymentStatus.PENDING,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath(callbackUrl);
  revalidatePath(`/rachas/${racha.slug}`);

  redirect(
    buildMessageUrl(
      callbackUrl,
      "success",
      nextStatus === ParticipantStatus.WAITLIST
        ? "Participante incluído na lista de espera com sucesso."
        : "Participante incluído com sucesso.",
    ),
  );
}

export async function cancelEnrollmentAction(formData: FormData) {
  const user = await requireUser("/minhas-inscricoes");
  const parsed = refundRequestSchema.safeParse({
    enrollmentId: getStringValue(formData, "enrollmentId"),
    refundReason: getStringValue(formData, "refundReason"),
    refundPixKey: getStringValue(formData, "refundPixKey"),
    refundPixAccountName: getStringValue(formData, "refundPixAccountName"),
    refundPixHolderName: getStringValue(formData, "refundPixHolderName"),
    confirmCancellation: formData.get("confirmCancellation") === "on",
  });

  if (!parsed.success) {
    redirect(
      buildMessageUrl(
        "/minhas-inscricoes",
        "error",
        parsed.error.issues[0]?.message ??
          "Não foi possível solicitar o reembolso.",
      ),
    );
  }

  const enrollmentId = parsed.data.enrollmentId;

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

  if (enrollment.paymentStatus !== PaymentStatus.PAID) {
    redirect(
      buildMessageUrl(
        "/minhas-inscricoes",
        "error",
        "A solicitação de reembolso só pode ser feita após confirmação do pagamento.",
      ),
    );
  }

  const refundMetadata = `\n\n[Reembolso solicitado]\nMotivo: ${parsed.data.refundReason}\nPIX para devolução: ${parsed.data.refundPixKey}\nNome da conta: ${parsed.data.refundPixAccountName}\nNome igual ao da conta: ${parsed.data.refundPixHolderName}`;

  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: {
      status: ParticipantStatus.CANCELED,
      paymentStatus: PaymentStatus.REFUND_REQUESTED,
      canceledAt: new Date(),
      refundRequestedAt: new Date(),
      notes: `${enrollment.notes ?? ""}${refundMetadata}`.trim(),
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

export async function cancelPendingEnrollmentAction(formData: FormData) {
  const user = await requireUser("/minhas-inscricoes");

  const parsed = cancelPendingEnrollmentSchema.safeParse({
    enrollmentId: getStringValue(formData, "enrollmentId"),
    confirmCancellation: formData.get("confirmCancellation") === "on",
    cancelReason: getStringValue(formData, "cancelReason"),
  });

  if (!parsed.success) {
    redirect(
      buildMessageUrl(
        "/minhas-inscricoes",
        "error",
        parsed.error.issues[0]?.message ??
          "Não foi possível cancelar a inscrição.",
      ),
    );
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: parsed.data.enrollmentId },
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

  if (enrollment.paymentStatus === PaymentStatus.PAID) {
    redirect(
      buildMessageUrl(
        "/minhas-inscricoes",
        "error",
        "Para inscrições pagas, use a solicitação de reembolso.",
      ),
    );
  }

  await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: {
      status: ParticipantStatus.CANCELED,
      canceledAt: new Date(),
      notes:
        `${enrollment.notes ?? ""}\n\n[Cancelamento sem pagamento]\nMotivo: ${parsed.data.cancelReason}`.trim(),
    },
  });

  revalidatePath("/minhas-inscricoes");
  revalidatePath(`/rachas/${enrollment.rachaId}`);
  revalidatePath("/dashboard");

  redirect(
    buildMessageUrl(
      "/minhas-inscricoes",
      "success",
      "Inscrição cancelada com sucesso.",
    ),
  );
}

export async function confirmEnrollmentPaymentAction(formData: FormData) {
  const user = await requireUser("/dashboard");
  const enrollmentId = getStringValue(formData, "enrollmentId");
  const callbackUrl = getStringValue(formData, "callbackUrl");

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { racha: true },
  });

  const redirectUrl =
    callbackUrl || `/dashboard/rachas/${enrollment?.rachaId ?? ""}/edit`;

  if (!enrollment || enrollment.racha.organizerId !== user.id) {
    redirect(
      buildMessageUrl("/dashboard", "error", "Participante não encontrado."),
    );
  }

  if (enrollment.status === ParticipantStatus.CANCELED) {
    redirect(
      buildMessageUrl(
        redirectUrl,
        "error",
        "Não é possível confirmar pagamento de inscrição cancelada.",
      ),
    );
  }

  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: {
      paymentStatus: PaymentStatus.PAID,
      pixPaid: true,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/rachas/${enrollment.rachaId}/edit`);
  if (callbackUrl) {
    revalidatePath(callbackUrl);
  }
  redirect(buildMessageUrl(redirectUrl, "success", "Pagamento confirmado."));
}

export async function removeOrganizerPendingEnrollmentAction(
  formData: FormData,
) {
  const user = await requireUser("/dashboard");
  const enrollmentId = getStringValue(formData, "enrollmentId");
  const callbackUrl = getStringValue(formData, "callbackUrl");

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { racha: true },
  });

  const redirectUrl =
    callbackUrl || `/dashboard/rachas/${enrollment?.rachaId ?? ""}/edit`;

  if (!enrollment || enrollment.racha.organizerId !== user.id) {
    redirect(
      buildMessageUrl("/dashboard", "error", "Participante não encontrado."),
    );
  }

  if (enrollment.paymentStatus === PaymentStatus.PAID) {
    redirect(
      buildMessageUrl(
        redirectUrl,
        "error",
        "Use o fluxo de reembolso para participantes com pagamento confirmado.",
      ),
    );
  }

  if (enrollment.status === ParticipantStatus.CANCELED) {
    redirect(
      buildMessageUrl(redirectUrl, "error", "Essa inscrição já foi removida."),
    );
  }

  await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: {
      status: ParticipantStatus.CANCELED,
      canceledAt: new Date(),
      notes:
        `${enrollment.notes ?? ""}\n\n[Remoção pelo organizador]\nMotivo: inscrição pendente removida manualmente.`.trim(),
    },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/rachas/${enrollment.rachaId}/edit`);
  revalidatePath(`/rachas/${enrollment.racha.slug}`);
  if (callbackUrl) {
    revalidatePath(callbackUrl);
  }

  redirect(
    buildMessageUrl(
      redirectUrl,
      "success",
      "Inscrição pendente removida com sucesso.",
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
      status: ParticipantStatus.CANCELED,
      paymentStatus: PaymentStatus.REFUNDED,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/minhas-inscricoes");
  revalidatePath(`/rachas/${enrollment.racha.slug}`);
  revalidatePath(`/dashboard/rachas/${enrollment.rachaId}/edit`);
  redirect(
    buildMessageUrl(
      `/dashboard/rachas/${enrollment.rachaId}/edit`,
      "success",
      "Reembolso marcado como concluído.",
    ),
  );
}
