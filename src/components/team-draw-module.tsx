"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Shuffle } from "lucide-react";
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

type TeamDrawModuleProps = {
  rachaTitle: string;
  modality: string;
  futebolType?: string | null;
  voleiType?: string | null;
  enrollments: TeamDrawParticipant[];
};

export function TeamDrawModule({
  rachaTitle,
  modality,
  futebolType,
  voleiType,
  enrollments,
}: TeamDrawModuleProps) {
  const [seed, setSeed] = useState(() => Date.now());
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
    () => buildTeamDrawMessage(rachaTitle, teams),
    [rachaTitle, teams],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(whatsappMessage);
      addToast("Sorteio copiado para a área de transferência.", "success");
    } catch {
      addToast("Não foi possível copiar o sorteio.", "error");
    }
  };

  if (enrollments.length < 2 || linePlayers.length < 2) {
    return (
      <Card>
        <h3 className="text-lg font-bold text-slate-950">Sorteio de times</h3>
        <p className="mt-2 text-sm text-slate-600">
          É preciso ter pelo menos 2 atletas confirmados para gerar o sorteio.
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-5">
      <ToastContainer onRemove={removeToast} toasts={toasts} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
            Sorteio de times
          </p>
          <h3 className="mt-1 text-2xl font-black text-slate-950">
            Distribuição equilibrada por estrelas
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            O sorteio usa o nível em estrelas para equilibrar a força média das equipes.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {linePlayers.length} atletas de linha confirmados
            {goalkeepers.length > 0
              ? ` • ${goalkeepers.length} goleiro(s)`
              : ""}
            {` • sugestão: ${suggestedTeamCount} time(s)`}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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

          <Button onClick={() => setSeed(Date.now())} type="button">
            <Shuffle className="h-4 w-4" />
            Sortear novamente
          </Button>

          <Button onClick={handleCopy} type="button" variant="outline">
            <Copy className="h-4 w-4" />
            Copiar sorteio
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {teams.map((team) => (
          <div
            key={team.id}
            className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-lg font-bold text-slate-950">{team.name}</h4>
                <p className="text-xs text-slate-500">{team.totalScore} pontos totais</p>
              </div>
              <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                {team.players.length + team.goalkeepers.length} atletas
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {team.players.map((participant, index) => (
                <div
                  key={participant.id}
                  className="rounded-2xl border border-white bg-white px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
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
          </div>
        ))}
      </div>
    </Card>
  );
}