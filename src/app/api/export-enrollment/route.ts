import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  ParticipantStatus,
  PaymentStatus,
  Racha,
  Enrollment,
} from "@prisma/client";
import { levelLabels } from "@/lib/constants";
import { formatDateTimeShort } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const rachaId = searchParams.get("rachaId");
    const type = searchParams.get("type") || "confirmed";
    const format = searchParams.get("format") || "pdf";

    if (!rachaId) {
      return NextResponse.json(
        { error: "rachaId is required" },
        { status: 400 },
      );
    }

    const racha = await prisma.racha.findUnique({
      where: { id: rachaId },
      include: {
        enrollments: {
          orderBy: [{ createdAt: "asc" }],
        },
      },
    });

    if (!racha || racha.organizerId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let enrollments = racha.enrollments;

    if (type === "confirmed") {
      enrollments = enrollments.filter(
        (item) =>
          item.status === ParticipantStatus.ACTIVE &&
          item.paymentStatus === PaymentStatus.PAID,
      );
    } else if (type === "all") {
      enrollments = enrollments.filter(
        (item) =>
          item.status !== ParticipantStatus.CANCELED &&
          item.paymentStatus !== PaymentStatus.REFUNDED,
      );
    }

    if (format === "excel") {
      return generateExcel(racha, enrollments, type);
    }

    return await generatePDF(racha, enrollments, type);
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Failed to export" }, { status: 500 });
  }
}

function getStatusLabel(enrollment: {
  status: string;
  paymentStatus: string;
}): string {
  if (enrollment.status === "CANCELED") {
    return "Cancelado";
  }
  if (enrollment.paymentStatus === "REFUNDED") {
    return "Cancelado";
  }
  if (enrollment.paymentStatus === "REFUND_REQUESTED") {
    return "Aguardando reembolso";
  }
  if (enrollment.status === "WAITLIST") {
    return "Lista de espera";
  }
  if (
    enrollment.status === ParticipantStatus.ACTIVE &&
    enrollment.paymentStatus === PaymentStatus.PAID
  ) {
    return "Confirmado";
  }
  if (
    enrollment.status === ParticipantStatus.ACTIVE &&
    enrollment.paymentStatus === PaymentStatus.PENDING
  ) {
    return "Aguardando pagamento";
  }
  if (
    enrollment.status === ParticipantStatus.ACTIVE &&
    enrollment.paymentStatus === PaymentStatus.PROOF_SENT
  ) {
    return "Pagamento em análise";
  }
  return "Pendente";
}

function generateExcel(
  racha: Racha,
  enrollments: Enrollment[],
  type: string,
): NextResponse {
  // Criar CSV simples (compatível com Excel)
  const headers = [
    "Posição",
    "Nome",
    "Telefone",
    "Posição no jogo",
    "Nível",
    "Status",
  ];

  const rows = enrollments.map((enrollment, index) => [
    (index + 1).toString(),
    enrollment.participantName,
    enrollment.participantPhone,
    enrollment.participantPosition,
    levelLabels[enrollment.participantLevel as keyof typeof levelLabels] ||
      enrollment.participantLevel,
    getStatusLabel(enrollment),
  ]);

  const csv = [
    `Racha: ${racha.title}`,
    `Local: ${racha.locationName}`,
    `Data e hora: ${formatDateTimeShort(racha.eventDate)}`,
    `Tipo: ${type === "confirmed" ? "Apenas confirmados" : "Todos os atletas"}`,
    "",
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lista_${racha.slug}_${type}.csv"`,
    },
  });
}

async function generatePDF(
  racha: Racha,
  enrollments: Enrollment[],
  type: string,
): Promise<NextResponse> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 36;
  const rowHeight = 18;

  const columns = [
    { label: "#", width: 24 },
    { label: "Nome", width: 130 },
    { label: "Telefone", width: 98 },
    { label: "Posição", width: 96 },
    { label: "Nível", width: 78 },
    { label: "Status", width: 96 },
  ] as const;

  const headerColor = rgb(0.12, 0.12, 0.12);
  const borderColor = rgb(0.85, 0.85, 0.88);
  const tableHeaderBg = rgb(0.95, 0.95, 0.95);

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const truncate = (text: string, max = 24) => {
    if (text.length <= max) {
      return text;
    }
    return `${text.slice(0, max - 1)}…`;
  };

  const drawText = (
    text: string,
    x: number,
    textY: number,
    options?: { bold?: boolean; size?: number },
  ) => {
    page.drawText(text, {
      x,
      y: textY,
      size: options?.size ?? 9,
      font: options?.bold ? fontBold : fontRegular,
      color: headerColor,
    });
  };

  drawText(racha.title, margin, y, { bold: true, size: 18 });
  y -= 22;
  drawText(`Local: ${racha.locationName}`, margin, y, { size: 10 });
  y -= 14;
  drawText(`Data e hora: ${formatDateTimeShort(racha.eventDate)}`, margin, y, {
    size: 10,
  });
  y -= 14;
  drawText(
    `Tipo de lista: ${type === "confirmed" ? "Apenas confirmados" : "Todos os atletas"}`,
    margin,
    y,
    { size: 10 },
  );
  y -= 24;

  const drawTableHeader = () => {
    let x = margin;
    columns.forEach((column) => {
      page.drawRectangle({
        x,
        y: y - rowHeight + 4,
        width: column.width,
        height: rowHeight,
        borderColor,
        borderWidth: 1,
        color: tableHeaderBg,
      });
      drawText(column.label, x + 3, y - 9, { bold: true, size: 9 });
      x += column.width;
    });
    y -= rowHeight;
  };

  drawTableHeader();

  enrollments.forEach((enrollment, index) => {
    if (y - rowHeight < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      drawTableHeader();
    }

    const rowValues = [
      String(index + 1),
      truncate(enrollment.participantName, 26),
      truncate(enrollment.participantPhone, 18),
      truncate(enrollment.participantPosition, 16),
      truncate(
        levelLabels[enrollment.participantLevel as keyof typeof levelLabels] ||
          enrollment.participantLevel,
        14,
      ),
      truncate(getStatusLabel(enrollment), 18),
    ];

    let x = margin;
    rowValues.forEach((value, valueIndex) => {
      const width = columns[valueIndex]!.width;
      page.drawRectangle({
        x,
        y: y - rowHeight + 4,
        width,
        height: rowHeight,
        borderColor,
        borderWidth: 1,
      });
      drawText(value, x + 3, y - 9, { size: 8.5 });
      x += width;
    });

    y -= rowHeight;
  });

  const bytes = await pdfDoc.save();
  const buffer = Buffer.from(bytes);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="lista_${racha.slug}_${type}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
