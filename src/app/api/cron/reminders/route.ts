import { NextRequest, NextResponse } from "next/server";
import { processScheduledRachaReminders } from "@/lib/botbot";

export const dynamic = "force-dynamic";

/**
 * Endpoint para processar os lembretes automáticos agendados para os rachas.
 * Pode ser chamado por um cron job (ex: a cada 5 ou 10 minutos) ou manualmente.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Se houver CRON_SECRET configurado, valida
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      const urlKey = req.nextUrl.searchParams.get("key");
      if (urlKey !== cronSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const result = await processScheduledRachaReminders();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error("[Cron Reminders Error]", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
