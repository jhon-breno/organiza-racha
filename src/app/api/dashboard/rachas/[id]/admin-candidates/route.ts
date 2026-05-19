import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const query = request.nextUrl.searchParams.get("query")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json({ users: [] });
  }

  const racha = await prisma.racha.findUnique({
    where: { id },
    select: {
      id: true,
      organizerId: true,
      rachaAdmins: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!racha) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isCoAdmin = await prisma.rachaAdmin.findUnique({
    where: {
      rachaId_userId: {
        rachaId: id,
        userId: session.user.id,
      },
    },
    select: { id: true },
  });

  if (racha.organizerId !== session.user.id && !isCoAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const excludedUserIds = new Set([
    racha.organizerId,
    ...racha.rachaAdmins.map((admin) => admin.userId),
  ]);
  const normalizedQuery = normalizeSearchValue(query);
  const digitsQuery = query.replace(/\D/g, "");

  const broadCandidates = await prisma.user.findMany({
    where: {
      id: {
        notIn: [...excludedUserIds],
      },
      OR: [
        digitsQuery
          ? {
              phone: {
                contains: digitsQuery,
              },
            }
          : undefined,
        {
          name: {
            not: null,
          },
        },
      ].filter(Boolean) as never,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 200,
  });

  const users = broadCandidates
    .filter((candidate) => {
      const haystack = [candidate.name, candidate.phone, candidate.email]
        .filter(Boolean)
        .map((value) => normalizeSearchValue(value ?? ""));

      return haystack.some((value) => value.includes(normalizedQuery));
    })
    .slice(0, 8)
    .map((candidate) => ({
      id: candidate.id,
      name: candidate.name ?? "",
      phone: candidate.phone ?? "",
      email: candidate.email ?? "",
    }));

  return NextResponse.json({ users });
}
