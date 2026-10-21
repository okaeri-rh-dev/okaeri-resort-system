/** Owner/admin erasure request: anonymize one guest now (docs/plans/2026-10-21-guest-retention-design.md). */

import { runGuestRetention, type GuestRetentionContext } from "../../../../lib/guest-retention";
import { OWNER_OR_ABOVE } from "../../../../lib/rbac";

export const onRequestPost = (context: GuestRetentionContext): Promise<Response> =>
  runGuestRetention(context, "anonymize_guest", OWNER_OR_ABOVE);
