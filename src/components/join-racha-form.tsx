"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { joinRachaAction, validatePrivateAccessKeyAction } from "@/actions";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  levelOptions,
  positionOptions,
  positionOptionsFutebol,
  positionOptionsVolei,
} from "@/lib/constants";
import { isGoalkeeperPosition } from "@/lib/enrollment";

export function JoinRachaForm({
  privateAccessGranted = false,
  defaultParticipantName,
  defaultParticipantPhone,
  isAuthenticated = false,
  racha,
}: {
  privateAccessGranted?: boolean;
  defaultParticipantName?: string;
  defaultParticipantPhone?: string;
  isAuthenticated?: boolean;
  racha: {
    id: string;
    slug: string;
    title: string;
    modality: string;
    visibility: "OPEN" | "PRIVATE";
    phoneWhatsapp: string;
    rules: string;
    goalkeeperLimit?: number | null;
    setterLimit?: number | null;
    hasFixedSetter?: boolean;
  };
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [accessKey, setAccessKey] = useState("");
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [allowGuestSubmit, setAllowGuestSubmit] = useState(false);
  const [keyValidationState, validateAccessKey, isValidatingKey] =
    useActionState(validatePrivateAccessKeyAction, {
      success: false,
    });

  const isPrivateRacha = racha.visibility === "PRIVATE";
  const isKeyStepConfirmed =
    !isPrivateRacha || privateAccessGranted || keyValidationState.success;
  const organizerWhatsappMessage = `Eu quero participar no racha *${racha.title}*. Por favor me informar a chave para entrar na lista`;
  const organizerWhatsappUrl = `https://wa.me/${racha.phoneWhatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(organizerWhatsappMessage)}`;
  const [selectedPosition, setSelectedPosition] = useState("Versátil");

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
  const isGoalkeeperSelection = isGoalkeeperPosition(selectedPosition);

  function handleAccessKeyChange(value: string) {
    setAccessKey(value);
  }

  function handleJoinSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (isAuthenticated || allowGuestSubmit) {
      return;
    }

    event.preventDefault();
    setShowLoginPrompt(true);
  }

  function handleGuestSubmit() {
    setAllowGuestSubmit(true);
    setShowLoginPrompt(false);

    requestAnimationFrame(() => {
      formRef.current?.requestSubmit();
      setAllowGuestSubmit(false);
    });
  }

  function handleSignInRedirect() {
    router.push(`/auth/signin?callbackUrl=${encodeURIComponent(`/rachas/${racha.slug}`)}`);
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
            : isGoalkeeperSelection
              ? "Informe seus dados e finalize a inscrição. Goleiro entra confirmado automaticamente e não paga taxa."
              : "Informe seus dados e aceite as regras. Após a inscrição, o pagamento é feito pela sua área de inscrições com QR Code PIX."}
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

      {isKeyStepConfirmed && isGoalkeeperSelection ? (
        <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">Inscrição de goleiro sem taxa</p>
          <p className="mt-1">Goleiro entra confirmado automaticamente e não precisa enviar PIX.</p>
        </div>
      ) : null}

      {isKeyStepConfirmed ? (
        <form
          action={joinRachaAction}
          className="space-y-4"
          onSubmit={handleJoinSubmit}
          ref={formRef}
        >
          <input name="rachaId" type="hidden" value={racha.id} />
          <input name="slug" type="hidden" value={racha.slug} />
          {isPrivateRacha ? (
            <input name="accessKey" type="hidden" value={accessKey} />
          ) : null}

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Seu nome
            <Input
              defaultValue={defaultParticipantName ?? ""}
              name="participantName"
              placeholder="Nome completo"
              required
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Telefone
            <PhoneInput
              defaultValue={defaultParticipantPhone ?? ""}
              name="participantPhone"
              placeholder="99 9 9999-9999"
              required
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Posição
              <Select
                defaultValue="Versátil"
                name="participantPosition"
                onChange={(event) => setSelectedPosition(event.target.value)}
              >
                {availablePositions.map((position) => (
                  <option key={position} value={position}>
                    {position}
                  </option>
                ))}
              </Select>
            </label>

            <label className="space-y-2 text-sm font-medium text-slate-700">
              Nível
              <Select defaultValue="STAR_3" name="participantLevel">
                {levelOptions.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.visual} {level.label}
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

          {!isGoalkeeperSelection ? (
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <input
                className="mt-1 h-4 w-4 rounded border-slate-300"
                name="paymentCommitment"
                type="checkbox"
              />
              <span>
                Confirmo que só estarei na lista quando realizar o pagamento.
              </span>
            </label>
          ) : null}

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
            pendingLabel="Solicitando participação..."
          >
            Solicitar participação
          </SubmitButton>
        </form>
      ) : null}

      {showLoginPrompt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
              Confirmar inscricao
            </p>
            <h3 className="mt-2 text-2xl font-black text-slate-950">
              Quer realizar login?
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Voce pode entrar na conta para acompanhar a inscricao em Minhas inscricoes ou continuar agora sem login.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button onClick={handleSignInRedirect} type="button">
                Sim
              </Button>
              <Button onClick={handleGuestSubmit} type="button" variant="outline">
                Nao. Inscrever agora
              </Button>
            </div>

            <Button
              className="mt-3 w-full"
              onClick={() => setShowLoginPrompt(false)}
              type="button"
              variant="ghost"
            >
              Fechar
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
