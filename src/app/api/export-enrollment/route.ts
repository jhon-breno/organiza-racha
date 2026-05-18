import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Racha, Enrollment } from "@prisma/client";
import { levelLabels } from "@/lib/constants";
import {
  isConfirmedEnrollment,
  isGoalkeeperEnrollment,
  isVisibleEnrollment,
} from "@/lib/enrollment";
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
      enrollments = enrollments.filter(isConfirmedEnrollment);
    } else if (type === "all") {
      enrollments = enrollments.filter(isVisibleEnrollment);
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
  participantPosition?: string | null;
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
  if (isConfirmedEnrollment(enrollment)) {
    return "Confirmado";
  }
  if (enrollment.status === "ACTIVE" && enrollment.paymentStatus === "PENDING") {
    return "Aguardando pagamento";
  }
  if (enrollment.status === "ACTIVE" && enrollment.paymentStatus === "PROOF_SENT") {
    return "Pagamento em análise";
  }
  return "Pendente";
}

function getLineEnrollments(enrollments: Enrollment[]) {
  return enrollments.filter((item) => !isGoalkeeperEnrollment(item));
}

function getGoalkeeperEnrollments(enrollments: Enrollment[]) {
  return enrollments.filter(isGoalkeeperEnrollment);
}

function generateExcel(
  racha: Racha,
  enrollments: Enrollment[],
  type: string,
): NextResponse {
  const headers = [
    "Categoria",
    "Posição",
    "Nome",
    "Telefone",
    "Posição no jogo",
    "Nível",
    "Status",
  ];

  const lineEnrollments = getLineEnrollments(enrollments);
  const goalkeeperEnrollments = getGoalkeeperEnrollments(enrollments);
  const goalkeeperSlots = Math.max(
    racha.goalkeeperLimit ?? 0,
    goalkeeperEnrollments.length,
  );
  const rows = [
    ...Array.from({ length: racha.athleteLimit }, (_, index) => {
      const enrollment = lineEnrollments[index];

      return [
        "Atleta",
        (index + 1).toString(),
        enrollment?.participantName ?? "",
        enrollment?.participantPhone ?? "",
        enrollment?.participantPosition ?? "",
        enrollment
          ? levelLabels[enrollment.participantLevel as keyof typeof levelLabels] ||
            enrollment.participantLevel
          : "",
        enrollment ? getStatusLabel(enrollment) : "",
      ];
    }),
    ...Array.from({ length: goalkeeperSlots }, (_, index) => {
      const enrollment = goalkeeperEnrollments[index];

      return [
        "Goleiro",
        (index + 1).toString(),
        enrollment?.participantName ?? "",
        enrollment?.participantPhone ?? "",
        enrollment?.participantPosition ?? "Goleiro",
        enrollment
          ? levelLabels[enrollment.participantLevel as keyof typeof levelLabels] ||
            enrollment.participantLevel
          : "",
        enrollment ? getStatusLabel(enrollment) : "",
      ];
    }),
  ];

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
  const headerColor = rgb(0.12, 0.12, 0.12);

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  const lineHeight = 14;
  const lineEnrollments = getLineEnrollments(enrollments);
  const goalkeeperEnrollments = getGoalkeeperEnrollments(enrollments);
  const goalkeeperSlots = Math.max(
    racha.goalkeeperLimit ?? 0,
    goalkeeperEnrollments.length,
  );

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

  const drawLine = (text: string, options?: { bold?: boolean; size?: number }) => {
    drawText(text, margin, y, options);
    y -= lineHeight;
  };

  const ensureSpace = (needed = 56) => {
    if (y - needed < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
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

  drawLine("Lista de atletas:", { bold: true, size: 11 });
  for (let index = 0; index < racha.athleteLimit; index += 1) {
    ensureSpace();
    const enrollment = lineEnrollments[index];

    if (!enrollment) {
      drawLine(`${index + 1} - `);
      continue;
    }

    drawLine(
      `${index + 1} - ${enrollment.participantName} (${getStatusLabel(enrollment)})`,
    );
  }

  if (goalkeeperSlots > 0) {
    y -= 8;
    drawLine("Goleiros:", { bold: true, size: 11 });

    for (let index = 0; index < goalkeeperSlots; index += 1) {
      ensureSpace();
      const enrollment = goalkeeperEnrollments[index];
      drawLine(
        enrollment
          ? `${index + 1} - ${enrollment.participantName}`
          : `${index + 1} - `,
      );
    }
  }

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
