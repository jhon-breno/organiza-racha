import { NextRequest } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function getUnifiedEnrollmentStatus(enrollment: {
  status: string;
  paymentStatus: string;
}) {
  if (
    enrollment.status === "CANCELED" ||
    enrollment.paymentStatus === "REFUNDED"
  ) {
    return "Cancelado";
  }

  if (enrollment.paymentStatus === "REFUND_REQUESTED") {
    return "Aguardando reembolso";
  }

  if (enrollment.status === "WAITLIST") {
    return "Lista de espera";
  }

  if (enrollment.paymentStatus === "PAID") {
    return "Confirmado";
  }

  return "Aguardando pagamento";
}

function getParticipantPixKey(notes?: string | null) {
  if (!notes) {
    return "Não informado";
  }

  const match = notes.match(/PIX para devolução:\s*(.+)/i);
  return match?.[1]?.trim() || "Não informado";
}

function csvEscape(value: string) {
  const normalized = value ?? "";

  if (
    normalized.includes(";") ||
    normalized.includes("\n") ||
    normalized.includes('"')
  ) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

function sanitizePdfText(value: string) {
  return value.replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "");
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response("Não autorizado", { status: 401 });
  }

  const { id } = await context.params;
  const format = request.nextUrl.searchParams.get("format");

  if (format !== "pdf" && format !== "excel") {
    return new Response("Formato inválido", { status: 400 });
  }

  const racha = await prisma.racha.findUnique({
    where: { id },
    include: {
      enrollments: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  if (!racha || racha.organizerId !== session.user.id) {
    return new Response("Racha não encontrado", { status: 404 });
  }

  const rows = racha.enrollments.map((enrollment) => ({
    name: enrollment.participantName,
    status: getUnifiedEnrollmentStatus(enrollment),
    phone: enrollment.participantPhone,
    pixKey: getParticipantPixKey(enrollment.notes),
  }));

  if (format === "excel") {
    const header = ["Nome", "Status", "Telefone", "Chave PIX"];
    const lines = [
      header.join(";"),
      ...rows.map((row) =>
        [row.name, row.status, row.phone, row.pixKey].map(csvEscape).join(";"),
      ),
    ];

    const csv = `\uFEFF${lines.join("\n")}`;

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="inscritos-${racha.slug}.csv"`,
      },
    });
  }

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 36;
  const lineHeight = 14;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawLine = (text: string, bold = false, size = 10) => {
    page.drawText(sanitizePdfText(text), {
      x: margin,
      y,
      size,
      font: bold ? fontBold : fontRegular,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= lineHeight;
  };

  const ensureSpace = (needed = 56) => {
    if (y - needed < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  drawLine(`Inscritos do racha: ${racha.title}`, true, 14);
  y -= 4;
  drawLine(`PIX do racha: ${racha.pixKey}`);
  y -= 8;

  if (rows.length === 0) {
    drawLine("Não há inscritos neste racha.");
  } else {
    rows.forEach((row, index) => {
      ensureSpace();
      drawLine(`${index + 1}. ${row.name}`, true);
      drawLine(`Status: ${row.status}`);
      drawLine(`Telefone: ${row.phone}`);
      drawLine(`Chave PIX: ${row.pixKey}`);
      y -= 6;
    });
  }

  const pdfBytes = await pdfDoc.save();

  return new Response(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="inscritos-${racha.slug}.pdf"`,
    },
  });
}
