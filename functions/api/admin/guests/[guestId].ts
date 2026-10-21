/** Guest delete: delete_guest anonymizes the guest's bookings and audit rows first. */

import { runGuestRetention, type GuestRetentionContext } from "../../../lib/guest-retention";
import { MANAGER_OR_ABOVE } from "../../../lib/rbac";

export const onRequestDelete = (context: GuestRetentionContext): Promise<Response> =>
  runGuestRetention(context, "delete_guest", MANAGER_OR_ABOVE);
