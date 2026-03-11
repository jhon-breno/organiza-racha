"use client";

import { useActionState, useEffect, useState } from "react";
import { User } from "next-auth";
import { useRouter } from "next/navigation";
import { joinRachaAction, validatePrivateAccessKeyAction } from "@/actions";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  levelOptions,
  positionOptions,
  positionOptionsFutebol,
  positionOptionsVolei,
} from "@/lib/constants";

export function JoinRachaForm({
  privateAccessGranted = false,
  racha,
  sessionUser,
}: {
  privateAccessGranted?: boolean;
  racha: {
    id: string;
    slug: string;
    title: string;
    modality: string;
    visibility: "OPEN" | "PRIVATE";
    pixKey: string;
    phoneWhatsapp: string;
    rules: string;
    goalkeeperLimit?: number | null;
    setterLimit?: number | null;
    hasFixedSetter?: boolean;
  };
  sessionUser?: User;
}) {
  const router = useRouter();
  const [accessKey, setAccessKey] = useState("");
  const [keyValidationState, validateAccessKey, isValidatingKey] =
    useActionState(validatePrivateAccessKeyAction, {
      success: false,
    });

  const isPrivateRacha = racha.visibility === "PRIVATE";
  const isKeyStepConfirmed =
    !isPrivateRacha || privateAccessGranted || keyValidationState.success;
  const organizerWhatsappMessage = `Eu quero participar no racha *${racha.title}*. Por favor me informar a chave para entrar na lista`;
  const organizerWhatsappUrl = `https://wa.me/${racha.phoneWhatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(organizerWhatsappMessage)}`;

  const availablePositions =
    racha.modality === "FUTEBOL"
      ? positionOptionsFutebol
      : racha.modality === "VOLEI"
        ? positionOptionsVolei
        : positionOptions;

  const keyValidationMessage =
    isPrivateRacha && !keyValidationState.success
      ? keyValidationState.message
      : null;

  function handleAccessKeyChange(value: string) {
    setAccessKey(value);
  }

  useEffect(() => {
    if (keyValidationState.success) {
      router.refresh();
    }
  }, [keyValidationState.success, router]);

  return (
    <Card className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-950">
          Entrar neste racha
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {isPrivateRacha
            ? "Racha privado: confirme a chave secreta para liberar o formulário de inscrição."
            : "Informe seus dados, confirme o PIX do organizador e aceite as regras para garantir sua vaga."}
        </p>
      </div>

      {isPrivateRacha && !isKeyStepConfirmed ? (
        <form action={validateAccessKey} className="space-y-4">
          <input name="rachaId" type="hidden" value={racha.id} />

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Chave secreta do racha
            <Input
              name="accessKey"
              onChange={(event) => handleAccessKeyChange(event.target.value)}
              placeholder="Digite a chave enviada pelo organizador"
              value={accessKey}
            />
          </label>

          {keyValidationMessage ? (
            <p className="text-sm font-medium text-rose-600">
              {keyValidationMessage}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Button className="w-full" disabled={isValidatingKey} type="submit">
              {isValidatingKey ? "Validando chave..." : "Confirmar chave"}
            </Button>
            <Button
              asChild
              className="w-full"
              href={organizerWhatsappUrl}
              rel="noopener noreferrer"
              target="_blank"
              variant="outline"
            >
              Solicitar chave
            </Button>
          </div>
        </form>
      ) : null}

      {isKeyStepConfirmed ? (
        <div className="rounded-2xl border border-dashed border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
          <p className="font-semibold">Chave PIX do organizador</p>
          <p className="mt-1 break-all">{racha.pixKey}</p>
        </div>
      ) : null}

      {isKeyStepConfirmed ? (
        <form action={joinRachaAction} className="space-y-4">
          <input name="rachaId" type="hidden" value={racha.id} />
          <input name="slug" type="hidden" value={racha.slug} />
          {isPrivateRacha ? (
            <input name="accessKey" type="hidden" value={accessKey} />
          ) : null}

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Seu nome
            <Input
              defaultValue={sessionUser?.name ?? ""}
              name="participantName"
              placeholder="Nome completo"
              required
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Telefone
            <Input name="participantPhone" placeholder="11999999999" required />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Posição
              <Select defaultValue="Versátil" name="participantPosition">
                {availablePositions.map((position) => (
                  <option key={position} value={position}>
                    {position}
                  </option>
                ))}
              </Select>
            </label>

            <label className="space-y-2 text-sm font-medium text-slate-700">
              Nível
              <Select defaultValue="INTERMEDIARIO" name="participantLevel">
                {levelOptions.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Observações (opcional)
            <Textarea
              name="notes"
              placeholder="Ex.: jogo melhor pelo lado direito, posso chegar mais cedo..."
            />
          </label>

          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <input
              className="mt-1 h-4 w-4 rounded border-slate-300"
              name="pixPaid"
              type="checkbox"
            />
            <span>
              Confirmo que realizei o pagamento via PIX com a chave informada
              acima.
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <input
              className="mt-1 h-4 w-4 rounded border-slate-300"
              name="acceptedRules"
              type="checkbox"
            />
            <span>
              Li e aceito as regras do racha, incluindo política de desistência
              e reembolso.
            </span>
          </label>

          <SubmitButton
            className="w-full"
            pendingLabel="Confirmando inscrição..."
          >
            Confirmar participação
          </SubmitButton>
        </form>
      ) : null}
    </Card>
  );
}
