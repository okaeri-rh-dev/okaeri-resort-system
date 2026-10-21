/** Guest delete: delete_guest anonymizes the guest's bookings and audit rows first. */

import { runGuestRetention, type GuestRetentionContext } from "../../../lib/guest-retention";
import { ADMIN_ONLY } from "../../../lib/rbac";

export const onRequestDelete = (context: GuestRetentionContext): Promise<Response> =>
  runGuestRetention(context, "delete_guest", ADMIN_ONLY);
