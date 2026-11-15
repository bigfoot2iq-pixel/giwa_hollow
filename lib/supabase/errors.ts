/**
 * Helpers for classifying PostgREST / Postgres errors.
 */

interface PostgrestLikeError {
  code?: string | null;
  message?: string | null;
}

const MISSING_TABLE_CODES = new Set([
  // Postgres: undefined_table
  "42P01",
  // PostgREST: table not found in the schema cache
  "PGRST205",
]);

/**
 * True when the error means the table was never created in this database
 * (i.e. its migration has not been applied yet).
 *
 * `status` is the HTTP status returned alongside the error by postgrest-js.
 * It matters for writes: PostgREST answers an INSERT/UPDATE against an unknown
 * relation with a bare `404 {}` body, which carries no `code` or `message`, so
 * the status is the only signal left to inspect.
 */
export function isMissingTableError(
  error: PostgrestLikeError | null | undefined,
  status?: number | null
): boolean {
  if (!error) return false;
  if (error.code && MISSING_TABLE_CODES.has(error.code)) return true;
  if (
    /relation .* does not exist|could not find the table/i.test(
      error.message ?? ""
    )
  ) {
    return true;
  }
  return status === 404 && !error.code && !error.message;
}

/** Table that stores public launchpad submissions. */
export const LAUNCHPAD_REQUESTS_TABLE = "litvm_launchpad_requests";

/** Migration that creates {@link LAUNCHPAD_REQUESTS_TABLE}. */
export const LAUNCHPAD_REQUESTS_MIGRATION =
  "supabase/migrations/20261113_launchpad.sql";
