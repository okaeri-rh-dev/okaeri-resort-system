import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/patterns";

import { METHODS, type Draft } from "./draft";

export function ReviewStep({ draft, summary }: { draft: Draft; summary: ReactNode }) {
  const isAirbnb = draft.source === "Airbnb";
  return (
    <Card>
      <CardContent className="space-y-4 pt-4">
        <h2 className="font-display text-lg font-semibold">Check and save</h2>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Source</dt>
          <dd>{draft.source}</dd>
          <dt className="text-muted-foreground">Guest</dt>
          <dd className="break-words">{draft.guestName}</dd>
          {draft.phone && (
            <>
              <dt className="text-muted-foreground">Phone</dt>
              <dd>{draft.phone}</dd>
            </>
          )}
          {draft.email && (
            <>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="break-words">{draft.email}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Payment</dt>
          <dd>
            {isAirbnb ? "Airbnb payout" : METHODS.find((m) => m.value === draft.method)?.label}
          </dd>
          {isAirbnb && draft.confirmationCode.trim() && (
            <>
              <dt className="text-muted-foreground">Airbnb code</dt>
              <dd>{draft.confirmationCode.trim().toUpperCase()}</dd>
            </>
          )}
          {draft.notes && (
            <>
              <dt className="text-muted-foreground">Notes</dt>
              <dd className="break-words">{draft.notes}</dd>
            </>
          )}
        </dl>
        {summary}
      </CardContent>
    </Card>
  );
}
