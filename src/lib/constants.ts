export const modalities = [
  { value: "FUTEBOL", label: "Futebol" },
  { value: "FUTSAL", label: "Futsal" },
  { value: "VOLEI", label: "Vôlei" },
  { value: "BASQUETE", label: "Basquete" },
  { value: "BEACH_TENNIS", label: "Beach Tennis" },
  { value: "TENIS", label: "Tênis" },
  { value: "CORRIDA", label: "Corrida" },
  { value: "OUTRO", label: "Outro" },
] as const;

export const futebolTypeOptions = [
  {
    value: "FUT11",
    label: "Fut11 (10 de linha + 1 goleiro)",
    lineLimit: 10,
    goalkeepers: 1,
  },
  {
    value: "FUT7",
    label: "Fut7 (6 de linha + 1 goleiro)",
    lineLimit: 6,
    goalkeepers: 1,
  },
  {
    value: "FUT6",
    label: "Fut6 (5 de linha + 1 goleiro)",
    lineLimit: 5,
    goalkeepers: 1,
  },
] as const;

export const voleiTypeOptions = [
  {
    value: "AREIA_QUARTETO_MISTO",
    label: "Areia quarteto misto",
    minSetter: true,
  },
  {
    value: "AREIA_QUARTETO_MASCULINO",
    label: "Areia quarteto masculino",
    minSetter: true,
  },
  {
    value: "AREIA_QUARTETO_FEMININO",
    label: "Areia quarteto feminino",
    minSetter: true,
  },
  { value: "AREIA_DUPLA_MISTA", label: "Areia dupla mista", minSetter: false },
  {
    value: "AREIA_DUPLA_FEMININO",
    label: "Areia dupla feminino",
    minSetter: false,
  },
  {
    value: "AREIA_DUPLA_MASCULINO",
    label: "Areia dupla masculino",
    minSetter: false,
  },
  {
    value: "QUADRA_CHEIA",
    label: "Quadra cheia (6 por equipe)",
    minSetter: true,
  },
  {
    value: "QUADRA_QUARTETO",
    label: "Quadra quarteto (4 por equipe)",
    minSetter: true,
  },
] as const;

export const visibilityOptions = [
  { value: "OPEN", label: "Aberto para todos" },
  { value: "PRIVATE", label: "Privado com chave secreta" },
] as const;

export const levelOptions = [
  { value: "INICIANTE", label: "Iniciante" },
  { value: "INTERMEDIARIO", label: "Intermediário" },
  { value: "AVANCADO", label: "Avançado" },
] as const;

export const positionOptionsFutebol = [
  "Goleiro",
  "Zagueiro",
  "Lateral",
  "Meio-campo",
  "Atacante",
  "Versátil",
  "Outro",
] as const;

export const positionOptionsVolei = [
  "Levantador",
  "Oposto",
  "Ponteiro",
  "Central",
  "Líbero",
  "Versátil",
  "Outro",
] as const;

export const positionOptions = [
  "Goleiro",
  "Zagueiro",
  "Lateral",
  "Meio-campo",
  "Atacante",
  "Levantador",
  "Oposto",
  "Ponteiro",
  "Central",
  "Líbero",
  "Armador",
  "Ala",
  "Pivô",
  "Versátil",
  "Outro",
] as const;

export const modalityLabels = Object.fromEntries(
  modalities.map((item) => [item.value, item.label]),
) as Record<string, string>;

export const futebolTypeLabels = Object.fromEntries(
  futebolTypeOptions.map((item) => [item.value, item.label]),
) as Record<string, string>;

export const voleiTypeLabels = Object.fromEntries(
  voleiTypeOptions.map((item) => [item.value, item.label]),
) as Record<string, string>;

export const visibilityLabels = Object.fromEntries(
  visibilityOptions.map((item) => [item.value, item.label]),
) as Record<string, string>;

export const levelLabels = Object.fromEntries(
  levelOptions.map((item) => [item.value, item.label]),
) as Record<string, string>;

export const participantStatusLabels: Record<string, string> = {
  ACTIVE: "Confirmado",
  WAITLIST: "Lista de espera",
  CANCELED: "Cancelado",
};

export const paymentStatusLabels: Record<string, string> = {
  PENDING: "Pendente",
  PROOF_SENT: "PIX informado",
  PAID: "Pago",
  REFUND_REQUESTED: "Reembolso solicitado",
  REFUNDED: "Reembolsado",
};

/** Tipos de vôlei que suportam levantador fixo (≥ quarteto) */
export const voleiTypesWithSetter = new Set([
  "AREIA_QUARTETO_MISTO",
  "AREIA_QUARTETO_MASCULINO",
  "AREIA_QUARTETO_FEMININO",
  "QUADRA_CHEIA",
  "QUADRA_QUARTETO",
]);
