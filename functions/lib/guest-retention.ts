import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import { createLogger } from "./logger";
import { deletePaymentProofFiles } from "./payment-proof-storage";
import { requireRole, UnauthorizedError, type AuthenticatedData, type UserRole } from "./rbac";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ENVIRONMENT?: string;
}

export interface GuestRetentionContext {
  env: Env;
  data: AuthenticatedData;
  params: { guestId?: string | string[] };
}

// PostgREST returns HTTP xyz for SQLSTATE PTxyz; anonymize_guest and delete_guest raise PT404 / PT409.
const STATUS_BY_SQLSTATE: Record<string, number> = { PT404: 404, PT409: 409 };

/** Runs anonymize_guest or delete_guest for an authorized caller, then deletes the proof files. */
export async function runGuestRetention(
  context: GuestRetentionContext,
  fn: "anonymize_guest" | "delete_guest",
  allowedRoles: UserRole[]
): Promise<Response> {
  try {
    requireRole(context.data.user, allowedRoles);
  } catch (error) {
    const status = error instanceof UnauthorizedError ? 401 : 403;
    return Response.json(
      { error: status === 401 ? "Unauthorized" : "Forbidden", message: (error as Error).message },
      { status }
    );
  }

  const guestId = context.params.guestId;
  if (typeof guestId !== "string") {
    return Response.json({ error: "Bad Request", message: "Missing guest id" }, { status: 400 });
  }

  const logger = createLogger(context.env);
  const supabase = createClient<Database>(
    context.env.SUPABASE_URL,
    context.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );

  const { data, error } = await supabase.rpc(fn, { p_guest_id: guestId });
  if (error) {
    const status = STATUS_BY_SQLSTATE[error.code ?? ""] ?? 500;
    if (status === 500) logger.error(`[GUEST] ${fn}(${guestId}) failed`, error);
    return Response.json({ error: fn, message: error.message }, { status });
  }

  const paths = (data ?? [])
    .map((row) => row.proof_path)
    .filter((path): path is string => Boolean(path));
  const { deleted, failed } = await deletePaymentProofFiles(supabase, paths, logger);

  return Response.json({ success: true, deleted_files: deleted.length, failed_files: failed });
}
