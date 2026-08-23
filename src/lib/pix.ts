function formatPixField(id: string, value: string) {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

export function normalizePixLabel(
  value: string | undefined | null,
  maxLength: number,
  fallback: string,
) {
  const normalized = (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

  return normalized || fallback;
}

export function extractPixCity(cityOrAddress: string | undefined | null): string {
  if (!cityOrAddress) return "FORTALEZA";
  
  // Se for endereço longo, tentar extrair a cidade (ex: "... - Montese, Fortaleza - CE, 60410-462")
  const text = cityOrAddress.trim();
  
  // Se já for uma cidade curta (ex: "Fortaleza", "São Paulo", "Caucaia")
  if (text.length <= 15 && !text.includes("(") && !text.includes("http")) {
    return normalizePixLabel(text, 15, "FORTALEZA");
  }

  // Tentar encontrar padrão Cidade - UF
  const matchUf = text.match(/,\s*([A-Za-zÀ-ÿ\s]+)\s*-\s*[A-Z]{2}/);
  if (matchUf && matchUf[1]) {
    return normalizePixLabel(matchUf[1], 15, "FORTALEZA");
  }

  return normalizePixLabel(text, 15, "FORTALEZA");
}

export function getPixCrc16(value: string) {
  let crc = 0xffff;

  for (let index = 0; index < value.length; index += 1) {
    crc ^= value.charCodeAt(index) << 8;

    for (let bit = 0; bit < 8; bit += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }

      crc &= 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function isValidCpf(digits: string): boolean {
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += parseInt(digits[i], 10) * (10 - i);
  }
  let rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(digits[9], 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) {
    sum += parseInt(digits[i], 10) * (11 - i);
  }
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  return rest === parseInt(digits[10], 10);
}

/**
 * Normaliza uma chave PIX de acordo com o padrão do Banco Central do Brasil:
 * - Telefone: +55DDDXXXXXXXXX (ex: 85986213389 -> +5585986213389)
 * - CPF: 11 dígitos numéricos (ex: 055.042.393-11 -> 05504239311)
 * - CNPJ: 14 dígitos numéricos (ex: 12.345.678/0001-90 -> 12345678000190)
 * - Email: minúsculo e sem espaços (ex: user@email.com)
 * - Chave aleatória (EVP/UUID): minúsculo (ex: 6ed79e38-39b9-4681-adbd-e44c5359e8ad)
 * - Código Copia e Cola já completo (começa com 000201): mantido
 */
export function normalizePixKey(rawKey: string | undefined | null): string {
  const key = (rawKey || "").trim();
  if (!key) return "";

  // Se já for um payload BR Code completo
  if (key.startsWith("000201")) {
    return key;
  }

  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) {
    return key.toLowerCase().trim();
  }

  // Chave aleatória (UUID/EVP)
  if (
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
      key,
    )
  ) {
    return key.toLowerCase().trim();
  }

  // Extrair apenas dígitos
  const digits = key.replace(/\D/g, "");

  // Telefone internacional já com +
  if (key.startsWith("+") && digits.length >= 10) {
    return `+${digits}`;
  }

  // CNPJ (14 dígitos)
  if (digits.length === 14) {
    return digits;
  }

  // Telefone com 55 na frente (12 ou 13 dígitos)
  if (
    (digits.length === 12 || digits.length === 13) &&
    digits.startsWith("55")
  ) {
    return `+${digits}`;
  }

  // Formatado com símbolos de telefone (ex: (85) 98621-3389 ou 85-98621-3389)
  if (
    key.includes("(") ||
    key.includes(")") ||
    (key.includes("-") && !key.includes("."))
  ) {
    return `+55${digits}`;
  }

  // Formatado explicitamente como CPF com pontos (ex: 055.042.393-11)
  if (key.includes(".") && digits.length === 11) {
    return digits;
  }

  // 10 dígitos (telefone fixo com DDD)
  if (digits.length === 10) {
    return `+55${digits}`;
  }

  // 11 dígitos:
  if (digits.length === 11) {
    // Se passar na validação de CPF matemático, considera CPF
    if (isValidCpf(digits)) {
      return digits;
    }
    // Caso contrário, é um celular brasileiro com DDD (ex: 85986213389 -> +5585986213389)
    return `+55${digits}`;
  }

  return key;
}

export type PixKeyType =
  | "CPF"
  | "CNPJ"
  | "PHONE"
  | "EMAIL"
  | "EVP"
  | "PAYLOAD"
  | "UNKNOWN";

export function getPixKeyType(rawKey: string | undefined | null): PixKeyType {
  const key = (rawKey || "").trim();
  if (!key) return "UNKNOWN";
  if (key.startsWith("000201")) return "PAYLOAD";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) return "EMAIL";
  if (
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
      key,
    )
  ) {
    return "EVP";
  }
  const digits = key.replace(/\D/g, "");
  if (digits.length === 14) return "CNPJ";
  if (key.startsWith("+") || key.includes("(") || key.includes(")")) return "PHONE";
  if (digits.length === 10) return "PHONE";
  if (digits.length === 11) {
    if (isValidCpf(digits)) return "CPF";
    return "PHONE";
  }
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    return "PHONE";
  }
  return "UNKNOWN";
}

export function buildPixPaymentPayload(input: {
  pixKey: string;
  amountInCents?: number | null;
  merchantName?: string | null;
  merchantCity?: string | null;
  description?: string | null;
  txId?: string | null;
}) {
  const normalizedKey = normalizePixKey(input.pixKey);

  if (!normalizedKey) {
    return "";
  }

  // Se já for um payload BR Code pronto
  if (normalizedKey.startsWith("000201")) {
    return normalizedKey;
  }

  // Tag 26: Merchant Account Information (GUI br.gov.bcb.pix + chave)
  const merchantAccountInfo = [
    formatPixField("00", "br.gov.bcb.pix"),
    formatPixField("01", normalizedKey),
  ].join("");

  const merchantName = normalizePixLabel(
    input.merchantName,
    25,
    "ORGANIZADOR",
  );
  const merchantCity = extractPixCity(input.merchantCity);

  const amountInCents =
    typeof input.amountInCents === "number" && input.amountInCents > 0
      ? input.amountInCents
      : 0;
  const amountStr = amountInCents > 0 ? (amountInCents / 100).toFixed(2) : "";

  const txId = (input.txId || "***")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 25) || "***";

  // Tag 62: Additional Data Field (TxID)
  const additionalDataField = formatPixField("05", txId);

  const payload = [
    formatPixField("00", "01"),
    formatPixField("26", merchantAccountInfo),
    formatPixField("52", "0000"),
    formatPixField("53", "986"),
    amountStr ? formatPixField("54", amountStr) : "",
    formatPixField("58", "BR"),
    formatPixField("59", merchantName),
    formatPixField("60", merchantCity),
    formatPixField("62", additionalDataField),
  ].join("");

  const payloadWithCrcId = `${payload}6304`;
  const crc = getPixCrc16(payloadWithCrcId);

  return `${payloadWithCrcId}${crc}`;
}
