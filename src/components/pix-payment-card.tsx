"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, QrCode as QrCodeIcon, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildPixPaymentPayload,
  getPixKeyType,
  normalizePixKey,
} from "@/lib/pix";
import { formatCurrencyFromCents } from "@/lib/utils";

type PixPaymentCardProps = {
  pixKey: string;
  priceInCents: number;
  rachaTitle?: string;
  organizerDisplayName?: string | null;
  rachaCity?: string | null;
  pixBankName?: string | null;
  pixHolderName?: string | null;
  className?: string;
  showTitle?: boolean;
};

export function PixPaymentCard({
  pixKey,
  priceInCents,
  rachaTitle,
  organizerDisplayName,
  rachaCity,
  pixBankName,
  pixHolderName,
  className = "",
  showTitle = false,
}: PixPaymentCardProps) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [copiedType, setCopiedType] = useState<"payload" | "key" | null>(null);

  const normalizedKey = useMemo(() => normalizePixKey(pixKey), [pixKey]);
  const keyType = useMemo(() => getPixKeyType(pixKey), [pixKey]);

  const pixPayload = useMemo(() => {
    return buildPixPaymentPayload({
      pixKey,
      amountInCents: priceInCents,
      merchantName: pixHolderName || organizerDisplayName || "ORGANIZADOR",
      merchantCity: rachaCity || "FORTALEZA",
      description: rachaTitle,
    });
  }, [
    pixKey,
    priceInCents,
    pixHolderName,
    organizerDisplayName,
    rachaCity,
    rachaTitle,
  ]);

  useEffect(() => {
    let isMounted = true;
    if (!pixPayload) {
      return;
    }

    QRCode.toDataURL(pixPayload, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 320,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    })
      .then((url) => {
        if (isMounted) {
          setQrCodeDataUrl(url);
        }
      })
      .catch((err) => {
        console.error("Erro ao gerar QR Code PIX:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [pixPayload]);


  async function handleCopy(text: string, type: "payload" | "key") {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      window.setTimeout(() => setCopiedType(null), 2000);
    } catch {
      // Fallback
      setCopiedType(null);
    }
  }

  const keyTypeLabel = {
    CPF: "CPF",
    CNPJ: "CNPJ",
    PHONE: "Telefone / Celular",
    EMAIL: "E-mail",
    EVP: "Chave Aleatória",
    PAYLOAD: "Código Copia e Cola",
    UNKNOWN: "Chave PIX",
  }[keyType];

  return (
    <div
      className={`flex flex-col items-center rounded-3xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}
    >
      {showTitle && (
        <div className="mb-4 text-center">
          <h3 className="text-lg font-bold text-slate-900">
            Pagamento via PIX
          </h3>
          <p className="text-xs text-slate-500">
            Escaneie o QR Code ou use o código Copia e Cola
          </p>
        </div>
      )}

      {/* QR Code Container */}
      <div className="relative flex aspect-square w-full max-w-[260px] items-center justify-center rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-inner">
        {qrCodeDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt="QR Code PIX"
            className="h-full w-full object-contain"
            src={qrCodeDataUrl}
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
            <QrCodeIcon className="h-10 w-10 animate-pulse text-slate-300" />
            <span className="text-xs">Gerando QR Code...</span>
          </div>
        )}
      </div>

      {/* Total do Pedido */}
      <div className="mt-5 text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Total do Pedido
        </p>
        <p className="mt-1 text-3xl font-extrabold text-emerald-600">
          {formatCurrencyFromCents(priceInCents)}
        </p>
      </div>

      {/* Código Copia e Cola */}
      <div className="mt-5 w-full">
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
          Código Copia e Cola
        </label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <input
              aria-label="Código PIX Copia e Cola"
              className="w-full bg-transparent font-mono text-xs text-slate-700 outline-none select-all"
              readOnly
              type="text"
              value={pixPayload || ""}
            />
          </div>
          <Button
            className={`h-10 shrink-0 gap-1.5 rounded-xl px-4 text-xs font-semibold transition-all ${
              copiedType === "payload"
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
            }`}
            disabled={!pixPayload}
            onClick={() => handleCopy(pixPayload, "payload")}
            type="button"
          >
            {copiedType === "payload" ? (
              <>
                <Check className="h-4 w-4 text-white" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copiar
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Detalhes do Recebedor / Chave */}
      <div className="mt-4 w-full rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-xs text-slate-600">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
          <span className="font-medium text-slate-500">
            Chave ({keyTypeLabel}):
          </span>
          <div className="flex items-center gap-1.5 overflow-hidden">
            <span className="truncate font-mono font-semibold text-slate-800">
              {pixKey}
            </span>
            <button
              className="shrink-0 rounded p-1 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800"
              onClick={() => handleCopy(normalizedKey || pixKey, "key")}
              title="Copiar chave avulsa"
              type="button"
            >
              {copiedType === "key" ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        {(pixHolderName || organizerDisplayName) && (
          <div className="flex items-center justify-between gap-2 pt-2">
            <span className="font-medium text-slate-500">Beneficiário:</span>
            <span className="truncate font-medium text-slate-800">
              {pixHolderName || organizerDisplayName}
            </span>
          </div>
        )}

        {pixBankName && (
          <div className="flex items-center justify-between gap-2 pt-1.5">
            <span className="font-medium text-slate-500">Banco:</span>
            <span className="truncate font-medium text-slate-800">
              {pixBankName}
            </span>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-500">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
        <span>Pagamento seguro via Banco Central do Brasil</span>
      </div>
    </div>
  );
}
