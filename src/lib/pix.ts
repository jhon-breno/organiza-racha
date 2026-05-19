function formatPixField(id: string, value: string) {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

function normalizePixLabel(value: string, maxLength: number, fallback: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 /-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

  return normalized || fallback;
}

function getPixCrc16(value: string) {
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

export function buildPixPaymentPayload(input: {
  pixKey: string;
  amountInCents: number;
  merchantName: string;
  merchantCity: string;
  description?: string;
}) {
  const pixKey = input.pixKey.trim();

  if (!pixKey) {
    return "";
  }

  const merchantAccountInfo = [
    formatPixField("00", "br.gov.bcb.pix"),
    formatPixField("01", pixKey),
    input.description?.trim()
      ? formatPixField("02", input.description.trim().slice(0, 72))
      : "",
  ].join("");

  const merchantName = normalizePixLabel(
    input.merchantName,
    25,
    "ORGANIZA RACHA",
  );
  const merchantCity = normalizePixLabel(input.merchantCity, 15, "FORTALEZA");
  const amount = (Math.max(input.amountInCents, 0) / 100).toFixed(2);
  const additionalDataField = formatPixField("05", "***");

  const payload = [
    formatPixField("00", "01"),
    formatPixField("01", "11"),
    formatPixField("26", merchantAccountInfo),
    formatPixField("52", "0000"),
    formatPixField("53", "986"),
    formatPixField("54", amount),
    formatPixField("58", "BR"),
    formatPixField("59", merchantName),
    formatPixField("60", merchantCity),
    formatPixField("62", additionalDataField),
  ].join("");

  const payloadWithCrcId = `${payload}6304`;
  const crc = getPixCrc16(payloadWithCrcId);

  return `${payloadWithCrcId}${crc}`;
}