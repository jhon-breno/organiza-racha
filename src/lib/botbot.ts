import { buildPixPaymentPayload } from "@/lib/pix";
import { prisma } from "@/lib/prisma";
import { formatCurrencyFromCents, getTimeZoneParts } from "@/lib/utils";

export type BaseRachaMessageDetails = {
  participantName: string;
  participantNickname?: string | null;
  rachaTitle: string;
  rachaSlug?: string | null;
  rachaUrl?: string | null;
  eventDate: Date;
  eventEndDate?: Date | null;
  locationName?: string | null;
  address?: string | null;
};

export type PaidEnrollmentMessageDetails = BaseRachaMessageDetails & {
  priceInCents?: number;
  pixKey?: string | null;
  pixHolderName?: string | null;
  organizerDisplayName?: string | null;
  organizerPhoneWhatsapp?: string | null;
  rachaCity?: string | null;
};

export type PaymentConfirmedMessageDetails = BaseRachaMessageDetails & {
  spotNumber: number;
  maxAthletes: number;
};

export type AthleteCancellationMessageDetails = BaseRachaMessageDetails & {
  wasPaid: boolean;
  priceInCents?: number;
};

export type OrganizerRefundAlertDetails = {
  organizerPhone: string;
  athleteName: string;
  athleteNickname?: string | null;
  athletePhone: string;
  rachaTitle: string;
  rachaSlug?: string | null;
  eventDate: Date;
  priceInCents: number;
  refundPixKey?: string | null;
  refundReason?: string | null;
};

/**
 * Obtém a URL base da aplicação
 */
export function getAppBaseUrl(): string {
  const envUrl =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  if (envUrl) {
    return envUrl.trim().replace(/\/$/, "");
  }

  return "";
}

/**
 * Monta o link para o racha
 */
export function getRachaFullUrl(
  slug?: string | null,
  customUrl?: string | null,
): string {
  if (customUrl) return customUrl;
  if (!slug) return "";
  const baseUrl = getAppBaseUrl();
  return baseUrl ? `${baseUrl}/rachas/${slug}` : `/rachas/${slug}`;
}

/**
 * Normaliza o telefone para o formato internacional exigido pelo WhatsApp (BotBot)
 * Exemplos aceitos: "85999999999", "(85) 99999-9999", "5585999999999", "+55 85 9 9999-9999"
 */
export function normalizePhoneForWhatsapp(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  // Se já tiver 12 ou 13 dígitos e começar com 55 (Brasil)
  if (
    (digits.length === 12 || digits.length === 13) &&
    digits.startsWith("55")
  ) {
    return digits;
  }

  // Se tiver 10 ou 11 dígitos (DDD + número brasileiro)
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
}

/**
 * Monta link do WhatsApp no formato https://wa.me/55...
 */
export function buildWhatsappLink(phone?: string | null): string {
  if (!phone) return "";
  const normalized = normalizePhoneForWhatsapp(phone);
  return `https://wa.me/${normalized}`;
}

/**
 * Formata data e hora para exibição
 */
function formatEventDateTime(
  eventDate: Date,
  eventEndDate?: Date | null,
): { dateStr: string; timeStr: string } {
  const parts = getTimeZoneParts(eventDate);
  const dateStr = `${parts.day}/${parts.month}/${parts.year}`;

  let timeStr = `${parts.hour}:${parts.minute}`;
  if (eventEndDate) {
    const endParts = getTimeZoneParts(eventEndDate);
    timeStr = `${parts.hour}:${parts.minute} às ${endParts.hour}:${endParts.minute}`;
  }

  return { dateStr, timeStr };
}

/**
 * 1. Mensagem de Solicitação para Racha Pago (Aguardando Pagamento)
 * Conforme solicitado:
 * Olá, *{Nome}*!
 * Recebemos sua solicitação para o racha *{Título}*.
 * Para que sua inscrição seja concluída é necessário que realize o pagamento ao organizador.
 *
 * Segue os dados do pagemento:
 * Valor: *R$ 10,00*
 * Nome: {Nome configurado pelo usuario organizador do racha no pix}
 *
 * WhatsApp Org para envio do comprovante: https://wa.me/...
 * ...
 */
export function buildPaidEnrollmentRequestMessage(
  options: PaidEnrollmentMessageDetails,
): string {
  const { dateStr, timeStr } = formatEventDateTime(
    options.eventDate,
    options.eventEndDate,
  );
  const nameToDisplay =
    options.participantNickname?.trim() || options.participantName?.trim();
  const rachaLink = getRachaFullUrl(options.rachaSlug, options.rachaUrl);
  const organizerWaLink = options.organizerPhoneWhatsapp
    ? buildWhatsappLink(options.organizerPhoneWhatsapp)
    : "";
  const holderName =
    options.pixHolderName?.trim() ||
    options.organizerDisplayName?.trim() ||
    "Organizador";

  const lines = [
    nameToDisplay ? `Olá, *${nameToDisplay}*!` : "Olá!",
    `Recebemos sua solicitação para o racha *${options.rachaTitle}*.`,
    "Para que sua inscrição seja concluída é necessário que realize o pagamento ao organizador.",
    "",
    "Segue os dados do pagemento:",
  ];

  if (options.priceInCents && options.priceInCents > 0) {
    lines.push(`Valor: *${formatCurrencyFromCents(options.priceInCents)}*`);
  }

  lines.push(`Nome: ${holderName}`);

  if (organizerWaLink) {
    lines.push("");
    lines.push(`WhatsApp Org para envio do comprovante: ${organizerWaLink}`);
  }

  lines.push(
    "",
    "Detalhes do racha:",
    `📅 Data: ${dateStr}`,
    `⏰ Horário: ${timeStr}`,
  );

  if (options.locationName) {
    const loc = options.address
      ? `📍 Local: ${options.locationName} (${options.address})`
      : `📍 Local: ${options.locationName}`;
    lines.push(loc);
  }

  if (rachaLink) {
    lines.push(`🔗 Link do racha / Desistir: ${rachaLink}`);
  }

  lines.push(
    "",
    "Esperamos por você. Caso precise desistir da sua vaga, acesse o link acima para cancelar ou entre em contato com o organizador com antecedência para liberar a vaga para a lista de espera.",
    "",
    "Abraço.",
    "Equipe Organiza Racha.",
  );

  return lines.join("\n");
}

/**
 * 2. Mensagem de Confirmação para Racha Gratuito
 */
export function buildFreeEnrollmentConfirmationMessage(
  options: BaseRachaMessageDetails,
): string {
  const { dateStr, timeStr } = formatEventDateTime(
    options.eventDate,
    options.eventEndDate,
  );
  const nameToDisplay =
    options.participantNickname?.trim() || options.participantName?.trim();
  const rachaLink = getRachaFullUrl(options.rachaSlug, options.rachaUrl);

  const lines = [
    nameToDisplay ? `Olá, *${nameToDisplay}*!` : "Olá!",
    `Sua inscrição no racha *${options.rachaTitle}* foi confirmada com sucesso! ✅`,
    "",
    `📅 Data: ${dateStr}`,
    `⏰ Horário: ${timeStr}`,
  ];

  if (options.locationName) {
    const loc = options.address
      ? `📍 Local: ${options.locationName} (${options.address})`
      : `📍 Local: ${options.locationName}`;
    lines.push(loc);
  }

  if (rachaLink) {
    lines.push(`🔗 Link do racha / Desistir: ${rachaLink}`);
  }

  lines.push(
    "",
    "Esperamos por você. Caso precise desistir da sua vaga, acesse o link acima para cancelar ou entre em contato com o organizador com antecedência para liberar a vaga para a lista de espera.",
    "",
    "Abraço.",
    "Equipe Organiza Racha.",
  );

  return lines.join("\n");
}

/**
 * 3. Mensagem quando o Organizador Confirma o Pagamento (Entrada na lista com posição)
 */
export function buildPaymentConfirmedMessage(
  options: PaymentConfirmedMessageDetails,
): string {
  const { dateStr, timeStr } = formatEventDateTime(
    options.eventDate,
    options.eventEndDate,
  );
  const nameToDisplay =
    options.participantNickname?.trim() || options.participantName?.trim();
  const rachaLink = getRachaFullUrl(options.rachaSlug, options.rachaUrl);

  const lines = [
    nameToDisplay ? `Olá, *${nameToDisplay}*!` : "Olá!",
    `Seu pagamento para o racha *${options.rachaTitle}* foi confirmado pelo organizador! 🎉`,
    "",
    "✅ *Você está confirmado(a) na lista oficial!*",
    `🏆 *Sua vaga:* #${options.spotNumber} de ${options.maxAthletes} atletas`,
    "",
    `📅 Data: ${dateStr}`,
    `⏰ Horário: ${timeStr}`,
  ];

  if (options.locationName) {
    const loc = options.address
      ? `📍 Local: ${options.locationName} (${options.address})`
      : `📍 Local: ${options.locationName}`;
    lines.push(loc);
  }

  if (rachaLink) {
    lines.push(`🔗 Link do racha / Desistir: ${rachaLink}`);
  }

  lines.push(
    "",
    "Bom jogo! Caso precise desistir, acesse o link acima com antecedência para liberar a vaga para a lista de espera.",
    "",
    "Abraço.",
    "Equipe Organiza Racha.",
  );

  return lines.join("\n");
}

/**
 * 4. Mensagem para o Atleta quando a Inscrição é Cancelada
 */
export function buildAthleteCancellationMessage(
  options: AthleteCancellationMessageDetails,
): string {
  const nameToDisplay =
    options.participantNickname?.trim() || options.participantName?.trim();
  const rachaLink = getRachaFullUrl(options.rachaSlug, options.rachaUrl);
  const priceFormatted = options.priceInCents
    ? formatCurrencyFromCents(options.priceInCents)
    : "";

  const lines = [
    nameToDisplay ? `Olá, *${nameToDisplay}*!` : "Olá!",
    `Confirmamos o cancelamento da sua inscrição no racha *${options.rachaTitle}*.`,
  ];

  if (options.wasPaid) {
    lines.push(
      "",
      `💰 Como sua inscrição era paga${priceFormatted ? ` (${priceFormatted})` : ""}, a solicitação de reembolso foi enviada ao organizador.`,
      "Por favor, aguarde o contato ou o processamento da devolução pelo organizador.",
    );
  } else {
    lines.push(
      "",
      "Sua vaga foi liberada com sucesso. Esperamos ver você em um próximo racha!",
    );
  }

  if (rachaLink) {
    lines.push("", `🔗 Link do racha: ${rachaLink}`);
  }

  lines.push("", "Abraço.", "Equipe Organiza Racha.");

  return lines.join("\n");
}

/**
 * 5. Mensagem para o Organizador quando o Atleta Cancela uma Inscrição Paga (Alerta de Reembolso)
 */
export function buildOrganizerRefundAlertMessage(
  options: OrganizerRefundAlertDetails,
): string {
  const parts = getTimeZoneParts(options.eventDate);
  const dateStr = `${parts.day}/${parts.month}/${parts.year}`;
  const athleteDisplay = options.athleteNickname?.trim()
    ? `${options.athleteName} (${options.athleteNickname})`
    : options.athleteName;
  const athleteWa = buildWhatsappLink(options.athletePhone);
  const priceFormatted = formatCurrencyFromCents(options.priceInCents);
  const rachaLink = getRachaFullUrl(options.rachaSlug);

  const lines = [
    "🔔 *Aviso ao Organizador (Organiza Racha)*",
    `O atleta *${athleteDisplay}* cancelou a inscrição no racha *${options.rachaTitle}* (${dateStr}).`,
    "",
    "⚠️ *SOLICITAÇÃO DE REEMBOLSO:*",
    `💰 *Valor pago:* ${priceFormatted}`,
    `📱 *WhatsApp do atleta:* ${athleteWa || options.athletePhone}`,
  ];

  if (options.refundPixKey) {
    lines.push(`🔑 *Chave PIX para devolução:* \`${options.refundPixKey}\``);
  }

  if (options.refundReason) {
    lines.push(`📝 *Motivo informado:* ${options.refundReason}`);
  }

  if (rachaLink) {
    lines.push("", `🔗 *Painel do racha:* ${rachaLink}`);
  }

  lines.push(
    "",
    "Por favor, realize a devolução e confirme o estorno no painel do racha.",
    "",
    "Organiza Racha Bot.",
  );

  return lines.join("\n");
}

/**
 * 6. Mensagem de Lembrete Padrão / Notificação Pré-jogo
 */
export function buildRachaReminderMessage(
  options: BaseRachaMessageDetails,
): string {
  const { dateStr, timeStr } = formatEventDateTime(
    options.eventDate,
    options.eventEndDate,
  );
  const nameToDisplay =
    options.participantNickname?.trim() || options.participantName?.trim();
  const rachaLink = getRachaFullUrl(options.rachaSlug, options.rachaUrl);

  const lines = [
    nameToDisplay ? `Olá, *${nameToDisplay}*!` : "Olá!",
    "Essa é uma mensagem automática de lembrete:",
    `Lembre que você está inscrito(a) no racha *${options.rachaTitle}*, dia *${dateStr}*, horário *${timeStr}*. ⚽🏐`,
  ];

  if (options.locationName) {
    const loc = options.address
      ? `📍 Local: ${options.locationName} (${options.address})`
      : `📍 Local: ${options.locationName}`;
    lines.push(loc);
  }

  if (rachaLink) {
    lines.push(`🔗 Link do racha / Desistir: ${rachaLink}`);
  }

  lines.push(
    "",
    "Esperamos por você. Caso precise desistir da sua vaga, acesse o link acima para cancelar ou entre em contato com o organizador com antecedência para liberar a vaga para a lista de espera.",
    "",
    "Abraço.",
    "Equipe Organiza Racha.",
  );

  return lines.join("\n");
}

/**
 * Envia uma mensagem de texto WhatsApp usando a API do BotBot (POST /api/v2/sendText)
 */
export async function sendBotbotWhatsappMessage(params: {
  to: string;
  message: string;
}): Promise<{ success: boolean; error?: string }> {
  const authKey = process.env.BOTBOT_AUTH_KEY;
  const appKey = process.env.BOTBOT_APP_KEY;
  const baseUrl = process.env.BOTBOT_API_URL || "https://botbot.chat";

  if (!authKey || !appKey) {
    console.warn(
      "[BotBot WhatsApp] Chaves de API não configuradas (BOTBOT_AUTH_KEY e BOTBOT_APP_KEY).",
    );
    return {
      success: false,
      error:
        "Chaves de integração do WhatsApp (BOTBOT_AUTH_KEY / BOTBOT_APP_KEY) não estão configuradas.",
    };
  }

  const formattedTo = normalizePhoneForWhatsapp(params.to);
  if (!formattedTo || formattedTo.length < 10) {
    return {
      success: false,
      error: `Número de WhatsApp inválido (${params.to}).`,
    };
  }

  try {
    const endpoint = `${baseUrl.replace(/\/+$/, "")}/api/v2/sendText`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authKey: authKey.trim(),
        appKey: appKey.trim(),
      },
      body: JSON.stringify({
        to: formattedTo,
        message: params.message,
        typingDelay: 1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(
        `[BotBot WhatsApp Error] HTTP ${response.status}: ${errorText || response.statusText}`,
      );
      return {
        success: false,
        error: `Falha no envio BotBot (${response.status}): ${errorText || response.statusText}`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error("[BotBot WhatsApp Exception]", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Erro desconhecido ao conectar com a API do BotBot.",
    };
  }
}

/**
 * Envia notificações para múltiplos participantes com intervalo de segurança
 */
export async function sendBotbotWhatsappMessages(
  recipients: Array<{
    to: string;
    message: string;
  }>,
  delayMs: number = 500,
): Promise<{ total: number; sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < recipients.length; i++) {
    const item = recipients[i];
    const result = await sendBotbotWhatsappMessage(item);
    if (result.success) {
      sent++;
    } else {
      failed++;
    }

    if (i < recipients.length - 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return { total: recipients.length, sent, failed };
}

/**
 * Processa os lembretes automáticos que já entraram na janela configurada.
 */
export async function processScheduledRachaReminders(): Promise<{
  rachas: number;
  total: number;
  sent: number;
  failed: number;
}> {
  const now = new Date();
  const scheduledRachas = await prisma.racha.findMany({
    where: {
      autoNotifyReminder: true,
      reminderSentAt: null,
      status: "PUBLISHED",
      eventDate: { gt: now },
    },
    include: {
      enrollments: {
        where: { status: { not: "CANCELED" } },
        include: { user: { select: { nickname: true } } },
      },
    },
  });

  let total = 0;
  let sent = 0;
  let failed = 0;
  let processedRachas = 0;

  for (const racha of scheduledRachas) {
    const hoursBefore = racha.autoNotifyHoursBefore ?? 1;
    const reminderAt = new Date(
      racha.eventDate.getTime() - hoursBefore * 60 * 60 * 1000,
    );

    if (now < reminderAt) continue;

    const recipients = racha.enrollments.map((enrollment) => ({
      to: enrollment.participantPhone,
      message: buildRachaReminderMessage({
        participantName: enrollment.participantName,
        participantNickname: enrollment.user.nickname,
        rachaTitle: racha.title,
        rachaSlug: racha.slug,
        eventDate: racha.eventDate,
        eventEndDate: racha.eventEndDate,
        locationName: racha.locationName,
        address: racha.address,
      }),
    }));

    const results = await sendBotbotWhatsappMessages(recipients);
    total += results.total;
    sent += results.sent;
    failed += results.failed;
    processedRachas++;

    if (results.failed === 0) {
      await prisma.racha.update({
        where: { id: racha.id },
        data: { reminderSentAt: new Date() },
      });
    }
  }

  return { rachas: processedRachas, total, sent, failed };
}

/**
 * Envia as mensagens de notificação de inscrição para racha pago:
 * 1. Mensagem principal com dados do pagamento e detalhes do racha
 * 2. Em seguida, após 5 segundos de intervalo, uma mensagem avulsa contendo SOMENTE o código PIX Copia e Cola
 */
export async function sendPaidEnrollmentWhatsappNotification(params: {
  to: string;
  details: PaidEnrollmentMessageDetails;
}): Promise<{ success: boolean; error?: string }> {
  const firstMessage = buildPaidEnrollmentRequestMessage(params.details);

  const res1 = await sendBotbotWhatsappMessage({
    to: params.to,
    message: firstMessage,
  });

  if (!res1.success) {
    return res1;
  }

  if (
    params.details.pixKey &&
    params.details.priceInCents &&
    params.details.priceInCents > 0
  ) {
    const pixPayload = buildPixPaymentPayload({
      pixKey: params.details.pixKey,
      amountInCents: params.details.priceInCents,
      merchantName:
        params.details.pixHolderName ||
        params.details.organizerDisplayName ||
        "ORGANIZADOR",
      merchantCity:
        params.details.rachaCity || params.details.locationName || "FORTALEZA",
      description: params.details.rachaTitle,
    });

    if (pixPayload) {
      // Intervalo de 5 segundos antes de enviar o código PIX Copia e Cola avulso
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await sendBotbotWhatsappMessage({
        to: params.to,
        message: pixPayload,
      });
    }
  }

  return { success: true };
}
