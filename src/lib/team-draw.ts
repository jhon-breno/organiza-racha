import { isGoalkeeperPosition } from "@/lib/enrollment";
import { getParticipantLevelScore } from "@/lib/participant-level";
import { formatDateTimeShort } from "@/lib/utils";

export type TeamDrawParticipant = {
  id: string;
  participantName: string;
  participantPosition: string;
  participantLevel: string;
};

export type TeamDrawInput = {
  participants: TeamDrawParticipant[];
  teamCount: number;
  modality: string;
  seed: number;
};

export type DrawTeam = {
  id: string;
  name: string;
  players: TeamDrawParticipant[];
  goalkeepers: TeamDrawParticipant[];
  totalScore: number;
};

function createSeededRandom(seed: number) {
  let current = seed % 2147483647;

  if (current <= 0) {
    current += 2147483646;
  }

  return () => {
    current = (current * 16807) % 2147483647;
    return (current - 1) / 2147483646;
  };
}

function shuffleSameScoreGroups(participants: TeamDrawParticipant[], seed: number) {
  const random = createSeededRandom(seed);

  return [...participants]
    .map((participant) => ({
      participant,
      score: getParticipantLevelScore(participant.participantLevel),
      tieBreaker: random(),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.tieBreaker - right.tieBreaker;
    })
    .map((entry) => entry.participant);
}

function buildTargetSizes(totalPlayers: number, teamCount: number) {
  const baseSize = Math.floor(totalPlayers / teamCount);
  const remainder = totalPlayers % teamCount;

  return Array.from({ length: teamCount }, (_, index) =>
    baseSize + (index < remainder ? 1 : 0),
  );
}

function getSuggestedPlayersPerTeam(input: {
  modality: string;
  futebolType?: string | null;
  voleiType?: string | null;
}) {
  if (input.modality === "FUTEBOL") {
    if (input.futebolType === "FUT11") return 10;
    if (input.futebolType === "FUT7") return 6;
    if (input.futebolType === "FUT6") return 5;
    return 5;
  }

  if (input.modality === "FUTSAL") {
    return 5;
  }

  if (input.modality === "VOLEI") {
    if (input.voleiType === "QUADRA_CHEIA") return 6;
    if (
      input.voleiType === "QUADRA_QUARTETO" ||
      input.voleiType?.startsWith("AREIA_QUARTETO")
    ) {
      return 4;
    }

    if (input.voleiType?.startsWith("AREIA_DUPLA")) {
      return 2;
    }

    return 6;
  }

  if (input.modality === "BASQUETE") return 5;
  if (input.modality === "BEACH_TENNIS") return 2;
  if (input.modality === "TENIS") return 1;

  return 0;
}

export function getSuggestedTeamCount(input: {
  participantCount: number;
  linePlayerCount: number;
  modality: string;
  futebolType?: string | null;
  voleiType?: string | null;
}) {
  const playersPerTeam = getSuggestedPlayersPerTeam(input);
  const effectiveCount =
    input.modality === "FUTEBOL" ? input.linePlayerCount : input.participantCount;

  if (effectiveCount <= 1) {
    return 2;
  }

  if (playersPerTeam <= 0) {
    return Math.min(2, effectiveCount);
  }

  return Math.min(
    Math.max(2, Math.ceil(effectiveCount / playersPerTeam)),
    effectiveCount,
  );
}

export function drawBalancedTeams({
  participants,
  teamCount,
  modality,
  seed,
}: TeamDrawInput) {
  const linePlayers =
    modality === "FUTEBOL"
      ? participants.filter(
          (participant) => !isGoalkeeperPosition(participant.participantPosition),
        )
      : participants;
  const goalkeepers =
    modality === "FUTEBOL"
      ? participants.filter((participant) =>
          isGoalkeeperPosition(participant.participantPosition),
        )
      : [];
  const targetSizes = buildTargetSizes(linePlayers.length, teamCount);
  const teams: DrawTeam[] = Array.from({ length: teamCount }, (_, index) => ({
    id: `team-${index + 1}`,
    name: `Time ${index + 1}`,
    players: [],
    goalkeepers: [],
    totalScore: 0,
  }));

  const orderedPlayers = shuffleSameScoreGroups(linePlayers, seed);
  const random = createSeededRandom(seed + 97);

  orderedPlayers.forEach((participant) => {
    const score = getParticipantLevelScore(participant.participantLevel);
    const eligibleTeams = teams
      .map((team, index) => ({ team, index, targetSize: targetSizes[index] ?? 0 }))
      .filter(({ team, targetSize }) => team.players.length < targetSize);

    eligibleTeams.sort((left, right) => {
      if (left.team.totalScore !== right.team.totalScore) {
        return left.team.totalScore - right.team.totalScore;
      }

      if (left.team.players.length !== right.team.players.length) {
        return left.team.players.length - right.team.players.length;
      }

      return random() - 0.5;
    });

    const selectedTeam = eligibleTeams[0]?.team ?? teams[0];
    selectedTeam.players.push(participant);
    selectedTeam.totalScore += score;
  });

  shuffleSameScoreGroups(goalkeepers, seed + 193).forEach(
    (goalkeeper, goalkeeperIndex) => {
      const selectedTeam = teams[goalkeeperIndex % teams.length];

      if (!selectedTeam) {
        return;
      }

      selectedTeam.goalkeepers.push(goalkeeper);
      selectedTeam.totalScore += getParticipantLevelScore(
        goalkeeper.participantLevel,
      );
    },
  );

  return teams;
}

export function buildTeamDrawMessage(
  rachaTitle: string,
  teams: DrawTeam[],
  drawnAt?: Date,
) {
  let message = `*${rachaTitle}* - Sorteio de times\n`;

  if (drawnAt) {
    message += `Realizado em: ${formatDateTimeShort(drawnAt)}\n`;
  }

  message += "\n";

  teams.forEach((team) => {
    message += `*${team.name}* (${team.totalScore} pts)\n`;

    team.players.forEach((player, index) => {
      message += `${index + 1}. ${player.participantName}\n`;
    });

    if (team.goalkeepers.length > 0) {
      message += `Goleiro(s): ${team.goalkeepers
        .map((goalkeeper) => goalkeeper.participantName)
        .join(", ")}\n`;
    }

    message += `\n`;
  });

  return message.trim();
}