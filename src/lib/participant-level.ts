export const participantLevelValues = [
  "STAR_1",
  "STAR_2",
  "STAR_3",
  "STAR_4",
  "STAR_5",
  "INICIANTE",
  "INTERMEDIARIO",
  "AVANCADO",
] as const;

export const participantLevelOptionValues = [
  "STAR_1",
  "STAR_2",
  "STAR_3",
  "STAR_4",
  "STAR_5",
] as const;

export const participantLevelOptions = participantLevelOptionValues.map(
  (value, index) => ({
    value,
    label: `${index + 1} ${index === 0 ? "estrela" : "estrelas"}`,
    stars: index + 1,
    visual: "★".repeat(index + 1) + "☆".repeat(4 - index),
  }),
);

const participantLevelScoreMap: Record<string, number> = {
  STAR_1: 1,
  STAR_2: 2,
  STAR_3: 3,
  STAR_4: 4,
  STAR_5: 5,
  INICIANTE: 1,
  INTERMEDIARIO: 3,
  AVANCADO: 5,
};

export function getParticipantLevelScore(level?: string | null) {
  return participantLevelScoreMap[level ?? ""] ?? 3;
}

export function getParticipantLevelLabel(level?: string | null) {
  const score = getParticipantLevelScore(level);
  return `${score} ${score === 1 ? "estrela" : "estrelas"}`;
}

export function getParticipantLevelVisual(level?: string | null) {
  const score = getParticipantLevelScore(level);
  return "★".repeat(score) + "☆".repeat(5 - score);
}