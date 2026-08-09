"use server";

import { randomBytes } from "node:crypto";
import { compare, hash } from "bcryptjs";
import {
  PaymentStatus,
  ParticipantStatus,
  Prisma,
  RecurrenceFrequency,
  Visibility,
} from "@prisma/client";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth, isGoogleConfigured, signIn, signOut } from "@/auth";
import { ORGANIZER_DEFAULT_PHONE, SUPER_ADMIN_EMAIL } from "@/lib/constants";
import { isGoalkeeperPosition } from "@/lib/enrollment";
import { detectIsFemaleByName } from "@/lib/gender";
import { participantLevelValues } from "@/lib/participant-level";
import { prisma } from "@/lib/prisma";
import {
  bulkOrganizerEnrollmentSchema,
  cancelPendingEnrollmentSchema,
  combineDateAndTime,
  credentialsSignInSchema,
  enrollmentSchema,
  addOrganizerUserSchema,
  adminSetUserPasswordSchema,
  forgotPasswordSchema,
  organizerDataSettingsSchema,
  organizerAddRachaAdminSchema,
  organizerBulkCancelPendingEnrollmentsSchema,
  organizerEnrollmentSchema,
  organizerPixSettingsSchema,
  organizerRemoveRachaAdminSchema,
  organizerRemoveEnrollmentSchema,
  organizerToggleNextRachaBlockSchema,
  organizerUpdateEnrollmentLevelSchema,
  organizerUpdateEnrollmentStatusSchema,
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

function buildEnrollmentStatusUpdate(input: {
  status: ParticipantStatus;
  paymentStatus: PaymentStatus;
  canceledAt: Date | null;
  refundRequestedAt: Date | null;
}) {
  const now = new Date();
  const refundedState =
    input.paymentStatus === PaymentStatus.REFUND_REQUESTED ||
    input.paymentStatus === PaymentStatus.REFUNDED;
  const paidState = input.paymentStatus === PaymentStatus.PAID || refundedState;

  return {
    status: input.status,
    paymentStatus: input.paymentStatus,
    pixPaid: paidState,
    canceledAt:
      input.status === ParticipantStatus.CANCELED
        ? (input.canceledAt ?? now)
        : null,
    refundRequestedAt: refundedState ? (input.refundRequestedAt ?? now) : null,
  };
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

function isOrganizerDefaultPhone(phone: string) {
  return normalizePhoneValue(phone) === ORGANIZER_DEFAULT_PHONE;
}

function normalizeEmailValue(email: string) {
  return email.trim().toLowerCase();
}

function hasPixConfiguration(pixKey?: string | null) {
  return Boolean(pixKey?.trim());
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

async function getOrCreateParticipantUser(input: {
  name: string;
  phone: string;
  isFemale?: boolean;
}) {
  const isFemaleValue = input.isFemale ?? detectIsFemaleByName(input.name);

  const existingUser = await prisma.user.findUnique({
    where: { phone: input.phone },
    select: { id: true, name: true, isFemale: true },
  });

  if (existingUser) {
    const shouldUpdateName = !existingUser.name?.trim() && input.name.trim();
    const shouldUpdateFemale = isFemaleValue && !existingUser.isFemale;

    if (shouldUpdateName || shouldUpdateFemale) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          ...(shouldUpdateName ? { name: input.name.trim() } : {}),
          ...(shouldUpdateFemale ? { isFemale: true } : {}),
        },
      });
    }

    return existingUser;
  }

  try {
    return await prisma.user.create({
      data: {
        name: input.name,
        phone: input.phone,
        isFemale: isFemaleValue,
      },
      select: { id: true, name: true, isFemale: true },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const userCreatedInParallel = await prisma.user.findUnique({
        where: { phone: input.phone },
        select: { id: true, name: true, isFemale: true },
      });

      if (userCreatedInParallel) {
        return userCreatedInParallel;
      }
    }

    throw error;
  }
}

function normalizeTextValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeBulkParticipantLevel(level: string) {
  const normalized = normalizeTextValue(level).replace(/[^a-z0-9]/g, "");

  const levelMap: Record<string, string> = {
    "1": "STAR_1",
    "1estrela": "STAR_1",
    "1estrelas": "STAR_1",
    star1: "STAR_1",
    "2": "STAR_2",
    "2estrela": "STAR_2",
    "2estrelas": "STAR_2",
    star2: "STAR_2",
    "3": "STAR_3",
    "3estrela": "STAR_3",
    "3estrelas": "STAR_3",
    star3: "STAR_3",
    "4": "STAR_4",
    "4estrela": "STAR_4",
    "4estrelas": "STAR_4",
    star4: "STAR_4",
    "5": "STAR_5",
    "5estrela": "STAR_5",
    "5estrelas": "STAR_5",
    star5: "STAR_5",
    iniciante: "INICIANTE",
    intermediario: "INTERMEDIARIO",
    avancado: "AVANCADO",
  };

  return levelMap[normalized];
}

function normalizeBulkParticipantPosition(position: string) {
  const rawValue = position.trim();

  if (!rawValue) {
    return "Versátil";
  }

  const normalized = normalizeTextValue(rawValue).replace(/[^a-z]/g, "");

  if (normalized === "versatil" || normalized === "versatio") {
    return "Versátil";
  }

  return rawValue;
}

function isBulkHeaderLine(columns: string[]) {
  const normalizedColumns = columns.map((value) =>
    normalizeTextValue(value).replace(/[^a-z]/g, ""),
  );

  return (
    normalizedColumns[0] === "nome" &&
    normalizedColumns[1] === "telefone" &&
    normalizedColumns[2] === "nivel" &&
    (normalizedColumns[3] === undefined ||
      normalizedColumns[3] === "funcao" ||
      normalizedColumns[3] === "posicao")
  );
}

async function createOrganizerEnrollmentForRacha(input: {
  racha: {
    id: string;
    slug: string;
    modality: string;
    organizerId: string;
    eventDate: Date;
    athleteLimit: number;
    priceInCents: number;
    goalkeeperLimit: number | null;
    hasFixedSetter: boolean;
    setterLimit: number | null;
  };
  enrollment: {
    participantName: string;
    participantPhone: string;
    participantPosition: string;
    participantLevel: (typeof participantLevelValues)[number];
    isFemale?: boolean;
    notes?: string;
  };
}) {
  const isFemaleValue =
    input.enrollment.isFemale ??
    detectIsFemaleByName(input.enrollment.participantName);
  const isGoalkeeperEnrollment =
    input.racha.modality === "FUTEBOL" &&
    isGoalkeeperPosition(input.enrollment.participantPosition);
  const usesDefaultPhone = isOrganizerDefaultPhone(
    input.enrollment.participantPhone,
  );

  const duplicatedPhone = usesDefaultPhone
    ? false
    : await hasDuplicatedPhoneEnrollment(
        input.racha.id,
        input.enrollment.participantPhone,
      );

  if (duplicatedPhone) {
    throw new Error(
      "O telefone informado ja esta inscrito no racha. Verifique antes de importar novamente.",
    );
  }

  if (
    input.racha.modality === "FUTEBOL" &&
    input.enrollment.participantPosition === "Goleiro" &&
    input.racha.goalkeeperLimit
  ) {
    const goalkeeperCount = await prisma.enrollment.count({
      where: {
        rachaId: input.racha.id,
        status: ParticipantStatus.ACTIVE,
        participantPosition: "Goleiro",
      },
    });

    if (goalkeeperCount >= input.racha.goalkeeperLimit) {
      throw new Error(
        "Nao ha mais vagas para goleiro. Ajuste a funcao do participante.",
      );
    }
  }

  if (
    input.racha.modality === "VOLEI" &&
    input.enrollment.participantPosition === "Levantador" &&
    input.racha.hasFixedSetter &&
    input.racha.setterLimit
  ) {
    const setterCount = await prisma.enrollment.count({
      where: {
        rachaId: input.racha.id,
        status: ParticipantStatus.ACTIVE,
        participantPosition: "Levantador",
      },
    });

    if (setterCount >= input.racha.setterLimit) {
      throw new Error(
        "Nao ha mais vagas de levantador fixo. Ajuste a funcao do participante.",
      );
    }
  }

  const confirmedCount = await prisma.enrollment.count({
    where: {
      rachaId: input.racha.id,
      status: ParticipantStatus.ACTIVE,
      participantPosition: {
        not: "Goleiro",
      },
    },
  });

  const isFree = input.racha.priceInCents === 0;
  const nextStatus =
    !isGoalkeeperEnrollment && confirmedCount >= input.racha.athleteLimit
      ? ParticipantStatus.WAITLIST
      : ParticipantStatus.ACTIVE;
  const nextPaymentStatus =
    isFree || isGoalkeeperEnrollment
      ? PaymentStatus.PAID
      : PaymentStatus.PENDING;
  const nextPixPaid = isFree || isGoalkeeperEnrollment;
  const normalizedPhone = usesDefaultPhone
    ? ORGANIZER_DEFAULT_PHONE
    : normalizePhoneValue(input.enrollment.participantPhone);
  const participantUser = usesDefaultPhone
    ? await prisma.user.create({
        data: {
          name: input.enrollment.participantName,
          isFemale: isFemaleValue,
        },
        select: { id: true, name: true },
      })
    : await getOrCreateParticipantUser({
        name: input.enrollment.participantName,
        phone: normalizedPhone,
        isFemale: isFemaleValue,
      });

  await prisma.enrollment.create({
    data: {
      rachaId: input.racha.id,
      userId: participantUser.id,
      participantName: input.enrollment.participantName,
      participantPhone: normalizedPhone,
      participantPosition: input.enrollment.participantPosition,
      participantLevel: input.enrollment.participantLevel,
      isFemale: isFemaleValue,
      acceptedRules: true,
      pixPaid: nextPixPaid,
      notes: input.enrollment.notes || null,
      status: nextStatus,
      paymentStatus: nextPaymentStatus,
    },
  });

  return {
    nextStatus,
    isGoalkeeperEnrollment,
  };
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

function isSuperAdminEmail(email?: string | null) {
  if (!email) {
    return false;
  }

  return normalizeEmailValue(email) === SUPER_ADMIN_EMAIL;
}

async function requireSuperAdminUser(callbackUrl?: string) {
  const user = await requireUser(callbackUrl);

  if (!isSuperAdminEmail(user.email)) {
    redirect(
      buildMessageUrl(
        "/dashboard",
        "error",
        "Acesso restrito ao administrador principal.",
      ),
    );
  }

  return user;
}

async function isUserRachaAdmin(userId: string, rachaId: string) {
  const role = await prisma.rachaAdmin.findUnique({
    where: {
      rachaId_userId: {
        rachaId,
        userId,
      },
    },
    select: { id: true },
  });

  return Boolean(role);
}

async function canUserManageRacha(input: {
  userId: string;
  rachaId: string;
  organizerId: string;
}) {
  if (input.organizerId === input.userId) {
    return true;
  }

  return isUserRachaAdmin(input.userId, input.rachaId);
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

  const normalizedIdentifier = parsed.data.identifier.trim();
  const isEmail = normalizedIdentifier.includes("@");

  const existingUser = isEmail
    ? await prisma.user.findUnique({
        where: { email: normalizedIdentifier.toLowerCase() },
        select: { id: true, passwordHash: true, mustChangePassword: true },
      })
    : await prisma.user.findFirst({
        where: {
          OR: [
            { phone: normalizedIdentifier },
            { phone: normalizePhoneValue(normalizedIdentifier) },
          ],
        },
        select: { id: true, passwordHash: true, mustChangePassword: true },
      });

  let targetRedirect = callbackUrl;
  if (existingUser?.passwordHash) {
    const passwordMatches = await compare(
      parsed.data.password,
      existingUser.passwordHash,
    );
    if (passwordMatches && existingUser.mustChangePassword) {
      targetRedirect = `/auth/change-password?required=true&callbackUrl=${encodeURIComponent(callbackUrl)}`;
    }
  }

  try {
    await signIn("credentials", {
      identifier: parsed.data.identifier,
      password: parsed.data.password,
      redirectTo: targetRedirect,
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
      mustChangePassword: false,
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
    const field = getFirstIssueFieldName(parsed.error.issues);
    redirect(
      buildMessageUrl(
        "/dashboard",
        "error",
        parsed.error.issues[0]?.message ??
          "Não foi possível atualizar suas configurações.",
        { field },
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

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      redirect(
        buildMessageUrl(
          "/dashboard",
          "error",
          "Este número de telefone já está cadastrado em outra conta.",
          { field: "phone" },
        ),
      );
    }
    throw error;
  }

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

export async function createOrganizerUserAction(formData: FormData) {
  await requireUser("/dashboard");

  const parsed = addOrganizerUserSchema.safeParse({
    name: getStringValue(formData, "name"),
    nickname: getStringValue(formData, "nickname"),
    phone: getStringValue(formData, "phone"),
    email: getStringValue(formData, "email"),
    password: getStringValue(formData, "password"),
  });

  if (!parsed.success) {
    const field = getFirstIssueFieldName(parsed.error.issues);
    redirect(
      buildMessageUrl(
        "/dashboard",
        "error",
        parsed.error.issues[0]?.message ??
          "Preencha os dados do usuário corretamente.",
        { field },
      ),
    );
  }

  const phone = normalizePhoneValue(parsed.data.phone);
  const email = parsed.data.email
    ? normalizeEmailValue(parsed.data.email)
    : null;
  const canUseNickname = supportsUserField("nickname");

  if (email) {
    const existingEmail = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingEmail) {
      redirect(
        buildMessageUrl(
          "/dashboard",
          "error",
          "Já existe um usuário cadastrado com este e-mail.",
        ),
      );
    }
  }

  const existingPhone = await prisma.user.findFirst({
    where: { phone },
    select: { id: true },
  });
  if (existingPhone) {
    redirect(
      buildMessageUrl(
        "/dashboard",
        "error",
        "Já existe um usuário cadastrado com este telefone.",
      ),
    );
  }

  const passwordHash = await hash(parsed.data.password, 10);

  const isFemaleInput =
    formData.get("isFemale") === "true" || formData.get("isFemale") === "on";
  const isFemaleValue = isFemaleInput || detectIsFemaleByName(parsed.data.name);

  const createData: Record<string, unknown> = {
    name: parsed.data.name,
    phone,
    email,
    passwordHash,
    isFemale: isFemaleValue,
    mustChangePassword: true,
  };

  if (canUseNickname && parsed.data.nickname) {
    createData.nickname = parsed.data.nickname;
  }

  await prisma.user.create({
    data: createData as Prisma.UserCreateInput,
  });

  revalidatePath("/dashboard");

  redirect(
    buildMessageUrl(
      "/dashboard",
      "success",
      `Usuário ${parsed.data.name} adicionado ao banco com sucesso!`,
    ),
  );
}

export async function adminSetUserPasswordAction(formData: FormData) {
  await requireSuperAdminUser("/dashboard/usuarios");

  const parsed = adminSetUserPasswordSchema.safeParse({
    userId: getStringValue(formData, "userId"),
    password: getStringValue(formData, "password"),
    confirmPassword: getStringValue(formData, "confirmPassword"),
  });

  if (!parsed.success) {
    const field = getFirstIssueFieldName(parsed.error.issues);
    redirect(
      buildMessageUrl(
        "/dashboard/usuarios",
        "error",
        parsed.error.issues[0]?.message ??
          "Não foi possível redefinir a senha do usuário.",
        { field },
      ),
    );
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, name: true },
  });

  if (!targetUser) {
    redirect(
      buildMessageUrl(
        "/dashboard/usuarios",
        "error",
        "Usuário não encontrado.",
      ),
    );
  }

  const nextPasswordHash = await hash(parsed.data.password, 10);

  await prisma.user.update({
    where: { id: targetUser.id },
    data: {
      passwordHash: nextPasswordHash,
      mustChangePassword: true,
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });

  revalidatePath("/dashboard/usuarios");

  redirect(
    buildMessageUrl(
      "/dashboard/usuarios",
      "success",
      `Senha de ${targetUser.name ?? "usuário"} redefinida. No próximo login ele deverá criar uma nova senha.`,
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
    const field = getFirstIssueFieldName(parsed.error.issues);
    redirect(
      buildMessageUrl(
        "/dashboard",
        "error",
        parsed.error.issues[0]?.message ??
          "Não foi possível atualizar as configurações de PIX.",
        { field },
      ),
    );
  }

  const normalizedPixKey = parsed.data.pixKey?.trim() || "";

  await prisma.user.update({
    where: { id: user.id },
    data: {
      pixKey: normalizedPixKey || null,
      pixBankName: parsed.data.pixBankName || null,
      pixHolderName: parsed.data.pixHolderName || null,
    },
  });

  await prisma.racha.updateMany({
    where: {
      organizerId: user.id,
      status: "PUBLISHED",
    },
    data: {
      pixKey: normalizedPixKey,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/rachas/new");
  revalidatePath("/");

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
    eventEndTime: getStringValue(formData, "eventEndTime"),
    isRecurring: formData.get("isRecurring") === "true",
    recurrenceFrequency: getStringValue(formData, "recurrenceFrequency"),
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
  let eventEndDate: Date | null = null;
  if (parsed.data.eventEndTime?.trim()) {
    eventEndDate = combineDateAndTime(
      parsed.data.eventDate,
      parsed.data.eventEndTime,
    );
    if (eventEndDate <= eventDate) {
      eventEndDate.setDate(eventEndDate.getDate() + 1);
    }
  }
  const isFree = parsed.data.price === 0;
  const paymentDeadline =
    !isFree &&
    parsed.data.paymentDeadlineDate &&
    parsed.data.paymentDeadlineTime
      ? combineDateAndTime(
          parsed.data.paymentDeadlineDate,
          parsed.data.paymentDeadlineTime,
        )
      : null;
  const slug = await generateUniqueSlug(parsed.data.title);
  const organizerSettings = await getOrganizerRachaSettings(user.id);
  const organizerDisplayName =
    organizerSettings?.organizerDisplayName ||
    user.name?.trim() ||
    "Organizador";
  const phoneWhatsapp = organizerSettings?.phoneWhatsapp || "";
  const pixKey = organizerSettings?.pixKey || "";

  await prisma.racha.create({
    data: {
      slug,
      title: parsed.data.title,
      modality: parsed.data.modality as never,
      description: parsed.data.description || null,
      rules: parsed.data.rules,
      athleteLimit: parsed.data.athleteLimit,
      eventDate,
      eventEndDate,
      isRecurring: parsed.data.isRecurring ?? false,
      recurrenceFrequency: parsed.data.isRecurring
        ? (parsed.data.recurrenceFrequency as RecurrenceFrequency | "") || null
        : null,
      locationName: parsed.data.locationName,
      address: parsed.data.address,
      city: parsed.data.city,
      state: parsed.data.state || null,
      mapsQuery:
        parsed.data.mapsQuery ||
        `${parsed.data.locationName}, ${parsed.data.address}, ${parsed.data.city}`,
      priceInCents: Math.round(parsed.data.price * 100),
      organizerDisplayName,
      phoneWhatsapp,
      whatsappGroupUrl: parsed.data.whatsappGroupUrl || null,
      pixKey,
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

  const isPublished = isFree || hasPixConfiguration(pixKey);
  redirect(
    buildMessageUrl(
      "/dashboard",
      "success",
      isPublished
        ? "Racha criado com sucesso."
        : "Racha criado com sucesso. Configure a chave PIX para publicar e liberar inscricoes.",
    ),
  );
}

export async function updateRachaAction(formData: FormData) {
  const user = await requireUser("/dashboard");
  const id = getStringValue(formData, "id");

  const existing = await prisma.racha.findUnique({ where: { id } });

  if (
    !existing ||
    !(await canUserManageRacha({
      userId: user.id,
      rachaId: existing.id,
      organizerId: existing.organizerId,
    }))
  ) {
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
    eventEndTime: getStringValue(formData, "eventEndTime"),
    isRecurring: formData.get("isRecurring") === "true",
    recurrenceFrequency: getStringValue(formData, "recurrenceFrequency"),
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
  let eventEndDate: Date | null = null;
  if (parsed.data.eventEndTime?.trim()) {
    eventEndDate = combineDateAndTime(
      parsed.data.eventDate,
      parsed.data.eventEndTime,
    );
    if (eventEndDate <= eventDate) {
      eventEndDate.setDate(eventEndDate.getDate() + 1);
    }
  }
  const isFree = parsed.data.price === 0;
  const paymentDeadline =
    !isFree &&
    parsed.data.paymentDeadlineDate &&
    parsed.data.paymentDeadlineTime
      ? combineDateAndTime(
          parsed.data.paymentDeadlineDate,
          parsed.data.paymentDeadlineTime,
        )
      : null;
  const slug = await generateUniqueSlug(parsed.data.title, id);
  const organizerSettings = await getOrganizerRachaSettings(user.id);
  const organizerDisplayName =
    organizerSettings?.organizerDisplayName ||
    user.name?.trim() ||
    "Organizador";
  const phoneWhatsapp = organizerSettings?.phoneWhatsapp || "";
  const pixKey = organizerSettings?.pixKey || "";

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
      eventEndDate,
      isRecurring: parsed.data.isRecurring ?? false,
      recurrenceFrequency: parsed.data.isRecurring
        ? (parsed.data.recurrenceFrequency as RecurrenceFrequency | "") || null
        : null,
      locationName: parsed.data.locationName,
      address: parsed.data.address,
      city: parsed.data.city,
      state: parsed.data.state || null,
      mapsQuery:
        parsed.data.mapsQuery ||
        `${parsed.data.locationName}, ${parsed.data.address}, ${parsed.data.city}`,
      priceInCents: Math.round(parsed.data.price * 100),
      organizerDisplayName,
      phoneWhatsapp,
      whatsappGroupUrl: parsed.data.whatsappGroupUrl || null,
      pixKey,
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

  if (isFree) {
    await prisma.enrollment.updateMany({
      where: {
        rachaId: id,
        paymentStatus: {
          in: [PaymentStatus.PENDING, PaymentStatus.PROOF_SENT],
        },
      },
      data: {
        paymentStatus: PaymentStatus.PAID,
        pixPaid: true,
      },
    });
  }

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath(`/rachas/${slug}`);
  revalidatePath(`/dashboard/rachas/${id}/edit`);

  const isPublished = isFree || hasPixConfiguration(pixKey);
  redirect(
    buildMessageUrl(
      `/dashboard/rachas/${id}/edit`,
      "success",
      isPublished
        ? "Racha atualizado com sucesso."
        : "Racha atualizado com sucesso. Configure a chave PIX para publicar e liberar inscricoes.",
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

  if (
    !existing ||
    !(await canUserManageRacha({
      userId: user.id,
      rachaId: existing.id,
      organizerId: existing.organizerId,
    }))
  ) {
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
  const session = await auth();
  const rachaId = getStringValue(formData, "rachaId");

  const isFemaleInput =
    formData.get("isFemale") === "true" ||
    formData.get("isFemale") === "on" ||
    formData.get("isFemale") === "1";

  const parsed = enrollmentSchema.safeParse({
    rachaId,
    slug,
    participantName: getStringValue(formData, "participantName"),
    participantPhone: getStringValue(formData, "participantPhone"),
    participantPosition: getStringValue(formData, "participantPosition"),
    participantLevel: getStringValue(formData, "participantLevel"),
    isFemale: isFemaleInput,
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

  const isFree = racha.priceInCents === 0;

  if (!isFree && !hasPixConfiguration(racha.pixKey)) {
    redirect(
      buildMessageUrl(
        callbackUrl,
        "error",
        "Este racha ainda nao esta publicado para inscricoes. O organizador precisa configurar a chave PIX.",
      ),
    );
  }

  if (!isFree && racha.paymentDeadline && new Date() > racha.paymentDeadline) {
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

  const isGoalkeeperEnrollment =
    racha.modality === "FUTEBOL" &&
    isGoalkeeperPosition(parsed.data.participantPosition);

  if (!isFree && !isGoalkeeperEnrollment && !parsed.data.paymentCommitment) {
    redirect(
      buildMessageUrl(
        callbackUrl,
        "error",
        "Confirme que só estará na lista após realizar o pagamento.",
      ),
    );
  }

  const normalizedPhone = normalizePhoneValue(parsed.data.participantPhone);

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

  const isFemaleValue =
    parsed.data.isFemale ?? detectIsFemaleByName(parsed.data.participantName);

  const participantUser = session?.user?.id
    ? { id: session.user.id }
    : await getOrCreateParticipantUser({
        name: parsed.data.participantName,
        phone: normalizedPhone,
        isFemale: isFemaleValue,
      });

  if (session?.user?.id) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { isFemale: isFemaleValue },
    });
  }

  const activeBlock = await prisma.organizerParticipantBlock.findUnique({
    where: {
      organizerId_userId: {
        organizerId: racha.organizerId,
        userId: participantUser.id,
      },
    },
  });

  const isBlockForThisRacha = activeBlock?.active
    ? activeBlock.targetRachaId
      ? activeBlock.targetRachaId === racha.id
      : racha.eventDate > activeBlock.anchorEventDate
    : false;

  if (activeBlock?.active && isBlockForThisRacha) {
    await prisma.organizerParticipantBlock.update({
      where: { id: activeBlock.id },
      data: {
        active: false,
        targetRachaId: null,
      },
    });

    redirect(
      buildMessageUrl(
        callbackUrl,
        "error",
        "Sua inscrição foi bloqueada para este racha pelo organizador.",
      ),
    );
  }

  const existing = await prisma.enrollment.findUnique({
    where: {
      rachaId_userId: {
        rachaId,
        userId: participantUser.id,
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
      participantPosition: {
        not: "Goleiro",
      },
    },
  });

  const nextStatus =
    !isGoalkeeperEnrollment && confirmedCount >= racha.athleteLimit
      ? ParticipantStatus.WAITLIST
      : ParticipantStatus.ACTIVE;
  const nextPaymentStatus =
    isFree || isGoalkeeperEnrollment
      ? PaymentStatus.PAID
      : PaymentStatus.PENDING;
  const nextPixPaid = isFree || isGoalkeeperEnrollment;

  if (existing) {
    await prisma.enrollment.update({
      where: { id: existing.id },
      data: {
        participantName: parsed.data.participantName,
        participantPhone: normalizedPhone,
        participantPosition: parsed.data.participantPosition,
        participantLevel: parsed.data.participantLevel,
        isFemale: isFemaleValue,
        acceptedRules: true,
        pixPaid: nextPixPaid,
        notes: parsed.data.notes || null,
        status: nextStatus,
        paymentStatus: nextPaymentStatus,
        canceledAt: null,
        refundRequestedAt: null,
      },
    });
  } else {
    await prisma.enrollment.create({
      data: {
        rachaId,
        userId: participantUser.id,
        participantName: parsed.data.participantName,
        participantPhone: normalizedPhone,
        participantPosition: parsed.data.participantPosition,
        participantLevel: parsed.data.participantLevel,
        isFemale: isFemaleValue,
        acceptedRules: true,
        pixPaid: nextPixPaid,
        notes: parsed.data.notes || null,
        status: nextStatus,
        paymentStatus: nextPaymentStatus,
      },
    });
  }

  revalidatePath(callbackUrl);
  if (session?.user?.id) {
    revalidatePath("/minhas-inscricoes");
  }
  revalidatePath("/dashboard");

  redirect(
    buildMessageUrl(
      session?.user?.id ? "/minhas-inscricoes" : callbackUrl,
      "success",
      nextStatus === ParticipantStatus.WAITLIST
        ? session?.user?.id
          ? "Inscrição registrada na lista de espera. Acompanhe em Minhas inscrições."
          : "Inscrição registrada na lista de espera com sucesso."
        : isGoalkeeperEnrollment
          ? "Inscrição de goleiro confirmada com sucesso. Você já entrou na lista do racha."
          : "Inscrição registrada com sucesso. Realize o pagamento para seguir no racha.",
    ),
  );
}

export async function searchUsersByPhoneAction(query: string) {
  const user = await requireUser("/dashboard");
  if (!user) return [];

  const rawQuery = query.trim();
  if (!rawQuery || rawQuery.length < 2) {
    return [];
  }

  const digits = rawQuery.replace(/\D/g, "");

  const ORConditions: Prisma.UserWhereInput[] = [
    { name: { contains: rawQuery, mode: "insensitive" } },
  ];

  if (digits.length >= 2) {
    ORConditions.push({ phone: { contains: digits } });
  }

  const users = await prisma.user.findMany({
    where: {
      OR: ORConditions,
    },
    select: {
      id: true,
      name: true,
      phone: true,
    },
    take: 10,
    orderBy: {
      name: "asc",
    },
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name || "Sem nome",
    phone: u.phone || "",
  }));
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
    isFemale:
      formData.get("isFemale") === "true" ||
      formData.get("isFemale") === "on" ||
      formData.get("isFemale") === "1",
    notes: getStringValue(formData, "notes"),
  });

  const callbackUrl = `/dashboard/rachas/${rachaId}/edit`;

  if (!parsed.success) {
    const field = getFirstIssueFieldName(parsed.error.issues);
    redirect(
      buildMessageUrl(
        callbackUrl,
        "error",
        parsed.error.issues[0]?.message ??
          "Não foi possível adicionar o participante.",
        { field },
      ),
    );
  }

  const racha = await prisma.racha.findUnique({
    where: { id: parsed.data.rachaId },
  });

  if (
    !racha ||
    !(await canUserManageRacha({
      userId: user.id,
      rachaId: racha.id,
      organizerId: racha.organizerId,
    }))
  ) {
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

  const isGoalkeeperEnrollment =
    racha.modality === "FUTEBOL" &&
    isGoalkeeperPosition(parsed.data.participantPosition);

  let nextStatus: ParticipantStatus = ParticipantStatus.ACTIVE;

  try {
    const result = await createOrganizerEnrollmentForRacha({
      racha,
      enrollment: parsed.data,
    });

    nextStatus = result.nextStatus;
  } catch (error) {
    redirect(
      buildMessageUrl(
        callbackUrl,
        "error",
        error instanceof Error
          ? error.message
          : "Não foi possível adicionar o participante.",
      ),
    );
  }

  revalidatePath("/dashboard");
  revalidatePath(callbackUrl);
  revalidatePath(`/rachas/${racha.slug}`);

  redirect(
    buildMessageUrl(
      callbackUrl,
      "success",
      nextStatus === ParticipantStatus.WAITLIST
        ? "Participante incluído na lista de espera com sucesso."
        : isGoalkeeperEnrollment
          ? "Goleiro incluído e confirmado com sucesso."
          : "Participante incluído com sucesso.",
    ),
  );
}

export async function bulkAddOrganizerEnrollmentsAction(formData: FormData) {
  const user = await requireUser("/dashboard");
  const rachaId = getStringValue(formData, "rachaId");
  const callbackUrl = `/dashboard/rachas/${rachaId}/edit`;

  const parsed = bulkOrganizerEnrollmentSchema.safeParse({
    rachaId,
    bulkEntries: getStringValue(formData, "bulkEntries"),
  });

  if (!parsed.success) {
    const field = getFirstIssueFieldName(parsed.error.issues);

    redirect(
      buildMessageUrl(
        callbackUrl,
        "error",
        parsed.error.issues[0]?.message ??
          "Não foi possível importar os participantes.",
        { field },
      ),
    );
  }

  const racha = await prisma.racha.findUnique({
    where: { id: parsed.data.rachaId },
  });

  if (
    !racha ||
    !(await canUserManageRacha({
      userId: user.id,
      rachaId: racha.id,
      organizerId: racha.organizerId,
    }))
  ) {
    redirect(buildMessageUrl("/dashboard", "error", "Racha não encontrado."));
  }

  if (racha.eventDate <= new Date()) {
    redirect(
      buildMessageUrl(
        callbackUrl,
        "error",
        "Este racha já aconteceu ou foi encerrado.",
        { field: "bulkEntries" },
      ),
    );
  }

  const rawLines = parsed.data.bulkEntries
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const lines =
    rawLines.length > 0 && isBulkHeaderLine(rawLines[0].split(";"))
      ? rawLines.slice(1)
      : rawLines;

  if (lines.length === 0) {
    redirect(
      buildMessageUrl(
        callbackUrl,
        "error",
        "Nenhuma linha valida foi encontrada para importar.",
        { field: "bulkEntries" },
      ),
    );
  }

  let importedCount = 0;
  let waitlistCount = 0;
  let goalkeeperCount = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const columns = line.split(";").map((value) => value.trim());

    if (columns.length < 3) {
      redirect(
        buildMessageUrl(
          callbackUrl,
          "error",
          `Linha ${index + 1}: use o formato nome;telefone;nivel;funcao.`,
          { field: "bulkEntries" },
        ),
      );
    }

    const participantName = columns[0] ?? "";
    const participantPhone = columns[1] ?? "";
    const participantLevel = normalizeBulkParticipantLevel(columns[2] ?? "");
    const participantPosition = normalizeBulkParticipantPosition(
      columns[3] ?? "",
    );

    if (!participantLevel) {
      redirect(
        buildMessageUrl(
          callbackUrl,
          "error",
          `Linha ${index + 1}: nivel invalido. Use 1 a 5 estrelas ou STAR_1 a STAR_5.`,
          { field: "bulkEntries" },
        ),
      );
    }

    const enrollmentParsed = organizerEnrollmentSchema.safeParse({
      rachaId: parsed.data.rachaId,
      participantName,
      participantPhone,
      participantPosition,
      participantLevel,
      notes: "",
    });

    if (!enrollmentParsed.success) {
      redirect(
        buildMessageUrl(
          callbackUrl,
          "error",
          `Linha ${index + 1}: ${enrollmentParsed.error.issues[0]?.message ?? "dados invalidos."}`,
          { field: "bulkEntries" },
        ),
      );
    }

    try {
      const result = await createOrganizerEnrollmentForRacha({
        racha,
        enrollment: enrollmentParsed.data,
      });

      importedCount += 1;

      if (result.nextStatus === ParticipantStatus.WAITLIST) {
        waitlistCount += 1;
      }

      if (result.isGoalkeeperEnrollment) {
        goalkeeperCount += 1;
      }
    } catch (error) {
      redirect(
        buildMessageUrl(
          callbackUrl,
          "error",
          `Linha ${index + 1}: ${error instanceof Error ? error.message : "falha ao importar participante."}`,
          { field: "bulkEntries" },
        ),
      );
    }
  }

  revalidatePath("/dashboard");
  revalidatePath(callbackUrl);
  revalidatePath(`/rachas/${racha.slug}`);

  const summaryParts = [`${importedCount} participante(s) importado(s)`];

  if (goalkeeperCount > 0) {
    summaryParts.push(`${goalkeeperCount} goleiro(s) confirmado(s)`);
  }

  if (waitlistCount > 0) {
    summaryParts.push(`${waitlistCount} na lista de espera`);
  }

  redirect(
    buildMessageUrl(
      callbackUrl,
      "success",
      `${summaryParts.join(" • ")} com sucesso.`,
    ),
  );
}

export async function updateOrganizerEnrollmentLevelAction(formData: FormData) {
  const user = await requireUser("/dashboard");

  const parsed = organizerUpdateEnrollmentLevelSchema.safeParse({
    enrollmentId: getStringValue(formData, "enrollmentId"),
    participantLevel: getStringValue(formData, "participantLevel"),
  });

  if (!parsed.success) {
    redirect(
      buildMessageUrl(
        "/dashboard",
        "error",
        parsed.error.issues[0]?.message ??
          "Não foi possível atualizar o nível.",
      ),
    );
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: parsed.data.enrollmentId },
    include: { racha: true },
  });

  if (
    !enrollment ||
    !(await canUserManageRacha({
      userId: user.id,
      rachaId: enrollment.rachaId,
      organizerId: enrollment.racha.organizerId,
    }))
  ) {
    redirect(
      buildMessageUrl("/dashboard", "error", "Participante não encontrado."),
    );
  }

  await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: {
      participantLevel: parsed.data.participantLevel,
    },
  });

  const callbackUrl = `/dashboard/rachas/${enrollment.rachaId}/edit`;

  revalidatePath(callbackUrl);
  revalidatePath(`/rachas/${enrollment.racha.slug}`);
  revalidatePath("/dashboard");

  redirect(
    buildMessageUrl(
      callbackUrl,
      "success",
      "Nível do participante atualizado.",
    ),
  );
}

export async function updateOrganizerEnrollmentStatusAction(
  formData: FormData,
) {
  const user = await requireUser("/dashboard");

  const parsed = organizerUpdateEnrollmentStatusSchema.safeParse({
    enrollmentId: getStringValue(formData, "enrollmentId"),
    status: getStringValue(formData, "status"),
    paymentStatus: getStringValue(formData, "paymentStatus"),
  });

  if (!parsed.success) {
    redirect(
      buildMessageUrl(
        "/dashboard",
        "error",
        parsed.error.issues[0]?.message ??
          "Não foi possível atualizar o status da inscrição.",
      ),
    );
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: parsed.data.enrollmentId },
    include: { racha: true },
  });

  if (
    !enrollment ||
    !(await canUserManageRacha({
      userId: user.id,
      rachaId: enrollment.rachaId,
      organizerId: enrollment.racha.organizerId,
    }))
  ) {
    redirect(
      buildMessageUrl("/dashboard", "error", "Participante não encontrado."),
    );
  }

  await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: buildEnrollmentStatusUpdate({
      status: parsed.data.status,
      paymentStatus: parsed.data.paymentStatus,
      canceledAt: enrollment.canceledAt,
      refundRequestedAt: enrollment.refundRequestedAt,
    }),
  });

  const callbackUrl = `/dashboard/rachas/${enrollment.rachaId}/edit`;

  revalidatePath(callbackUrl);
  revalidatePath(`/rachas/${enrollment.racha.slug}`);
  revalidatePath("/dashboard");

  redirect(
    buildMessageUrl(
      callbackUrl,
      "success",
      "Status do participante atualizado.",
    ),
  );
}

export async function cancelPendingPaymentEnrollmentsAction(
  formData: FormData,
) {
  const user = await requireUser("/dashboard");

  const parsed = organizerBulkCancelPendingEnrollmentsSchema.safeParse({
    rachaId: getStringValue(formData, "rachaId"),
  });

  if (!parsed.success) {
    redirect(
      buildMessageUrl(
        "/dashboard",
        "error",
        parsed.error.issues[0]?.message ??
          "Não foi possível cancelar as inscrições pendentes.",
      ),
    );
  }

  const racha = await prisma.racha.findUnique({
    where: { id: parsed.data.rachaId },
    select: {
      id: true,
      slug: true,
      organizerId: true,
      enrollments: {
        where: {
          status: {
            not: ParticipantStatus.CANCELED,
          },
          paymentStatus: {
            in: [PaymentStatus.PENDING, PaymentStatus.PROOF_SENT],
          },
        },
        select: {
          id: true,
          participantPosition: true,
        },
      },
    },
  });

  if (
    !racha ||
    !(await canUserManageRacha({
      userId: user.id,
      rachaId: racha.id,
      organizerId: racha.organizerId,
    }))
  ) {
    redirect(buildMessageUrl("/dashboard", "error", "Racha não encontrado."));
  }

  const enrollmentIds = racha.enrollments
    .filter(
      (enrollment) => !isGoalkeeperPosition(enrollment.participantPosition),
    )
    .map((enrollment) => enrollment.id);

  const callbackUrl = `/dashboard/rachas/${racha.id}/edit`;

  if (!enrollmentIds.length) {
    redirect(
      buildMessageUrl(
        callbackUrl,
        "error",
        "Nenhuma inscrição pendente de pagamento foi encontrada para cancelamento.",
      ),
    );
  }

  const result = await prisma.enrollment.updateMany({
    where: {
      id: {
        in: enrollmentIds,
      },
    },
    data: {
      status: ParticipantStatus.CANCELED,
      canceledAt: new Date(),
    },
  });

  revalidatePath(callbackUrl);
  revalidatePath(`/rachas/${racha.slug}`);
  revalidatePath("/dashboard");

  redirect(
    buildMessageUrl(
      callbackUrl,
      "success",
      `${result.count} inscrição(ões) pendente(s) cancelada(s).`,
    ),
  );
}

export async function removeOrganizerEnrollmentAction(formData: FormData) {
  const user = await requireUser("/dashboard");

  const parsed = organizerRemoveEnrollmentSchema.safeParse({
    enrollmentId: getStringValue(formData, "enrollmentId"),
  });

  if (!parsed.success) {
    redirect(
      buildMessageUrl(
        "/dashboard",
        "error",
        parsed.error.issues[0]?.message ??
          "Não foi possível remover o participante.",
      ),
    );
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: parsed.data.enrollmentId },
    include: { racha: true },
  });

  if (
    !enrollment ||
    !(await canUserManageRacha({
      userId: user.id,
      rachaId: enrollment.rachaId,
      organizerId: enrollment.racha.organizerId,
    }))
  ) {
    redirect(
      buildMessageUrl("/dashboard", "error", "Participante não encontrado."),
    );
  }

  if (
    enrollment.status === ParticipantStatus.CANCELED &&
    enrollment.paymentStatus === PaymentStatus.REFUNDED
  ) {
    redirect(
      buildMessageUrl(
        `/dashboard/rachas/${enrollment.rachaId}/edit`,
        "error",
        "Essa inscrição já foi finalizada.",
      ),
    );
  }

  await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: {
      status: ParticipantStatus.CANCELED,
      paymentStatus:
        enrollment.paymentStatus === PaymentStatus.PAID
          ? PaymentStatus.REFUND_REQUESTED
          : enrollment.paymentStatus,
      canceledAt: new Date(),
      refundRequestedAt:
        enrollment.paymentStatus === PaymentStatus.PAID
          ? new Date()
          : enrollment.refundRequestedAt,
      notes:
        `${enrollment.notes ?? ""}\n\n[Remoção pelo organizador]\nParticipante removido da lista do racha.`.trim(),
    },
  });

  const callbackUrl = `/dashboard/rachas/${enrollment.rachaId}/edit`;

  revalidatePath(callbackUrl);
  revalidatePath(`/rachas/${enrollment.racha.slug}`);
  revalidatePath("/dashboard");

  redirect(
    buildMessageUrl(
      callbackUrl,
      "success",
      enrollment.paymentStatus === PaymentStatus.PAID
        ? "Participante removido e marcado para reembolso."
        : "Participante removido com sucesso.",
    ),
  );
}

export async function toggleOrganizerNextRachaBlockAction(formData: FormData) {
  const user = await requireUser("/dashboard");

  const parsed = organizerToggleNextRachaBlockSchema.safeParse({
    enrollmentId: getStringValue(formData, "enrollmentId"),
    active: getStringValue(formData, "active") === "true",
    reason: getStringValue(formData, "reason"),
  });

  if (!parsed.success) {
    redirect(
      buildMessageUrl(
        "/dashboard",
        "error",
        parsed.error.issues[0]?.message ??
          "Não foi possível atualizar o bloqueio.",
      ),
    );
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: parsed.data.enrollmentId },
    include: { racha: true },
  });

  if (
    !enrollment ||
    !(await canUserManageRacha({
      userId: user.id,
      rachaId: enrollment.rachaId,
      organizerId: enrollment.racha.organizerId,
    }))
  ) {
    redirect(
      buildMessageUrl("/dashboard", "error", "Participante não encontrado."),
    );
  }

  const callbackUrl = `/dashboard/rachas/${enrollment.rachaId}/edit`;
  const organizerId = enrollment.racha.organizerId;

  if (!parsed.data.active) {
    await prisma.organizerParticipantBlock.deleteMany({
      where: {
        organizerId,
        userId: enrollment.userId,
      },
    });

    revalidatePath(callbackUrl);
    revalidatePath("/dashboard");

    redirect(
      buildMessageUrl(
        callbackUrl,
        "success",
        "Bloqueio removido para os próximos rachas.",
      ),
    );
  }

  const nextRacha = await prisma.racha.findFirst({
    where: {
      organizerId,
      status: "PUBLISHED",
      eventDate: {
        gt: enrollment.racha.eventDate,
      },
    },
    orderBy: {
      eventDate: "asc",
    },
    select: { id: true },
  });

  await prisma.organizerParticipantBlock.upsert({
    where: {
      organizerId_userId: {
        organizerId,
        userId: enrollment.userId,
      },
    },
    create: {
      organizerId,
      userId: enrollment.userId,
      blockedByEnrollmentId: enrollment.id,
      active: true,
      reason: parsed.data.reason || null,
      anchorEventDate: enrollment.racha.eventDate,
      targetRachaId: nextRacha?.id || null,
    },
    update: {
      blockedByEnrollmentId: enrollment.id,
      active: true,
      reason: parsed.data.reason || null,
      anchorEventDate: enrollment.racha.eventDate,
      targetRachaId: nextRacha?.id || null,
    },
  });

  revalidatePath(callbackUrl);
  revalidatePath("/dashboard");

  redirect(
    buildMessageUrl(
      callbackUrl,
      "success",
      nextRacha
        ? "Participante bloqueado para o próximo racha deste organizador."
        : "Participante bloqueado para o próximo racha que for criado.",
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

  if (
    !enrollment ||
    !(await canUserManageRacha({
      userId: user.id,
      rachaId: enrollment.rachaId,
      organizerId: enrollment.racha.organizerId,
    }))
  ) {
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

  if (
    !enrollment ||
    !(await canUserManageRacha({
      userId: user.id,
      rachaId: enrollment.rachaId,
      organizerId: enrollment.racha.organizerId,
    }))
  ) {
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

  if (
    !enrollment ||
    !(await canUserManageRacha({
      userId: user.id,
      rachaId: enrollment.rachaId,
      organizerId: enrollment.racha.organizerId,
    }))
  ) {
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

export async function addRachaAdminAction(formData: FormData) {
  const user = await requireUser("/dashboard");

  const parsed = organizerAddRachaAdminSchema.safeParse({
    rachaId: getStringValue(formData, "rachaId"),
    adminUserId: getStringValue(formData, "adminUserId"),
  });

  if (!parsed.success) {
    redirect(
      buildMessageUrl(
        "/dashboard",
        "error",
        parsed.error.issues[0]?.message ??
          "Não foi possível adicionar o administrador.",
      ),
    );
  }

  const callbackUrl = `/dashboard/rachas/${parsed.data.rachaId}/edit`;

  const racha = await prisma.racha.findUnique({
    where: { id: parsed.data.rachaId },
    select: { id: true, organizerId: true },
  });

  if (
    !racha ||
    !(await canUserManageRacha({
      userId: user.id,
      rachaId: parsed.data.rachaId,
      organizerId: racha.organizerId,
    }))
  ) {
    redirect(buildMessageUrl("/dashboard", "error", "Racha não encontrado."));
  }

  const adminUser = await prisma.user.findUnique({
    where: { id: parsed.data.adminUserId },
    select: { id: true },
  });

  if (!adminUser) {
    redirect(
      buildMessageUrl(
        callbackUrl,
        "error",
        "Usuário selecionado não foi encontrado.",
      ),
    );
  }

  if (adminUser.id === racha.organizerId) {
    redirect(
      buildMessageUrl(
        callbackUrl,
        "error",
        "Esse usuário já é o organizador principal do racha.",
      ),
    );
  }

  const existingRole = await prisma.rachaAdmin.findUnique({
    where: {
      rachaId_userId: {
        rachaId: racha.id,
        userId: adminUser.id,
      },
    },
    select: { id: true },
  });

  if (existingRole) {
    redirect(
      buildMessageUrl(
        callbackUrl,
        "error",
        "Esse usuário já está como admin deste racha.",
      ),
    );
  }

  await prisma.rachaAdmin.create({
    data: {
      rachaId: racha.id,
      userId: adminUser.id,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath(callbackUrl);

  redirect(
    buildMessageUrl(
      callbackUrl,
      "success",
      "Administrador adicionado ao racha com sucesso.",
    ),
  );
}

export async function removeRachaAdminAction(formData: FormData) {
  const user = await requireUser("/dashboard");

  const parsed = organizerRemoveRachaAdminSchema.safeParse({
    rachaId: getStringValue(formData, "rachaId"),
    adminUserId: getStringValue(formData, "adminUserId"),
  });

  if (!parsed.success) {
    redirect(
      buildMessageUrl(
        "/dashboard",
        "error",
        parsed.error.issues[0]?.message ??
          "Não foi possível remover o administrador.",
      ),
    );
  }

  const callbackUrl = `/dashboard/rachas/${parsed.data.rachaId}/edit`;

  const racha = await prisma.racha.findUnique({
    where: { id: parsed.data.rachaId },
    select: { id: true, organizerId: true },
  });

  if (
    !racha ||
    !(await canUserManageRacha({
      userId: user.id,
      rachaId: parsed.data.rachaId,
      organizerId: racha.organizerId,
    }))
  ) {
    redirect(buildMessageUrl("/dashboard", "error", "Racha não encontrado."));
  }

  if (parsed.data.adminUserId === racha.organizerId) {
    redirect(
      buildMessageUrl(
        callbackUrl,
        "error",
        "O organizador principal não pode ser removido.",
      ),
    );
  }

  const removed = await prisma.rachaAdmin.deleteMany({
    where: {
      rachaId: parsed.data.rachaId,
      userId: parsed.data.adminUserId,
    },
  });

  if (removed.count === 0) {
    redirect(
      buildMessageUrl(
        callbackUrl,
        "error",
        "Administrador não encontrado nesse racha.",
      ),
    );
  }

  revalidatePath("/dashboard");
  revalidatePath(callbackUrl);

  redirect(
    buildMessageUrl(
      callbackUrl,
      "success",
      "Administrador removido com sucesso.",
    ),
  );
}

export async function updateUserProfileGenderAction(formData: FormData) {
  const user = await requireUser("/minhas-inscricoes");
  const isFemale =
    formData.get("isFemale") === "true" ||
    formData.get("isFemale") === "on" ||
    formData.get("isFemale") === "1";

  await prisma.user.update({
    where: { id: user.id },
    data: { isFemale },
  });

  // Also sync current active/waitlist enrollments for this user
  await prisma.enrollment.updateMany({
    where: { userId: user.id },
    data: { isFemale },
  });

  revalidatePath("/minhas-inscricoes");
  revalidatePath("/dashboard");

  redirect(
    buildMessageUrl(
      "/minhas-inscricoes",
      "success",
      "Perfil atualizado com sucesso.",
    ),
  );
}

export async function changePasswordAction(formData: FormData) {
  const user = await requireUser("/auth/signin");
  const callbackUrl = getStringValue(formData, "callbackUrl") || "/";

  const currentPassword = getStringValue(formData, "currentPassword");
  const newPassword = getStringValue(formData, "newPassword");
  const confirmPassword = getStringValue(formData, "confirmPassword");

  if (!newPassword || newPassword.length < 6) {
    redirect(
      buildMessageUrl(
        `/auth/change-password?callbackUrl=${encodeURIComponent(callbackUrl)}`,
        "error",
        "A nova senha deve ter no mínimo 6 caracteres.",
      ),
    );
  }

  if (newPassword !== confirmPassword) {
    redirect(
      buildMessageUrl(
        `/auth/change-password?callbackUrl=${encodeURIComponent(callbackUrl)}`,
        "error",
        "A confirmação de senha não confere.",
      ),
    );
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  if (dbUser?.passwordHash) {
    if (!currentPassword) {
      redirect(
        buildMessageUrl(
          `/auth/change-password?callbackUrl=${encodeURIComponent(callbackUrl)}`,
          "error",
          "Informe sua senha atual.",
        ),
      );
    }
    const isCurrentPasswordValid = await compare(
      currentPassword,
      dbUser.passwordHash,
    );
    if (!isCurrentPasswordValid) {
      redirect(
        buildMessageUrl(
          `/auth/change-password?callbackUrl=${encodeURIComponent(callbackUrl)}`,
          "error",
          "A senha atual está incorreta.",
        ),
      );
    }
  }

  const newPasswordHash = await hash(newPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newPasswordHash,
      mustChangePassword: false,
    },
  });

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/minhas-inscricoes");

  redirect(
    buildMessageUrl(
      callbackUrl,
      "success",
      "Sua senha foi alterada com sucesso!",
    ),
  );
}

export async function updateProfileAction(formData: FormData) {
  const user = await requireUser("/auth/signin");

  const name = getStringValue(formData, "name");
  const nickname = getStringValue(formData, "nickname");
  const rawPhone = getStringValue(formData, "phone");
  const email = getStringValue(formData, "email")?.toLowerCase().trim();

  if (!name || name.trim().length < 2) {
    redirect(
      buildMessageUrl(
        "/perfil",
        "error",
        "Informe um nome válido com pelo menos 2 caracteres.",
      ),
    );
  }

  if (!email || !email.includes("@")) {
    redirect(buildMessageUrl("/perfil", "error", "Informe um e-mail válido."));
  }

  const emailInUse = await prisma.user.findFirst({
    where: {
      email,
      NOT: { id: user.id },
    },
  });

  if (emailInUse) {
    redirect(
      buildMessageUrl(
        "/perfil",
        "error",
        "Este e-mail já está em uso por outra conta.",
      ),
    );
  }

  let phone: string | null = null;
  if (rawPhone && rawPhone.trim().length > 0) {
    phone = normalizePhoneValue(rawPhone);
    const phoneInUse = await prisma.user.findFirst({
      where: {
        phone,
        NOT: { id: user.id },
      },
    });

    if (phoneInUse) {
      redirect(
        buildMessageUrl(
          "/perfil",
          "error",
          "Este telefone já está cadastrado em outra conta.",
        ),
      );
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: name.trim(),
      nickname: nickname?.trim() || null,
      phone,
      email,
    },
  });

  revalidatePath("/");
  revalidatePath("/perfil");
  revalidatePath("/dashboard");
  revalidatePath("/minhas-inscricoes");

  redirect(
    buildMessageUrl(
      "/perfil",
      "success",
      "Seu perfil foi atualizado com sucesso!",
    ),
  );
}

export async function updateOrganizerEnrollmentPositionAction(
  formData: FormData,
) {
  const user = await requireUser("/dashboard");

  const enrollmentId = getStringValue(formData, "enrollmentId");
  const participantPosition = getStringValue(formData, "participantPosition");

  if (!enrollmentId || !participantPosition) {
    redirect(
      buildMessageUrl(
        "/dashboard",
        "error",
        "Dados inválidos para alterar posição.",
      ),
    );
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { racha: true },
  });

  if (
    !enrollment ||
    !(await canUserManageRacha({
      userId: user.id,
      rachaId: enrollment.rachaId,
      organizerId: enrollment.racha.organizerId,
    }))
  ) {
    redirect(
      buildMessageUrl("/dashboard", "error", "Participante não encontrado."),
    );
  }

  await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: {
      participantPosition,
    },
  });

  const callbackUrl = `/dashboard/rachas/${enrollment.rachaId}/edit`;

  revalidatePath(callbackUrl);
  revalidatePath(`/rachas/${enrollment.racha.slug}`);
  revalidatePath("/dashboard");

  redirect(
    buildMessageUrl(
      callbackUrl,
      "success",
      "Posição do participante atualizada com sucesso.",
    ),
  );
}

export async function toggleOrganizerEnrollmentFemaleAction(
  formData: FormData,
) {
  const user = await requireUser("/dashboard");

  const enrollmentId = getStringValue(formData, "enrollmentId");
  const isFemaleStr = getStringValue(formData, "isFemale");
  const isFemale = isFemaleStr === "true";

  if (!enrollmentId) {
    redirect(
      buildMessageUrl("/dashboard", "error", "Participante não encontrado."),
    );
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { racha: true },
  });

  if (
    !enrollment ||
    !(await canUserManageRacha({
      userId: user.id,
      rachaId: enrollment.rachaId,
      organizerId: enrollment.racha.organizerId,
    }))
  ) {
    redirect(
      buildMessageUrl("/dashboard", "error", "Participante não encontrado."),
    );
  }

  await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: {
      isFemale,
    },
  });

  const callbackUrl = `/dashboard/rachas/${enrollment.rachaId}/edit`;

  revalidatePath(callbackUrl);
  revalidatePath(`/rachas/${enrollment.racha.slug}`);
  revalidatePath("/dashboard");

  redirect(
    buildMessageUrl(
      callbackUrl,
      "success",
      isFemale
        ? "Participante marcada como mulher."
        : "Marcação de mulher removida.",
    ),
  );
}
