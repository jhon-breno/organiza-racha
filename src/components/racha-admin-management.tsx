"use client";

import { useEffect, useMemo, useState } from "react";
import { addRachaAdminAction, removeRachaAdminAction } from "@/actions";
import { SubmitButton } from "@/components/submit-button";
import { Card } from "@/components/ui/card";
import { formatPhone } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type AdminCandidate = {
  id: string;
  name: string;
  phone: string;
  email: string;
};

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function RachaAdminManagement({
  rachaId,
  organizer,
  admins,
}: {
  rachaId: string;
  organizer: {
    name: string | null;
    phone: string | null;
    email: string | null;
  };
  admins: Array<{
    id: string;
    userId: string;
    user: {
      id: string;
      name: string | null;
      phone: string | null;
      email: string | null;
    };
  }>;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [candidates, setCandidates] = useState<AdminCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const normalizedTerm = useMemo(
    () => normalizeSearchValue(searchTerm),
    [searchTerm],
  );

  useEffect(() => {
    if (normalizedTerm.length < 2) {
      setCandidates([]);
      setSelectedUserId("");
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const search = async () => {
      setIsLoading(true);

      try {
        const response = await fetch(
          `/api/dashboard/rachas/${rachaId}/admin-candidates?query=${encodeURIComponent(searchTerm)}`,
          {
            method: "GET",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          setCandidates([]);
          setSelectedUserId("");
          return;
        }

        const data = (await response.json()) as {
          users?: AdminCandidate[];
        };
        const nextCandidates = data.users ?? [];
        setCandidates(nextCandidates);
        setSelectedUserId((current) =>
          nextCandidates.some((candidate) => candidate.id === current)
            ? current
            : (nextCandidates[0]?.id ?? ""),
        );
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        setCandidates([]);
        setSelectedUserId("");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void search();

    return () => controller.abort();
  }, [normalizedTerm, rachaId, searchTerm]);

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-950">
          Administradores do racha
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Busque por nome ou telefone cadastrado. As sugestões aparecem enquanto
          você digita e o usuário selecionado ganha acesso completo a este
          racha.
        </p>
      </div>

      <form action={addRachaAdminAction} className="space-y-4">
        <input name="rachaId" type="hidden" value={rachaId} />
        <input name="adminUserId" type="hidden" value={selectedUserId} />

        <label className="space-y-2 text-sm font-medium text-slate-700">
          Buscar usuário por nome ou telefone
          <Input
            name="adminSearch"
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Ex.: Ítalo ou 85999469423"
            value={searchTerm}
          />
        </label>

        {normalizedTerm.length < 2 ? (
          <p className="text-sm text-slate-500">
            Digite pelo menos 2 caracteres para pesquisar.
          </p>
        ) : isLoading ? (
          <p className="text-sm text-slate-500">Pesquisando usuários...</p>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhum usuário compatível encontrado para adicionar como admin.
          </p>
        ) : (
          <div className="space-y-2">
            {candidates.map((candidate) => {
              const isSelected = candidate.id === selectedUserId;

              return (
                <button
                  key={candidate.id}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    isSelected
                      ? "border-teal-500 bg-teal-50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                  onClick={() => setSelectedUserId(candidate.id)}
                  type="button"
                >
                  <p className="font-semibold text-slate-950">
                    {candidate.name || "Sem nome"}
                  </p>
                  <p className="text-sm text-slate-600">
                    {candidate.phone || "Sem telefone"}
                    {candidate.email ? ` • ${candidate.email}` : ""}
                  </p>
                </button>
              );
            })}
          </div>
        )}

        <div>
          <SubmitButton
            disabled={!selectedUserId}
            pendingLabel="Adicionando..."
            size="sm"
          >
            Adicionar admin selecionado
          </SubmitButton>
        </div>
      </form>

      <div className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">
            Organizador principal
          </p>
          <p className="text-sm text-slate-600">
            {organizer.name || "Sem nome"}
            {organizer.phone ? ` • ${formatPhone(organizer.phone)}` : ""}
            {organizer.email ? ` • ${organizer.email}` : ""}
          </p>
        </div>

        {admins.length === 0 ? (
          <p className="text-sm text-slate-600">
            Nenhum admin adicional cadastrado.
          </p>
        ) : (
          admins.map((admin) => (
            <div
              key={admin.id}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="font-semibold text-slate-950">
                  {admin.user.name || "Sem nome"}
                </p>
                <p className="text-sm text-slate-600">
                  {admin.user.phone || "Sem telefone"}
                  {admin.user.email ? ` • ${admin.user.email}` : ""}
                </p>
              </div>

              <form action={removeRachaAdminAction}>
                <input name="rachaId" type="hidden" value={rachaId} />
                <input name="adminUserId" type="hidden" value={admin.userId} />
                <SubmitButton
                  pendingLabel="Removendo..."
                  size="sm"
                  variant="outline"
                >
                  Remover admin
                </SubmitButton>
              </form>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
