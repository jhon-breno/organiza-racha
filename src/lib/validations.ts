import { z } from "zod";

export const rachaFormSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().min(3, "Informe o nome do racha."),
    modality: z.string().min(1, "Selecione a modalidade."),
    description: z
      .string()
      .max(500, "A descrição pode ter no máximo 500 caracteres.")
      .optional()
      .or(z.literal("")),
    rules: z.string().min(10, "Descreva as regras do racha."),
    athleteLimit: z.coerce
      .number()
      .int()
      .min(4, "Informe pelo menos 4 atletas.")
      .max(200, "Limite máximo de 200 atletas."),
    eventDate: z.string().min(1, "Informe a data do racha."),
    eventTime: z.string().min(1, "Informe o horário do racha."),
    locationName: z.string().min(3, "Informe o nome do local."),
    address: z.string().min(5, "Informe o endereço completo."),
    city: z.string().min(2, "Informe a cidade."),
    state: z
      .string()
      .max(2, "Use a sigla do estado.")
      .optional()
      .or(z.literal("")),
    mapsQuery: z.string().optional().or(z.literal("")),
    price: z.coerce.number().min(0, "O valor deve ser maior ou igual a zero."),
    organizerDisplayName: z.string().min(2, "Informe o nome do organizador."),
    phoneWhatsapp: z.string().min(8, "Informe um WhatsApp válido."),
    whatsappGroupUrl: z
      .union([
        z.literal(""),
        z.string().url("Informe um link válido para o grupo do WhatsApp."),
      ])
      .optional(),
    pixKey: z.string().min(3, "Informe a chave PIX."),
    coverImageUrl: z
      .union([
        z.literal(""),
        z.string().url("Informe uma URL válida para a capa."),
      ])
      .optional(),
    profileImageUrl: z
      .union([
        z.literal(""),
        z.string().url("Informe uma URL válida para o perfil."),
      ])
      .optional(),
    visibility: z.enum(["OPEN", "PRIVATE"]),
    accessKey: z.string().optional().or(z.literal("")),
    cancellationWindowHours: z.coerce
      .number()
      .int()
      .min(1, "O prazo mínimo é de 1 hora.")
      .max(48, "O prazo máximo é de 48 horas."),
    // Futebol
    futebolType: z.string().optional().or(z.literal("")),
    goalkeeperLimit: z.coerce
      .number()
      .int()
      .min(1)
      .max(4)
      .optional()
      .or(z.literal("")),
    // Vôlei
    voleiType: z.string().optional().or(z.literal("")),
    hasFixedSetter: z.coerce.boolean().optional(),
    setterLimit: z.coerce
      .number()
      .int()
      .min(1)
      .max(8)
      .optional()
      .or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.visibility === "PRIVATE" && !data.accessKey?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["accessKey"],
        message: "Informe a chave secreta para rachas privados.",
      });
    }
  });

export const enrollmentSchema = z.object({
  rachaId: z.string().min(1),
  slug: z.string().min(1),
  participantName: z.string().min(2, "Informe seu nome."),
  participantPhone: z.string().min(8, "Informe um telefone válido."),
  participantPosition: z.string().min(2, "Informe sua posição."),
  participantLevel: z.enum(["INICIANTE", "INTERMEDIARIO", "AVANCADO"]),
  notes: z
    .string()
    .max(280, "Observações com no máximo 280 caracteres.")
    .optional()
    .or(z.literal("")),
  acceptedRules: z.coerce
    .boolean()
    .refine((value) => value, "Você deve aceitar as regras."),
  pixPaid: z.coerce
    .boolean()
    .refine((value) => value, "Confirme que realizou o pagamento via PIX."),
  accessKey: z.string().optional().or(z.literal("")),
});

export const demoAccessSchema = z.object({
  name: z.string().min(2, "Informe seu nome."),
  email: z.string().email("Informe um e-mail válido."),
  callbackUrl: z.string().optional().or(z.literal("")),
});

export function combineDateAndTime(date: string, time: string) {
  const isoString = `${date}T${time}:00`;
  const parsed = new Date(isoString);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Data ou horário inválido.");
  }

  return parsed;
}
