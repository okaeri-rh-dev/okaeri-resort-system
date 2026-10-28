import type { ContactChannel } from "@/hooks/useContactChannels";
import { firstChannelOfKind, toDisplayValue } from "@/lib/contact-channel";

import type { LetterheadContacts } from "./types";

/** The letterhead phone and email: the first visible mobile and email channels, else blank. */
export function toLetterheadContacts(channels: ContactChannel[]): LetterheadContacts {
  const mobile = firstChannelOfKind(channels, "mobile");
  const email = firstChannelOfKind(channels, "email");
  return {
    phone: mobile ? toDisplayValue(mobile) : "",
    email: email ? toDisplayValue(email) : "",
  };
}
