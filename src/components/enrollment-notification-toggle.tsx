"use client";

import { useTransition } from "react";
import { Bell, BellOff } from "lucide-react";
import { toggleRachaEnrollmentNotificationAction } from "@/actions";
import { Button } from "@/components/ui/button";

type EnrollmentNotificationToggleProps = {
  rachaId: string;
  enabled: boolean;
  callbackUrl?: string;
};

export function EnrollmentNotificationToggle({
  rachaId,
  enabled,
  callbackUrl,
}: EnrollmentNotificationToggleProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          await toggleRachaEnrollmentNotificationAction(formData);
        });
      }}
      className="inline-flex items-center"
    >
      <input name="rachaId" type="hidden" value={rachaId} />
      {callbackUrl ? (
        <input name="callbackUrl" type="hidden" value={callbackUrl} />
      ) : null}

      <Button
        className={`gap-2 font-medium ${
          enabled
            ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
        }`}
        disabled={isPending}
        size="sm"
        type="submit"
        variant="outline"
      >
        {enabled ? (
          <>
            <Bell className="h-4 w-4 text-emerald-600" />
            <span>Confirmação no WhatsApp: <strong>Ativa</strong></span>
          </>
        ) : (
          <>
            <BellOff className="h-4 w-4 text-slate-400" />
            <span>Confirmação no WhatsApp: <strong>Desativada</strong></span>
          </>
        )}
      </Button>
    </form>
  );
}
