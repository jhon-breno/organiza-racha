import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <Card className="flex flex-col items-center justify-center gap-4 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <CalendarDays className="h-7 w-7" />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-bold text-slate-950">{title}</h3>
        <p className="max-w-lg text-sm leading-6 text-slate-600">
          {description}
        </p>
      </div>
      {actionHref && actionLabel ? (
        <Button asChild href={actionHref}>
          {actionLabel}
        </Button>
      ) : null}
    </Card>
  );
}
