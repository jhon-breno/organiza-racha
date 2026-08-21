import { isGoalkeeperPosition } from "@/lib/enrollment";
import { detectIsFemaleByName } from "@/lib/gender";
import { getParticipantLevelScore } from "@/lib/participant-level";
import { formatDateTimeShort, getDisplayName } from "@/lib/utils";

export type TeamDrawParticipant = {
  id: string;
  participantName: string;
  participantNickname?: string | null;
  participantPosition: string;
  participantLevel: string;
  isFemale?: boolean;
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
  setters: TeamDrawParticipant[];
  goalkeepers: TeamDrawParticipant[];
  totalScore: number;
};

export function isSetterPosition(position?: string | null): boolean {
  if (!position) return false;
  return position.trim().toLowerCase() === "levantador";
}

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

function shuffleSameScoreGroups(
  participants: TeamDrawParticipant[],
  seed: number,
) {
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

  return Array.from(
    { length: teamCount },
    (_, index) => baseSize + (index < remainder ? 1 : 0),
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
    input.modality === "FUTEBOL"
      ? input.linePlayerCount
      : input.participantCount;

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
  // 1. Separate Goalkeepers for Futebol
  const goalkeepers =
    modality === "FUTEBOL"
      ? participants.filter((participant) =>
          isGoalkeeperPosition(participant.participantPosition),
        )
      : [];

  const nonGoalkeepers =
    modality === "FUTEBOL"
      ? participants.filter(
          (participant) =>
            !isGoalkeeperPosition(participant.participantPosition),
        )
      : participants;

  // 2. Volleyball-specific classification order:
  // Setters -> Women -> Men (balanced by star level)
  const shouldUseVoleiOrder = modality === "VOLEI";
  const setters = shouldUseVoleiOrder
    ? nonGoalkeepers.filter((participant) =>
        isSetterPosition(participant.participantPosition),
      )
    : [];
  const nonSetters = shouldUseVoleiOrder
    ? nonGoalkeepers.filter(
        (participant) => !isSetterPosition(participant.participantPosition),
      )
    : nonGoalkeepers;

  const isFemaleParticipant = (participant: TeamDrawParticipant) =>
    participant.isFemale ?? detectIsFemaleByName(participant.participantName);

  const femalePlayers = shouldUseVoleiOrder
    ? nonSetters.filter(isFemaleParticipant)
    : [];
  const maleOrOtherPlayers = shouldUseVoleiOrder
    ? nonSetters.filter((participant) => !isFemaleParticipant(participant))
    : nonSetters;

  const linePlayerCount = nonGoalkeepers.length;
  const targetSizes = buildTargetSizes(linePlayerCount, teamCount);

  const teams: DrawTeam[] = Array.from({ length: teamCount }, (_, index) => ({
    id: `team-${index + 1}`,
    name: `Time ${index + 1}`,
    players: [],
    setters: [],
    goalkeepers: [],
    totalScore: 0,
  }));

  const random = createSeededRandom(seed + 97);

  if (shouldUseVoleiOrder) {
    // 2.1 Distribute setters first, round-robin across teams
    const shuffledSetters = shuffleSameScoreGroups(setters, seed + 311);
    shuffledSetters.forEach((setter, index) => {
      const targetTeam = teams[index % teams.length];
      if (targetTeam) {
        targetTeam.setters.push(setter);
        targetTeam.totalScore += getParticipantLevelScore(
          setter.participantLevel,
        );
      }
    });
  }

  if (shouldUseVoleiOrder) {
    // 2.2 Distribute women before men
    const shuffledFemalePlayers = shuffleSameScoreGroups(
      femalePlayers,
      seed + 509,
    );
    shuffledFemalePlayers.forEach((femalePlayer) => {
      const score = getParticipantLevelScore(femalePlayer.participantLevel);

      const eligibleTeams = teams
        .map((team, index) => {
          const currentSize = team.players.length + team.setters.length;
          const femaleCount =
            team.players.filter(isFemaleParticipant).length +
            team.setters.filter(isFemaleParticipant).length;

          return {
            team,
            index,
            targetSize: targetSizes[index] ?? 0,
            currentSize,
            femaleCount,
          };
        })
        .filter(({ currentSize, targetSize }) => currentSize < targetSize);

      eligibleTeams.sort((left, right) => {
        if (left.femaleCount !== right.femaleCount) {
          return left.femaleCount - right.femaleCount;
        }
        if (left.team.totalScore !== right.team.totalScore) {
          return left.team.totalScore - right.team.totalScore;
        }
        if (left.currentSize !== right.currentSize) {
          return left.currentSize - right.currentSize;
        }
        return random() - 0.5;
      });

      const selectedTeam = eligibleTeams[0]?.team ?? teams[0];
      selectedTeam.players.push(femalePlayer);
      selectedTeam.totalScore += score;
    });
  }

  // 2.3 Distribute remaining players (in volei this is men/others), balanced by stars
  const shuffledRemaining = shuffleSameScoreGroups(
    maleOrOtherPlayers,
    seed + 97,
  );
  shuffledRemaining.forEach((player) => {
    const score = getParticipantLevelScore(player.participantLevel);

    const eligibleTeams = teams
      .map((team, index) => {
        const currentSize = team.players.length + team.setters.length;
        return {
          team,
          index,
          targetSize: targetSizes[index] ?? 0,
          currentSize,
        };
      })
      .filter(({ currentSize, targetSize }) => currentSize < targetSize);

    eligibleTeams.sort((left, right) => {
      if (left.team.totalScore !== right.team.totalScore) {
        return left.team.totalScore - right.team.totalScore;
      }
      if (left.currentSize !== right.currentSize) {
        return left.currentSize - right.currentSize;
      }
      return random() - 0.5;
    });

    const selectedTeam = eligibleTeams[0]?.team ?? teams[0];
    selectedTeam.players.push(player);
    selectedTeam.totalScore += score;
  });

  // Distribute Goalkeepers for Futebol
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

    let playerNum = 1;

    if (team.setters.length > 0) {
      team.setters.forEach((setter) => {
        const isFemale =
          setter.isFemale ?? detectIsFemaleByName(setter.participantName);
        const name = getDisplayName(
          setter.participantName,
          setter.participantNickname,
        );
        message += `${playerNum}. ${name} (Levantador)${isFemale ? " 👩" : ""}\n`;
        playerNum += 1;
      });
    }

    team.players.forEach((player) => {
      const isFemale =
        player.isFemale ?? detectIsFemaleByName(player.participantName);
      const name = getDisplayName(
        player.participantName,
        player.participantNickname,
      );
      message += `${playerNum}. ${name}${isFemale ? " 👩" : ""}\n`;
      playerNum += 1;
    });

    if (team.goalkeepers.length > 0) {
      message += `Goleiro(s): ${team.goalkeepers
        .map((goalkeeper) =>
          getDisplayName(
            goalkeeper.participantName,
            goalkeeper.participantNickname,
          ),
        )
        .join(", ")}\n`;
    }

    message += `\n`;
  });

  return message.trim();
}
