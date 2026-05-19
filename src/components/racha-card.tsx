import { MapPin, ShieldCheck, Users, Wallet, Clock3 } from "lucide-react";
import { Racha, User, Enrollment } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { countsTowardAthleteLimit } from "@/lib/enrollment";
import { modalityLabels } from "@/lib/constants";
import {
  formatCurrencyFromCents,
  formatDateTime,
  getRachaCoverImageUrl,
} from "@/lib/utils";

type RachaCardProps = {
  racha: Racha & {
    organizer: User;
    enrollments: Pick<
      Enrollment,
      "id" | "status" | "paymentStatus" | "participantPosition"
    >[];
  };
};

export function RachaCard({ racha }: RachaCardProps) {
  const coverImageUrl = getRachaCoverImageUrl(
    racha.modality,
    racha.coverImageUrl,
  );
  const occupiedAthleteSlots = racha.enrollments.filter(
    countsTowardAthleteLimit,
  ).length;
  const remainingAthleteSlots = Math.max(
    racha.athleteLimit - occupiedAthleteSlots,
    0,
  );
  const isSoldOut = remainingAthleteSlots === 0;
  const isAlmostSoldOut = remainingAthleteSlots > 0 && remainingAthleteSlots <= 3;
  const cardAlertClassName = isSoldOut
    ? "racha-card-sold-out border-rose-500"
    : isAlmostSoldOut
      ? "racha-card-almost-full border-amber-400"
      : "";

  return (
    <Card className={`overflow-hidden p-0 ${cardAlertClassName}`}>
      <div
        className="h-40 bg-linear-to-br from-teal-700 via-cyan-700 to-emerald-600"
        style={{
          backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.35), rgba(15, 23, 42, 0.45)), url(${coverImageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{modalityLabels[racha.modality] ?? racha.modality}</Badge>
          <Badge className="bg-slate-100 text-slate-700">
            {racha.visibility === "PRIVATE" ? "Privado" : "Aberto"}
          </Badge>
          {isSoldOut ? (
            <Badge className="bg-rose-100 text-rose-700">Lotado</Badge>
          ) : isAlmostSoldOut ? (
            <Badge className="bg-amber-100 text-amber-700">
              Ultimas {remainingAthleteSlots} vaga(s)
            </Badge>
          ) : null}
        </div>

        <div>
          <h3 className="text-2xl font-bold text-slate-950">{racha.title}</h3>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
            {racha.description ||
              "Racha pronto para receber atletas com organização, pagamento e regras centralizadas."}
          </p>
        </div>

        <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-teal-600" />
            <span>{formatDateTime(racha.eventDate)}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-teal-600" />
            <span>{racha.city}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-teal-600" />
            <span>
              {occupiedAthleteSlots}/{racha.athleteLimit} atletas
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-teal-600" />
            <span>
              {formatCurrencyFromCents(racha.priceInCents)} por pessoa
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
          <div className="space-y-1">
            <p className="font-semibold text-slate-950">
              {racha.organizerDisplayName}
            </p>
            <p className="text-slate-500">WhatsApp: {racha.phoneWhatsapp}</p>
          </div>
          <ShieldCheck className="h-5 w-5 text-teal-600" />
        </div>

        <Button asChild className="w-full" href={`/rachas/${racha.slug}`}>
          Ver detalhes
        </Button>
      </div>
    </Card>
  );
}
