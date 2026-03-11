import { type ClassValue, clsx } from "clsx";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { twMerge } from "tailwind-merge";

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

export function formatCurrencyFromCents(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

export function formatDateTime(date: Date) {
  return format(date, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
}

export function formatDateTimeShort(date: Date) {
  return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function formatDateInput(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function formatTimeInput(date: Date) {
  return format(date, "HH:mm");
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
