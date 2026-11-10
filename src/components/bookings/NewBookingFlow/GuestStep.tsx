import { useId } from "react";

import { Plus, UserRound } from "lucide-react";

import { Button, Input, Label } from "@/components/patterns";
import { useGuestPick } from "@/hooks/useGuests";

import type { Draft, Update } from "./draft";

/** One field: type a name or phone. Matches show first; "New guest" is always offered. */
export function GuestStep({ draft, update }: { draft: Draft; update: Update }) {
  const ids = useId();
  const searching = !draft.guestId && !draft.isNewGuest;
  const { data: matches = [] } = useGuestPick(searching ? draft.guestName : "");

  if (draft.guestId) {
    return (
      <div className="border-primary bg-accent flex items-start justify-between gap-2 rounded-lg border p-3 text-sm">
        <div className="flex min-w-0 gap-2">
          <UserRound className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-medium break-words">{draft.guestName}</p>
            <p className="text-muted-foreground text-xs">{draft.phone || "No phone"}</p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => update({ guestId: undefined, guestName: "", phone: "", email: "" })}
        >
          Change guest
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${ids}-name`}>Guest</Label>
        <Input
          id={`${ids}-name`}
          autoComplete="off"
          placeholder="Search a name or phone, or type a new name"
          value={draft.guestName}
          onChange={(e) => update({ guestName: e.target.value })}
        />
        {searching && matches.length > 0 && (
          <ul className="border-border divide-border divide-y rounded-lg border">
            {matches.map((guest) => (
              <li key={guest.guest_id}>
                <button
                  type="button"
                  className="hover:bg-muted coarse:min-h-11 flex w-full items-center justify-between gap-2 p-3 text-left text-sm duration-150"
                  onClick={() =>
                    update({
                      guestId: guest.guest_id,
                      guestName: guest.guest_name,
                      phone: guest.phone_number ?? "",
                      email: guest.email ?? "",
                    })
                  }
                >
                  <span className="min-w-0 truncate font-medium">{guest.guest_name}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {guest.phone_number ?? "No phone"} · {guest.total_bookings ?? 0}{" "}
                    {guest.total_bookings === 1 ? "stay" : "stays"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {!draft.isNewGuest && draft.guestName.trim().length >= 2 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => update({ isNewGuest: true })}
          >
            <Plus aria-hidden="true" />
            New guest “{draft.guestName.trim()}”
          </Button>
        )}
      </div>

      {draft.isNewGuest && (
        <>
          <div className="space-y-2">
            <Label htmlFor={`${ids}-phone`}>
              {draft.source === "Airbnb" ? "Phone (optional)" : "Phone"}
            </Label>
            <Input
              id={`${ids}-phone`}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="0917 123 4567"
              value={draft.phone}
              onChange={(e) => update({ phone: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${ids}-email`}>Email (optional)</Label>
            <Input
              id={`${ids}-email`}
              type="email"
              spellCheck={false}
              autoComplete="off"
              value={draft.email}
              onChange={(e) => update({ email: e.target.value })}
            />
          </div>
        </>
      )}
    </div>
  );
}
