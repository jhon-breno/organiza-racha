import { NextRequest } from "next/server";
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

  const PDFDocument = (await import("pdfkit")).default;
  const doc = new PDFDocument({ margin: 36, size: "A4" });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const pdfBufferPromise = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.fontSize(16).text(`Inscritos do racha: ${racha.title}`);
  doc.moveDown(0.5);
  doc.fontSize(11).text(`PIX do racha: ${racha.pixKey}`);
  doc.moveDown(0.8);

  if (rows.length === 0) {
    doc.fontSize(11).text("Não há inscritos neste racha.");
  } else {
    rows.forEach((row, index) => {
      doc
        .fontSize(11)
        .text(`${index + 1}. ${row.name}`)
        .text(`Status: ${row.status}`)
        .text(`Telefone: ${row.phone}`)
        .text(`Chave PIX: ${row.pixKey}`)
        .moveDown(0.5);
    });
  }

  doc.end();

  const pdfBuffer = await pdfBufferPromise;

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="inscritos-${racha.slug}.pdf"`,
    },
  });
}
