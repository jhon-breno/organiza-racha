import { MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getMapsEmbedUrl } from "@/lib/utils";

export function MapPreview({
  query,
  title,
}: {
  query?: string | null;
  title: string;
}) {
  const src = getMapsEmbedUrl(query);

  if (!src) {
    return (
      <Card>
        <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center text-slate-500">
          <MapPin className="h-8 w-8" />
          <p>O organizador ainda não informou uma referência do Google Maps.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <iframe
        className="h-80 w-full"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        src={src}
        title={title}
      />
    </Card>
  );
}
