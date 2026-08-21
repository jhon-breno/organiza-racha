import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type TeamDrawStatePayload = {
  seed: number;
  teamCount: number;
  drawnAt: string;
  scoreToWin: number;
  matchFlow: unknown;
  matchHistory: unknown;
};

async function getAuthorizedRacha(
  params: Promise<{ id: string }>,
  userId: string,
) {
  const { id } = await params;

  const racha = await prisma.racha.findUnique({
    where: { id },
    select: {
      id: true,
      organizerId: true,
    },
  });

  if (!racha) {
    return {
      error: NextResponse.json({ error: "Not found" }, { status: 404 }),
    };
  }

  const isCoAdmin = await prisma.rachaAdmin.findUnique({
    where: {
      rachaId_userId: {
        rachaId: racha.id,
        userId,
      },
    },
    select: { id: true },
  });

  if (racha.organizerId !== userId && !isCoAdmin) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { rachaId: racha.id };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authorization = await getAuthorizedRacha(
    context.params,
    session.user.id,
  );

  if ("error" in authorization) {
    return authorization.error;
  }

  const state = await prisma.teamDrawSession.findUnique({
    where: { rachaId: authorization.rachaId },
    select: {
      seed: true,
      teamCount: true,
      drawnAt: true,
      scoreToWin: true,
      matchFlow: true,
      matchHistory: true,
      updatedAt: true,
    },
  });

  if (!state) {
    return NextResponse.json({ state: null });
  }

  return NextResponse.json({
    state: {
      ...state,
      // BigInt cannot be serialized directly in JSON responses.
      seed: state.seed.toString(),
    },
  });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authorization = await getAuthorizedRacha(
    context.params,
    session.user.id,
  );

  if ("error" in authorization) {
    return authorization.error;
  }

  let payload: TeamDrawStatePayload;

  try {
    payload = (await request.json()) as TeamDrawStatePayload;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (
    typeof payload.seed !== "number" ||
    typeof payload.teamCount !== "number" ||
    typeof payload.scoreToWin !== "number" ||
    typeof payload.drawnAt !== "string"
  ) {
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  }

  const safeTeamCount = Math.max(
    2,
    Math.min(16, Math.floor(payload.teamCount)),
  );
  const safeScoreToWin = Math.max(
    5,
    Math.min(50, Math.floor(payload.scoreToWin)),
  );
  const drawnAt = new Date(payload.drawnAt);

  if (Number.isNaN(drawnAt.getTime())) {
    return NextResponse.json({ error: "Invalid drawnAt" }, { status: 400 });
  }

  await prisma.teamDrawSession.upsert({
    where: { rachaId: authorization.rachaId },
    create: {
      rachaId: authorization.rachaId,
      seed: BigInt(Math.trunc(payload.seed)),
      teamCount: safeTeamCount,
      drawnAt,
      scoreToWin: safeScoreToWin,
      matchFlow: payload.matchFlow ?? Prisma.JsonNull,
      matchHistory: payload.matchHistory ?? Prisma.JsonNull,
    },
    update: {
      seed: BigInt(Math.trunc(payload.seed)),
      teamCount: safeTeamCount,
      drawnAt,
      scoreToWin: safeScoreToWin,
      matchFlow: payload.matchFlow ?? Prisma.JsonNull,
      matchHistory: payload.matchHistory ?? Prisma.JsonNull,
    },
  });

  return NextResponse.json({ ok: true });
}
