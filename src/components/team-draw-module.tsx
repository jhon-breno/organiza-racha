"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  MessageCircle,
  Minus,
  Plus,
  RotateCcw,
  Shuffle,
  Sparkles,
  Swords,
  Trophy,
} from "lucide-react";
import { ToastContainer } from "@/components/toast-container";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  buildTeamDrawMessage,
  drawBalancedTeams,
  getSuggestedTeamCount,
  type DrawTeam,
  type TeamDrawParticipant,
} from "@/lib/team-draw";
import { detectIsFemaleByName } from "@/lib/gender";
import {
  getParticipantLevelLabel,
  getParticipantLevelVisual,
} from "@/lib/participant-level";
import { formatDateTimeShort, getDisplayName } from "@/lib/utils";

type TeamDrawModuleProps = {
  rachaId: string;
  rachaTitle: string;
  modality: string;
  futebolType?: string | null;
  voleiType?: string | null;
  enrollments: TeamDrawParticipant[];
};

const INITIAL_DRAW_DELAY_MS = 5000;
const TEAM_REVEAL_DELAY_MS = 850;

type MatchScores = {
  home: number;
  away: number;
};

type MatchFlowState = {
  round: number;
  current: [string, string];
  waiting: string[];
  streakTeamId: string | null;
  streakCount: number;
  lastAction: "normal" | "double-win-rotation";
};

type MatchHistoryItem = {
  id: string;
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  winnerTeamId: string;
  loserTeamId: string;
  homeScore: number;
  awayScore: number;
  createdAt: Date;
};

type PersistedTeamDrawState = {
  seed: number;
  teamCount: number;
  drawnAt: string;
  scoreToWin: number;
  matchFlow: unknown;
  matchHistory: Array<
    Omit<MatchHistoryItem, "createdAt"> & { createdAt: string }
  >;
};

type PersistedMatchFlowEnvelope = {
  version: 1;
  flow: MatchFlowState | null;
  drawnTeams: DrawTeam[];
};

type TeamRankingItem = {
  teamId: string;
  teamName: string;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
};

function createInitialMatchFlow(teams: DrawTeam[]): MatchFlowState | null {
  if (teams.length < 2) {
    return null;
  }

  return {
    round: 1,
    current: [teams[0].id, teams[1].id],
    waiting: teams.slice(2).map((team) => team.id),
    streakTeamId: null,
    streakCount: 0,
    lastAction: "normal",
  };
}

function isWinningScore(
  candidateScore: number,
  opponentScore: number,
  scoreToWin: number,
) {
  return candidateScore >= scoreToWin && candidateScore - opponentScore >= 2;
}

function getWinningSlot(scores: MatchScores, scoreToWin: number) {
  if (isWinningScore(scores.home, scores.away, scoreToWin)) {
    return "home" as const;
  }

  if (isWinningScore(scores.away, scores.home, scoreToWin)) {
    return "away" as const;
  }

  return null;
}

function advanceMatchFlow(
  currentFlow: MatchFlowState,
  winnerTeamId: string,
): MatchFlowState {
  const [homeTeamId, awayTeamId] = currentFlow.current;
  const loserTeamId = winnerTeamId === homeTeamId ? awayTeamId : homeTeamId;
  const nextStreakCount =
    currentFlow.streakTeamId === winnerTeamId ? currentFlow.streakCount + 1 : 1;

  if (currentFlow.waiting.length === 0) {
    return {
      round: currentFlow.round + 1,
      current: [winnerTeamId, loserTeamId],
      waiting: [],
      streakTeamId: winnerTeamId,
      streakCount: nextStreakCount,
      lastAction: "normal",
    };
  }

  if (nextStreakCount >= 2 && currentFlow.waiting.length >= 2) {
    const [nextHomeTeamId, nextAwayTeamId, ...remainingWaiting] =
      currentFlow.waiting;

    return {
      round: currentFlow.round + 1,
      current: [nextHomeTeamId, nextAwayTeamId],
      // O time que saiu por 2 vitórias seguidas volta antes do último perdedor.
      waiting: [...remainingWaiting, winnerTeamId, loserTeamId],
      streakTeamId: null,
      streakCount: 0,
      lastAction: "double-win-rotation",
    };
  }

  const [challengerTeamId, ...remainingWaiting] = currentFlow.waiting;

  return {
    round: currentFlow.round + 1,
    current: [winnerTeamId, challengerTeamId],
    waiting: [...remainingWaiting, loserTeamId],
    streakTeamId: winnerTeamId,
    streakCount: nextStreakCount,
    lastAction: "normal",
  };
}

function buildResultsWhatsappMessage(input: {
  rachaTitle: string;
  scoreToWin: number;
  ranking: TeamRankingItem[];
  matchHistory: MatchHistoryItem[];
  resolveTeamName: (teamId: string) => string;
}) {
  let message = `*${input.rachaTitle}* - Resultados do racha\n`;
  message += `Pontos para vencer: ${input.scoreToWin} (com 2 de diferenca)\n\n`;

  message += "*Classificacao*\n";

  if (input.ranking.length === 0) {
    message += "Sem partidas finalizadas ainda.\n";
  } else {
    input.ranking.forEach((item, index) => {
      message += `${index + 1}. ${item.teamName} - ${item.wins}V/${item.losses}D`;
      message += ` | PJ:${item.played} | SD:${item.pointDiff >= 0 ? `+${item.pointDiff}` : item.pointDiff}\n`;
    });
  }

  message += "\n*Ultimos confrontos*\n";

  if (input.matchHistory.length === 0) {
    message += "Nenhum confronto finalizado.\n";
  } else {
    input.matchHistory.slice(0, 12).forEach((match) => {
      const homeTeamName = input.resolveTeamName(match.homeTeamId);
      const awayTeamName = input.resolveTeamName(match.awayTeamId);
      const winnerName = input.resolveTeamName(match.winnerTeamId);
      message += `R${match.round}: ${homeTeamName} ${match.homeScore} x ${match.awayScore} ${awayTeamName}`;
      message += ` (vencedor: ${winnerName})\n`;
    });
  }

  return message;
}

function isMatchFlowState(value: unknown): value is MatchFlowState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<MatchFlowState>;

  return (
    typeof candidate.round === "number" &&
    Array.isArray(candidate.current) &&
    candidate.current.length === 2 &&
    typeof candidate.current[0] === "string" &&
    typeof candidate.current[1] === "string" &&
    Array.isArray(candidate.waiting)
  );
}

function isDrawTeamArray(value: unknown): value is DrawTeam[] {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.every((team) => {
    if (!team || typeof team !== "object") {
      return false;
    }

    const candidate = team as Partial<DrawTeam>;

    return (
      typeof candidate.id === "string" &&
      typeof candidate.name === "string" &&
      Array.isArray(candidate.players) &&
      Array.isArray(candidate.setters) &&
      Array.isArray(candidate.goalkeepers) &&
      typeof candidate.totalScore === "number"
    );
  });
}

export function TeamDrawModule({
  rachaId,
  rachaTitle,
  modality,
  futebolType,
  voleiType,
  enrollments,
}: TeamDrawModuleProps) {
  const teamCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isHydratingStateRef = useRef(true);
  const persistenceDebounceRef = useRef<number | null>(null);
  const [seed, setSeed] = useState(() => Date.now());
  const [drawnAt, setDrawnAt] = useState<Date | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [revealedTeamCount, setRevealedTeamCount] = useState(0);
  const [showNewDrawModal, setShowNewDrawModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<
    "draw-whatsapp" | "results-whatsapp" | null
  >(null);
  const [scoreToWin, setScoreToWin] = useState(15);
  const [matchFlow, setMatchFlow] = useState<MatchFlowState | null>(null);
  const [matchScores, setMatchScores] = useState<MatchScores>({
    home: 0,
    away: 0,
  });
  const [matchHistory, setMatchHistory] = useState<MatchHistoryItem[]>([]);
  const [persistedDrawTeams, setPersistedDrawTeams] = useState<
    DrawTeam[] | null
  >(null);
  const [hasLoadedPersistedState, setHasLoadedPersistedState] = useState(false);
  const { addToast, removeToast, toasts } = useToast();

  const persistTeamDrawState = (
    payload: PersistedTeamDrawState,
    options?: { keepalive?: boolean },
  ) => {
    void fetch(`/api/dashboard/rachas/${rachaId}/team-draw-state`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: options?.keepalive,
    });
  };
  const linePlayers = useMemo(
    () =>
      modality === "FUTEBOL"
        ? enrollments.filter((item) => item.participantPosition !== "Goleiro")
        : enrollments,
    [enrollments, modality],
  );
  const goalkeepers = useMemo(
    () =>
      modality === "FUTEBOL"
        ? enrollments.filter((item) => item.participantPosition === "Goleiro")
        : [],
    [enrollments, modality],
  );
  const suggestedTeamCount = useMemo(
    () =>
      getSuggestedTeamCount({
        participantCount: enrollments.length,
        linePlayerCount: linePlayers.length,
        modality,
        futebolType,
        voleiType,
      }),
    [enrollments.length, futebolType, linePlayers.length, modality, voleiType],
  );
  const maxTeamCount = Math.max(2, Math.min(8, linePlayers.length || 2));
  const [teamCount, setTeamCount] = useState(
    Math.min(suggestedTeamCount, maxTeamCount),
  );

  useEffect(() => {
    if (drawnAt) {
      return;
    }

    setTeamCount(Math.min(suggestedTeamCount, maxTeamCount));
  }, [drawnAt, maxTeamCount, suggestedTeamCount]);

  const generatedTeams = useMemo(
    () =>
      drawBalancedTeams({
        participants: enrollments,
        teamCount,
        modality,
        seed,
      }),
    [enrollments, modality, seed, teamCount],
  );
  const teams = useMemo(
    () =>
      persistedDrawTeams && persistedDrawTeams.length > 0
        ? persistedDrawTeams
        : generatedTeams,
    [generatedTeams, persistedDrawTeams],
  );
  const whatsappMessage = useMemo(
    () => buildTeamDrawMessage(rachaTitle, teams, drawnAt ?? undefined),
    [drawnAt, rachaTitle, teams],
  );
  const teamsById = useMemo(
    () => new Map(teams.map((team) => [team.id, team])),
    [teams],
  );
  const ranking = useMemo<TeamRankingItem[]>(() => {
    const stats = new Map<string, TeamRankingItem>();

    teams.forEach((team) => {
      stats.set(team.id, {
        teamId: team.id,
        teamName: team.name,
        played: 0,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pointDiff: 0,
      });
    });

    matchHistory.forEach((match) => {
      const home = stats.get(match.homeTeamId);
      const away = stats.get(match.awayTeamId);

      if (!home || !away) {
        return;
      }

      home.played += 1;
      away.played += 1;
      home.pointsFor += match.homeScore;
      home.pointsAgainst += match.awayScore;
      away.pointsFor += match.awayScore;
      away.pointsAgainst += match.homeScore;

      if (match.winnerTeamId === home.teamId) {
        home.wins += 1;
        away.losses += 1;
      } else {
        away.wins += 1;
        home.losses += 1;
      }
    });

    const normalized = [...stats.values()].map((item) => ({
      ...item,
      pointDiff: item.pointsFor - item.pointsAgainst,
    }));

    normalized.sort((left, right) => {
      if (right.wins !== left.wins) {
        return right.wins - left.wins;
      }
      if (right.pointDiff !== left.pointDiff) {
        return right.pointDiff - left.pointDiff;
      }
      if (right.pointsFor !== left.pointsFor) {
        return right.pointsFor - left.pointsFor;
      }
      if (left.losses !== right.losses) {
        return left.losses - right.losses;
      }
      return left.teamName.localeCompare(right.teamName);
    });

    return normalized;
  }, [matchHistory, teams]);
  const resultsWhatsappMessage = useMemo(
    () =>
      buildResultsWhatsappMessage({
        rachaTitle,
        scoreToWin,
        ranking,
        matchHistory,
        resolveTeamName: (teamId) => teamsById.get(teamId)?.name ?? teamId,
      }),
    [matchHistory, rachaTitle, ranking, scoreToWin, teamsById],
  );
  const currentMatch = useMemo(() => {
    if (!matchFlow) {
      return null;
    }

    const [homeTeamId, awayTeamId] = matchFlow.current;
    const homeTeam = teamsById.get(homeTeamId);
    const awayTeam = teamsById.get(awayTeamId);

    if (!homeTeam || !awayTeam) {
      return null;
    }

    return {
      homeTeam,
      awayTeam,
      waitingTeams: matchFlow.waiting
        .map((teamId) => teamsById.get(teamId))
        .filter((team): team is DrawTeam => Boolean(team)),
    };
  }, [matchFlow, teamsById]);

  useEffect(() => {
    if (!isDrawing) {
      return;
    }

    if (revealedTeamCount >= teams.length) {
      setIsDrawing(false);
      return;
    }

    const timeout = window.setTimeout(
      () => {
        setRevealedTeamCount((current) => current + 1);
      },
      revealedTeamCount === 0 ? INITIAL_DRAW_DELAY_MS : TEAM_REVEAL_DELAY_MS,
    );

    return () => window.clearTimeout(timeout);
  }, [isDrawing, revealedTeamCount, teams.length]);

  useEffect(() => {
    if (!drawnAt || revealedTeamCount === 0) {
      return;
    }

    const currentTeam = teams[Math.max(0, revealedTeamCount - 1)];

    if (!currentTeam) {
      return;
    }

    const element = teamCardRefs.current[currentTeam.id];

    if (!element) {
      return;
    }

    element.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [drawnAt, revealedTeamCount, teams]);

  useEffect(() => {
    if (!drawnAt || isDrawing || revealedTeamCount < teams.length) {
      return;
    }

    if (matchFlow || matchHistory.length > 0) {
      return;
    }

    setMatchFlow(createInitialMatchFlow(teams));
    setMatchScores({ home: 0, away: 0 });
    setMatchHistory([]);
  }, [
    drawnAt,
    isDrawing,
    matchFlow,
    matchHistory.length,
    revealedTeamCount,
    teams,
  ]);

  useEffect(() => {
    let isMounted = true;

    const loadPersistedState = async () => {
      try {
        const response = await fetch(
          `/api/dashboard/rachas/${rachaId}/team-draw-state`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          state:
            | (Omit<PersistedTeamDrawState, "seed"> & {
                seed: string | number;
              })
            | null;
        };

        if (!isMounted || !data.state) {
          return;
        }

        const restoredSeed = Number(data.state.seed);

        if (Number.isFinite(restoredSeed)) {
          setSeed(restoredSeed);
        }

        if (typeof data.state.teamCount === "number") {
          setTeamCount(
            Math.max(2, Math.min(maxTeamCount, data.state.teamCount)),
          );
        }

        if (data.state.drawnAt) {
          setDrawnAt(new Date(data.state.drawnAt));
          setIsDrawing(false);
          setRevealedTeamCount(999);
        }

        if (typeof data.state.scoreToWin === "number") {
          setScoreToWin(Math.max(5, Math.min(50, data.state.scoreToWin)));
        }

        if (data.state.matchFlow === null) {
          setMatchFlow(null);
        } else if (isMatchFlowState(data.state.matchFlow)) {
          setMatchFlow(data.state.matchFlow);
        } else if (
          data.state.matchFlow &&
          typeof data.state.matchFlow === "object"
        ) {
          const envelope = data.state
            .matchFlow as Partial<PersistedMatchFlowEnvelope>;

          if (envelope.flow === null || isMatchFlowState(envelope.flow)) {
            setMatchFlow(envelope.flow ?? null);
          }

          if (isDrawTeamArray(envelope.drawnTeams)) {
            setPersistedDrawTeams(envelope.drawnTeams);
          }
        }

        if (Array.isArray(data.state.matchHistory)) {
          setMatchHistory(
            data.state.matchHistory
              .map((item) => ({
                ...item,
                createdAt: new Date(item.createdAt),
              }))
              .filter((item) => !Number.isNaN(item.createdAt.getTime())),
          );
        }
      } catch {
        // If persisted state fails to load, the user can keep using local in-memory flow.
      } finally {
        if (isMounted) {
          isHydratingStateRef.current = false;
          setHasLoadedPersistedState(true);
        }
      }
    };

    void loadPersistedState();

    return () => {
      isMounted = false;
    };
  }, [maxTeamCount, rachaId]);

  useEffect(() => {
    if (isHydratingStateRef.current || !hasLoadedPersistedState || !drawnAt) {
      return;
    }

    if (persistenceDebounceRef.current) {
      window.clearTimeout(persistenceDebounceRef.current);
    }

    persistenceDebounceRef.current = window.setTimeout(() => {
      const payload: PersistedTeamDrawState = {
        seed,
        teamCount,
        drawnAt: drawnAt.toISOString(),
        scoreToWin,
        matchFlow: {
          version: 1,
          flow: matchFlow,
          drawnTeams: teams,
        },
        matchHistory: matchHistory.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
        })),
      };

      persistTeamDrawState(payload);
    }, 350);

    return () => {
      if (persistenceDebounceRef.current) {
        window.clearTimeout(persistenceDebounceRef.current);
      }
    };
  }, [
    drawnAt,
    hasLoadedPersistedState,
    isDrawing,
    matchFlow,
    matchHistory,
    rachaId,
    scoreToWin,
    seed,
    teamCount,
    teams,
  ]);

  const startNewDraw = () => {
    const nextSeed = Date.now();
    const drawnAtNow = new Date();
    const nextTeams = drawBalancedTeams({
      participants: enrollments,
      teamCount,
      modality,
      seed: nextSeed,
    });

    persistTeamDrawState(
      {
        seed: nextSeed,
        teamCount,
        drawnAt: drawnAtNow.toISOString(),
        scoreToWin,
        matchFlow: {
          version: 1,
          flow: null,
          drawnTeams: nextTeams,
        },
        matchHistory: [],
      },
      { keepalive: true },
    );

    setSeed(nextSeed);
    setPersistedDrawTeams(nextTeams);
    setDrawnAt(drawnAtNow);
    setRevealedTeamCount(0);
    setExportFormat(null);
    setIsDrawing(true);
    setMatchFlow(null);
    setMatchScores({ home: 0, away: 0 });
    setMatchHistory([]);
    setShowNewDrawModal(false);
  };

  const handleDraw = () => {
    if (drawnAt) {
      setShowNewDrawModal(true);
      return;
    }

    startNewDraw();
  };

  const currentRevealTeam =
    isDrawing && teams.length > 0 && revealedTeamCount > 0
      ? teams[Math.min(revealedTeamCount, teams.length - 1)]
      : null;

  const handleCopy = async (message = whatsappMessage) => {
    if (!drawnAt) {
      addToast("Realize o sorteio antes de exportar.", "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(message);
      addToast("Sorteio copiado para a area de transferencia.", "success");
    } catch {
      addToast("Nao foi possivel copiar o sorteio.", "error");
    }
  };

  const handleWhatsappExport = () => {
    if (!drawnAt) {
      addToast("Realize o sorteio antes de exportar.", "error");
      return;
    }

    setExportFormat("draw-whatsapp");
  };

  const handleResultsWhatsappExport = () => {
    if (!drawnAt) {
      addToast("Realize o sorteio antes de exportar.", "error");
      return;
    }

    if (matchHistory.length === 0) {
      addToast(
        "Finalize pelo menos um confronto para exportar resultados.",
        "error",
      );
      return;
    }

    setExportFormat("results-whatsapp");
  };

  const activeWhatsappMessage =
    exportFormat === "results-whatsapp"
      ? resultsWhatsappMessage
      : whatsappMessage;

  const handleOpenWhatsapp = () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(activeWhatsappMessage)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const handleResetCurrentMatch = () => {
    setMatchScores({ home: 0, away: 0 });
  };

  const concludeMatch = (
    winnerSlot: "home" | "away",
    finalScores?: MatchScores,
  ) => {
    if (!matchFlow || !currentMatch) {
      return;
    }

    const scores = finalScores ?? matchScores;
    const winnerTeamId =
      winnerSlot === "home"
        ? currentMatch.homeTeam.id
        : currentMatch.awayTeam.id;
    const loserTeamId =
      winnerSlot === "home"
        ? currentMatch.awayTeam.id
        : currentMatch.homeTeam.id;
    const winnerName =
      winnerSlot === "home"
        ? currentMatch.homeTeam.name
        : currentMatch.awayTeam.name;
    const nextFlow = advanceMatchFlow(matchFlow, winnerTeamId);

    setMatchHistory((previous) => [
      {
        id: `${Date.now()}-${previous.length + 1}`,
        round: matchFlow.round,
        homeTeamId: currentMatch.homeTeam.id,
        awayTeamId: currentMatch.awayTeam.id,
        winnerTeamId,
        loserTeamId,
        homeScore: scores.home,
        awayScore: scores.away,
        createdAt: new Date(),
      },
      ...previous,
    ]);
    setMatchFlow(nextFlow);
    setMatchScores({ home: 0, away: 0 });

    addToast(
      `${winnerName} venceu por ${scores.home} x ${scores.away}.`,
      "success",
    );

    if (nextFlow.lastAction === "double-win-rotation") {
      addToast(
        `${winnerName} venceu 2 seguidas e saiu. Entram os dois times da fila.`,
        "success",
      );
    }
  };

  const handlePointChange = (slot: "home" | "away", delta: 1 | -1) => {
    if (!matchFlow || !currentMatch) {
      return;
    }

    let computedScores: MatchScores | null = null;

    setMatchScores((previous) => {
      const currentValue = slot === "home" ? previous.home : previous.away;
      const nextValue = Math.max(0, currentValue + delta);
      const nextScores =
        slot === "home"
          ? { ...previous, home: nextValue }
          : { ...previous, away: nextValue };

      computedScores = nextScores;

      return nextScores;
    });

    if (!computedScores || delta < 0) {
      return;
    }

    const winnerSlot = getWinningSlot(computedScores, scoreToWin);

    if (!winnerSlot) {
      return;
    }

    concludeMatch(winnerSlot, computedScores);
  };

  const hasPersistedOrDrawnTeams = drawnAt && teams.length >= 2;

  if (
    !hasPersistedOrDrawnTeams &&
    (enrollments.length < 2 || linePlayers.length < 2)
  ) {
    return (
      <Card>
        <h3 className="text-lg font-bold text-slate-950">Sorteio de times</h3>
        <p className="mt-2 text-sm text-slate-600">
          E preciso ter pelo menos 2 atletas confirmados para gerar o sorteio.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.45fr]">
      <ToastContainer onRemove={removeToast} toasts={toasts} />

      <Card className="space-y-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
            Participantes confirmados
          </p>
          <h3 className="mt-1 text-2xl font-black text-slate-950">
            Base do sorteio
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            Revise os atletas confirmados e seus niveis antes de realizar o
            sorteio.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {linePlayers.length} atletas de linha confirmados
            {goalkeepers.length > 0
              ? ` • ${goalkeepers.length} goleiro(s)`
              : ""}
          </p>
        </div>

        <div className="space-y-3">
          {enrollments.map((participant, index) => (
            <div
              key={participant.id}
              className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  {index + 1}.{" "}
                  {getDisplayName(
                    participant.participantName,
                    participant.participantNickname,
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  {participant.participantPosition}
                </p>
              </div>
              <div className="text-right text-xs text-amber-700">
                <p className="font-semibold">
                  {getParticipantLevelVisual(participant.participantLevel)}
                </p>
                <p>{getParticipantLevelLabel(participant.participantLevel)}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="relative space-y-5 overflow-hidden bg-[linear-gradient(180deg,rgba(15,118,110,0.08),rgba(255,255,255,1)_32%)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
              Sorteio de times
            </p>
            <h3 className="mt-1 text-2xl font-black text-slate-950">
              Distribuicao equilibrada por estrelas
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              O sistema monta times balanceados e revela um por vez, como se o
              sorteio estivesse acontecendo agora.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Sugestao automatica: {suggestedTeamCount} time(s)
              {drawnAt ? ` • realizado em ${formatDateTimeShort(drawnAt)}` : ""}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Quantidade de times
              <Select
                className="min-w-36"
                name="teamCount"
                onChange={(event) => setTeamCount(Number(event.target.value))}
                value={String(teamCount)}
              >
                {Array.from({ length: maxTeamCount - 1 }, (_, index) => {
                  const value = index + 2;

                  return (
                    <option key={value} value={String(value)}>
                      {value} times
                    </option>
                  );
                })}
              </Select>
            </label>

            <Button onClick={handleDraw} type="button">
              <Shuffle className="h-4 w-4" />
              {drawnAt ? "Realizar novo sorteio" : "Realizar sorteio agora"}
            </Button>

            <Button
              onClick={handleWhatsappExport}
              type="button"
              variant="outline"
            >
              <MessageCircle className="h-4 w-4" />
              Exportar para WhatsApp
            </Button>

            <Button onClick={() => handleCopy()} type="button" variant="ghost">
              <Copy className="h-4 w-4" />
              Copiar texto
            </Button>
          </div>
        </div>

        {showNewDrawModal ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/45 px-4 py-6">
            <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">
                Confirmar novo sorteio
              </p>
              <h4 className="mt-2 text-xl font-black text-slate-950">
                Deseja realizar um novo sorteio?
              </h4>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Essa ação vai zerar os confrontos, placares e histórico já
                registrados.
              </p>

              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <Button
                  onClick={() => setShowNewDrawModal(false)}
                  type="button"
                  variant="outline"
                >
                  Cancelar
                </Button>
                <Button onClick={startNewDraw} type="button" variant="danger">
                  Confirmar e sortear novamente
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {!drawnAt ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 px-6 py-10 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
              Aguardando sorteio
            </p>
            <p className="mt-3 text-base text-slate-700">
              Clique em <strong>Realizar sorteio agora</strong> para revelar os
              times.
            </p>
          </div>
        ) : null}

        {isDrawing ? (
          <div className="draw-overlay absolute inset-0 z-10 flex items-center justify-center px-6 py-8">
            <div className="draw-overlay-panel max-w-lg rounded-[2rem] border border-white/60 px-6 py-6 text-center shadow-2xl">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-600 text-white shadow-lg shadow-teal-900/20">
                <Sparkles className="draw-overlay-icon h-8 w-8" />
              </div>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">
                Sorteio em andamento
              </p>
              <h4 className="mt-3 text-2xl font-black text-slate-950">
                {currentRevealTeam
                  ? `Revelando ${currentRevealTeam.name}`
                  : "Embaralhando os times"}
              </h4>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {currentRevealTeam
                  ? "Os times estao sendo apresentados automaticamente, um por vez."
                  : "Estamos organizando as equipes. Em instantes a revelacao vai comecar."}
              </p>
              <div className="mt-5 flex items-center justify-center gap-3 text-sm font-semibold text-slate-700">
                <Trophy className="h-4 w-4 text-amber-500" />
                <span>
                  {Math.min(revealedTeamCount, teams.length)} de {teams.length}{" "}
                  time(s)
                </span>
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="draw-progress h-full rounded-full bg-teal-600"
                  style={{
                    width: `${(Math.min(revealedTeamCount, teams.length) / teams.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        ) : null}

        {exportFormat ? (
          <div className="space-y-4 rounded-3xl border border-slate-200 bg-white/90 p-4">
            <div className="max-h-[38vh] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-900 whitespace-pre-wrap sm:max-h-[50vh]">
              {activeWhatsappMessage}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => handleCopy(activeWhatsappMessage)}
                className="flex-1"
                type="button"
              >
                <Copy className="h-4 w-4" />
                Copiar mensagem
              </Button>

              <Button
                onClick={handleOpenWhatsapp}
                className="flex-1"
                type="button"
              >
                <MessageCircle className="h-4 w-4" />
                Abrir WhatsApp
              </Button>

              <Button
                onClick={() => setExportFormat(null)}
                variant="outline"
                type="button"
              >
                Voltar
              </Button>
            </div>
          </div>
        ) : null}

        {drawnAt ? (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {teams.map((team, index) => {
              const isVisible = !isDrawing || index < revealedTeamCount;

              return (
                <div
                  key={`${team.id}-${seed}`}
                  ref={(element) => {
                    teamCardRefs.current[team.id] = element;
                  }}
                  className={
                    isVisible
                      ? "draw-team-reveal rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                      : "rounded-3xl border border-slate-200 bg-white/70 p-5 shadow-sm animate-pulse"
                  }
                >
                  {isVisible ? (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-lg font-bold text-slate-950">
                            {team.name}
                          </h4>
                          <p className="text-xs text-slate-500">
                            {team.totalScore} pontos totais
                          </p>
                        </div>
                        <div className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                          {team.players.length +
                            team.setters.length +
                            team.goalkeepers.length}{" "}
                          atletas
                        </div>
                      </div>

                      {team.setters.length > 0 ? (
                        <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-800">
                            Levantadores
                          </p>
                          <div className="mt-2 space-y-2">
                            {team.setters.map((setter) => {
                              const isFemale =
                                setter.isFemale ??
                                detectIsFemaleByName(setter.participantName);
                              return (
                                <div
                                  key={setter.id}
                                  className="flex items-center justify-between gap-3 text-sm text-slate-800"
                                >
                                  <span className="flex items-center gap-1.5 font-medium">
                                    {setter.participantName}
                                    {isFemale ? (
                                      <span className="rounded bg-pink-100 px-1.5 py-0.5 text-[10px] font-bold text-pink-700">
                                        Feminino
                                      </span>
                                    ) : null}
                                  </span>
                                  <span className="text-xs text-amber-700">
                                    {getParticipantLevelVisual(
                                      setter.participantLevel,
                                    )}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-4 space-y-3">
                        {team.players.map((participant, participantIndex) => {
                          const isFemale =
                            participant.isFemale ??
                            detectIsFemaleByName(participant.participantName);

                          return (
                            <div
                              key={participant.id}
                              className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-950">
                                    <span>
                                      {participantIndex + 1}.{" "}
                                      {participant.participantName}
                                    </span>
                                    {isFemale ? (
                                      <span className="rounded bg-pink-100 px-1.5 py-0.5 text-[10px] font-bold text-pink-700">
                                        Feminino
                                      </span>
                                    ) : null}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {participant.participantPosition}
                                  </p>
                                </div>
                                <div className="text-right text-xs text-amber-700">
                                  <p className="font-semibold">
                                    {getParticipantLevelVisual(
                                      participant.participantLevel,
                                    )}
                                  </p>
                                  <p>
                                    {getParticipantLevelLabel(
                                      participant.participantLevel,
                                    )}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {team.goalkeepers.length > 0 ? (
                        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                            Goleiros
                          </p>
                          <div className="mt-2 space-y-2">
                            {team.goalkeepers.map((goalkeeper) => (
                              <div
                                key={goalkeeper.id}
                                className="flex items-center justify-between gap-3 text-sm text-slate-800"
                              >
                                <span>{goalkeeper.participantName}</span>
                                <span className="text-xs text-amber-700">
                                  {getParticipantLevelVisual(
                                    goalkeeper.participantLevel,
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div className="h-6 w-24 rounded-full bg-slate-200" />
                      <div className="h-4 w-32 rounded-full bg-slate-200" />
                      <div className="space-y-2 pt-3">
                        <div className="h-14 rounded-2xl bg-slate-100" />
                        <div className="h-14 rounded-2xl bg-slate-100" />
                        <div className="h-14 rounded-2xl bg-slate-100" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        {drawnAt && !isDrawing && matchFlow && currentMatch ? (
          <div className="space-y-4 rounded-3xl border border-slate-200 bg-white/90 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
                  Confrontos do racha
                </p>
                <h4 className="mt-1 text-xl font-black text-slate-950">
                  Rodada {matchFlow.round}: {currentMatch.homeTeam.name} x{" "}
                  {currentMatch.awayTeam.name}
                </h4>
                <p className="mt-1 text-sm text-slate-600">
                  Time que chega em {scoreToWin} com diferenca minima de 2
                  pontos vence.
                </p>
              </div>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Pontos para vencer
                <Input
                  className="h-11 w-32"
                  min={5}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isNaN(value)) {
                      return;
                    }
                    setScoreToWin(Math.max(5, Math.min(50, value)));
                  }}
                  step={1}
                  type="number"
                  value={scoreToWin}
                />
              </label>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr]">
              <div className="rounded-2xl border border-teal-100 bg-teal-50/70 p-4 text-center">
                <p className="text-sm font-semibold text-slate-700">
                  {currentMatch.homeTeam.name}
                </p>
                <p className="mt-2 text-5xl font-black tabular-nums text-teal-800">
                  {matchScores.home}
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <Button
                    className="h-11 min-w-20"
                    onClick={() => handlePointChange("home", -1)}
                    type="button"
                    variant="outline"
                  >
                    <Minus className="h-4 w-4" />
                    -1
                  </Button>
                  <Button
                    className="h-11 min-w-20"
                    onClick={() => handlePointChange("home", 1)}
                    type="button"
                  >
                    <Plus className="h-4 w-4" />
                    +1
                  </Button>
                </div>
              </div>

              <div className="hidden items-center justify-center lg:flex">
                <div className="rounded-full bg-slate-100 p-3 text-slate-500">
                  <Swords className="h-5 w-5" />
                </div>
              </div>

              <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 text-center">
                <p className="text-sm font-semibold text-slate-700">
                  {currentMatch.awayTeam.name}
                </p>
                <p className="mt-2 text-5xl font-black tabular-nums text-sky-800">
                  {matchScores.away}
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <Button
                    className="h-11 min-w-20"
                    onClick={() => handlePointChange("away", -1)}
                    type="button"
                    variant="outline"
                  >
                    <Minus className="h-4 w-4" />
                    -1
                  </Button>
                  <Button
                    className="h-11 min-w-20"
                    onClick={() => handlePointChange("away", 1)}
                    type="button"
                  >
                    <Plus className="h-4 w-4" />
                    +1
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleResultsWhatsappExport}
                type="button"
                variant="outline"
              >
                <MessageCircle className="h-4 w-4" />
                Exportar resultados WhatsApp
              </Button>
              <Button
                disabled={
                  !isWinningScore(
                    matchScores.home,
                    matchScores.away,
                    scoreToWin,
                  )
                }
                onClick={() => concludeMatch("home")}
                type="button"
                variant="outline"
              >
                Confirmar vitoria {currentMatch.homeTeam.name}
              </Button>
              <Button
                disabled={
                  !isWinningScore(
                    matchScores.away,
                    matchScores.home,
                    scoreToWin,
                  )
                }
                onClick={() => concludeMatch("away")}
                type="button"
                variant="outline"
              >
                Confirmar vitoria {currentMatch.awayTeam.name}
              </Button>
              <Button
                onClick={handleResetCurrentMatch}
                type="button"
                variant="ghost"
              >
                <RotateCcw className="h-4 w-4" />
                Zerar placar atual
              </Button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Fila de espera
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {currentMatch.waitingTeams.length > 0 ? (
                  currentMatch.waitingTeams.map((team) => (
                    <span
                      key={team.id}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                    >
                      {team.name}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">
                    Sem fila no momento.
                  </span>
                )}
              </div>
              {matchFlow.streakTeamId ? (
                <p className="mt-3 text-xs text-slate-600">
                  Sequencia atual:{" "}
                  {teamsById.get(matchFlow.streakTeamId)?.name ?? "Time"} com{" "}
                  {matchFlow.streakCount} vitoria(s).
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Classificacao dos times
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-xs text-slate-600">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="px-2 py-2 font-semibold">#</th>
                      <th className="px-2 py-2 font-semibold">Time</th>
                      <th className="px-2 py-2 font-semibold">V</th>
                      <th className="px-2 py-2 font-semibold">D</th>
                      <th className="px-2 py-2 font-semibold">PJ</th>
                      <th className="px-2 py-2 font-semibold">PF</th>
                      <th className="px-2 py-2 font-semibold">PC</th>
                      <th className="px-2 py-2 font-semibold">SD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((item, index) => (
                      <tr
                        key={item.teamId}
                        className="border-b border-slate-100 last:border-b-0"
                      >
                        <td className="px-2 py-2 font-semibold text-slate-900">
                          {index + 1}
                        </td>
                        <td className="px-2 py-2 font-semibold text-slate-900">
                          {item.teamName}
                        </td>
                        <td className="px-2 py-2">{item.wins}</td>
                        <td className="px-2 py-2">{item.losses}</td>
                        <td className="px-2 py-2">{item.played}</td>
                        <td className="px-2 py-2">{item.pointsFor}</td>
                        <td className="px-2 py-2">{item.pointsAgainst}</td>
                        <td className="px-2 py-2 font-semibold text-slate-800">
                          {item.pointDiff >= 0
                            ? `+${item.pointDiff}`
                            : item.pointDiff}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Ultimos resultados
              </p>
              {matchHistory.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">
                  Nenhum confronto finalizado ainda.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {matchHistory.slice(0, 8).map((item) => {
                    const homeTeam = teamsById.get(item.homeTeamId);
                    const awayTeam = teamsById.get(item.awayTeamId);
                    const winnerTeam = teamsById.get(item.winnerTeamId);

                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                      >
                        <p className="font-semibold text-slate-900">
                          Rodada {item.round}: {homeTeam?.name} {item.homeScore}{" "}
                          x {item.awayScore} {awayTeam?.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          Vencedor: {winnerTeam?.name}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
