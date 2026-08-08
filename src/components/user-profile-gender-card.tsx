"use client";

import { updateUserProfileGenderAction } from "@/actions";
import { SubmitButton } from "@/components/submit-button";
import { Card } from "@/components/ui/card";
import { useState } from "react";

type UserProfileGenderCardProps = {
  userName?: string | null;
  isFemale: boolean;
};

export function UserProfileGenderCard({
  userName,
  isFemale: initialIsFemale,
}: UserProfileGenderCardProps) {
  const [isFemale, setIsFemale] = useState(initialIsFemale);

  return (
    <Card className="border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Perfil do Atleta ({userName || "Usuário"})
          </h2>
          <p className="text-sm text-slate-600">
            Marque se você é atleta do sexo feminino para auxiliar no equilíbrio de times em rachas mistos.
          </p>
        </div>

        <form action={updateUserProfileGenderAction} className="flex items-center gap-4">
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-800 cursor-pointer">
            <input
              checked={isFemale}
              className="h-4 w-4 rounded border-slate-300 text-pink-600 focus:ring-pink-500"
              name="isFemale"
              onChange={(e) => setIsFemale(e.target.checked)}
              type="checkbox"
            />
            <span className="whitespace-nowrap">Sou Mulher</span>
          </label>

          <SubmitButton
            className="bg-slate-900 text-xs text-white hover:bg-slate-800"
            pendingLabel="Salvando..."
          >
            Salvar
          </SubmitButton>
        </form>
      </div>
    </Card>
  );
}
