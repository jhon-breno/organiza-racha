"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, MessageCircle, Shuffle, Sparkles, Trophy } from "lucide-react";
import { ToastContainer } from "@/components/toast-container";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  buildTeamDrawMessage,
  drawBalancedTeams,
  getSuggestedTeamCount,
  type TeamDrawParticipant,
} from "@/lib/team-draw";
import {
  getParticipantLevelLabel,
  getParticipantLevelVisual,
} from "@/lib/participant-level";
import { formatDateTimeShort } from "@/lib/utils";

type TeamDrawModuleProps = {
  rachaTitle: string;
  modality: string;
  futebolType?: string | null;
  voleiType?: string | null;
  enrollments: TeamDrawParticipant[];
};

const INITIAL_DRAW_DELAY_MS = 5000;
const TEAM_REVEAL_DELAY_MS = 850;

export function TeamDrawModule({
  rachaTitle,
  modality,
  futebolType,
  voleiType,
  enrollments,
}: TeamDrawModuleProps) {
  const teamCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [seed, setSeed] = useState(() => Date.now());
  const [drawnAt, setDrawnAt] = useState<Date | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [revealedTeamCount, setRevealedTeamCount] = useState(0);
  const [exportFormat, setExportFormat] = useState<"whatsapp" | null>(null);
  const { addToast, removeToast, toasts } = useToast();
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
    setTeamCount(Math.min(suggestedTeamCount, maxTeamCount));
  }, [maxTeamCount, suggestedTeamCount]);

  const teams = useMemo(
    () =>
      drawBalancedTeams({
        participants: enrollments,
        teamCount,
        modality,
        seed,
      }),
    [enrollments, modality, seed, teamCount],
  );
  const whatsappMessage = useMemo(
    () => buildTeamDrawMessage(rachaTitle, teams, drawnAt ?? undefined),
    [drawnAt, rachaTitle, teams],
  );

  useEffect(() => {
    if (!isDrawing) {
      return;
    }

    if (revealedTeamCount >= teams.length) {
      setIsDrawing(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      setRevealedTeamCount((current) => current + 1);
    }, revealedTeamCount === 0 ? INITIAL_DRAW_DELAY_MS : TEAM_REVEAL_DELAY_MS);

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

  const handleDraw = () => {
    setSeed(Date.now());
    setDrawnAt(new Date());
    setRevealedTeamCount(0);
    setExportFormat(null);
    setIsDrawing(true);
  };

  const currentRevealTeam =
    isDrawing && teams.length > 0 && revealedTeamCount > 0
      ? teams[Math.min(revealedTeamCount, teams.length - 1)]
      : null;

  const handleCopy = async () => {
    if (!drawnAt) {
      addToast("Realize o sorteio antes de exportar.", "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(whatsappMessage);
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

    setExportFormat("whatsapp");
  };

  const handleOpenWhatsapp = () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  if (enrollments.length < 2 || linePlayers.length < 2) {
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
            Revise os atletas confirmados e seus niveis antes de realizar o sorteio.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {linePlayers.length} atletas de linha confirmados
            {goalkeepers.length > 0 ? ` • ${goalkeepers.length} goleiro(s)` : ""}
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
                  {index + 1}. {participant.participantName}
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
              O sistema monta times balanceados e revela um por vez, como se o sorteio estivesse acontecendo agora.
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

            <Button onClick={handleWhatsappExport} type="button" variant="outline">
              <MessageCircle className="h-4 w-4" />
              Exportar para WhatsApp
            </Button>

            <Button onClick={handleCopy} type="button" variant="ghost">
              <Copy className="h-4 w-4" />
              Copiar texto
            </Button>
          </div>
        </div>

        {!drawnAt ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 px-6 py-10 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
              Aguardando sorteio
            </p>
            <p className="mt-3 text-base text-slate-700">
              Clique em <strong>Realizar sorteio agora</strong> para revelar os times.
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
                  {Math.min(revealedTeamCount, teams.length)} de {teams.length} time(s)
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

        {exportFormat === "whatsapp" ? (
          <div className="space-y-4 rounded-3xl border border-slate-200 bg-white/90 p-4">
            <div className="max-h-[38vh] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-900 whitespace-pre-wrap sm:max-h-[50vh]">
              {whatsappMessage}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleCopy} className="flex-1" type="button">
                <Copy className="h-4 w-4" />
                Copiar mensagem
              </Button>

              <Button onClick={handleOpenWhatsapp} className="flex-1" type="button">
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
                          <h4 className="text-lg font-bold text-slate-950">{team.name}</h4>
                          <p className="text-xs text-slate-500">{team.totalScore} pontos totais</p>
                        </div>
                        <div className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                          {team.players.length + team.goalkeepers.length} atletas
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        {team.players.map((participant, participantIndex) => (
                          <div
                            key={participant.id}
                            className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-950">
                                  {participantIndex + 1}. {participant.participantName}
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
                          </div>
                        ))}
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
                                  {getParticipantLevelVisual(goalkeeper.participantLevel)}
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
      </Card>
    </div>
  );
}