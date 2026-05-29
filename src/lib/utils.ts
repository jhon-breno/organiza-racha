import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { defaultCoverByModality } from "@/lib/constants";

export const APP_TIME_ZONE = "America/Sao_Paulo";

type DatePartKey = "year" | "month" | "day" | "hour" | "minute" | "second";

function normalizeDateValue(date: Date | string | number) {
  const parsed = date instanceof Date ? date : new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Data inválida.");
  }

  return parsed;
}

function getTimeZoneFormatter(
  options: Intl.DateTimeFormatOptions,
  locale = "pt-BR",
) {
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: APP_TIME_ZONE,
  });
}

function getTimeZoneParts(date: Date | string | number) {
  const normalized = normalizeDateValue(date);
  const formatter = getTimeZoneFormatter(
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    },
    "en-CA",
  );

  return formatter.formatToParts(normalized).reduce(
    (parts, part) => {
      if (
        part.type === "year" ||
        part.type === "month" ||
        part.type === "day" ||
        part.type === "hour" ||
        part.type === "minute" ||
        part.type === "second"
      ) {
        parts[part.type] = part.value;
      }

      return parts;
    },
    {} as Record<DatePartKey, string>,
  );
}

function getTimeZoneOffsetMilliseconds(date: Date | string | number) {
  const normalized = normalizeDateValue(date);
  const parts = getTimeZoneParts(normalized);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );

  return asUtc - normalized.getTime();
}

export function createDateInAppTimeZone(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);

  if ([year, month, day, hour, minute].some((value) => Number.isNaN(value))) {
    throw new Error("Data ou horário inválido.");
  }

  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offset = getTimeZoneOffsetMilliseconds(utcGuess);

  return new Date(utcGuess.getTime() - offset);
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);

  return slug || "racha";
}

export function normalizeSearchText(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function formatPhoneInput(value?: string | null) {
  const rawDigits = (value ?? "").replace(/\D/g, "");
  const digits =
    rawDigits.length > 11 && rawDigits.startsWith("55")
      ? rawDigits.slice(2, 13)
      : rawDigits.slice(0, 11);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 3) {
    return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  }

  if (digits.length <= 7) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 3)} ${digits.slice(3)}`;
  }

  return `${digits.slice(0, 2)} ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function formatPhone(value?: string | null) {
  const rawDigits = (value ?? "").replace(/\D/g, "");
  const digits =
    rawDigits.length > 11 && rawDigits.startsWith("55")
      ? rawDigits.slice(2, 13)
      : rawDigits.slice(0, 11);

  if (digits.length < 10) return value ?? "";

  if (digits.length === 10) {
    // Fixo: (99) 9999-9999
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  // Celular: (99) 9 9999-9999
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function formatCurrencyFromCents(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

export function formatDateTime(date: Date) {
  const normalized = normalizeDateValue(date);
  const parts = getTimeZoneParts(normalized);
  const monthName = getTimeZoneFormatter({ month: "long" }).format(normalized);

  return `${parts.day} de ${monthName} às ${parts.hour}:${parts.minute}`;
}

export function formatDateTimeShort(date: Date) {
  const parts = getTimeZoneParts(date);

  return `${parts.day}/${parts.month}/${parts.year} às ${parts.hour}:${parts.minute}`;
}

export function formatDateInput(date: Date) {
  const parts = getTimeZoneParts(date);

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatTimeInput(date: Date) {
  const parts = getTimeZoneParts(date);

  return `${parts.hour}:${parts.minute}`;
}

export function getMapsEmbedUrl(query?: string | null) {
  if (!query) {
    return null;
  }

  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

export function buildMessageUrl(
  path: string,
  status: "success" | "error",
  message: string,
  extraParams?: Record<string, string | undefined>,
) {
  const params = new URLSearchParams();
  params.set("status", status);
  params.set("message", message);

  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      if (typeof value === "string" && value.length > 0) {
        params.set(key, value);
      }
    }
  }

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${params.toString()}`;
}

export function getInitials(name?: string | null) {
  if (!name) return "OR";

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function getPrivateRachaAccessCookieName(rachaId: string) {
  return `private-racha-access-${rachaId}`;
}

export function getRachaCoverImageUrl(
  modality: string,
  coverImageUrl?: string | null,
) {
  if (coverImageUrl && coverImageUrl.trim().length > 0) {
    return coverImageUrl;
  }

  return defaultCoverByModality[modality] ?? defaultCoverByModality.OUTRO;
}
