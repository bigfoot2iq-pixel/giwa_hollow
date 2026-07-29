/**
 * PostgREST caps every `select()` at a server-side default (1000 rows on
 * Supabase) and returns the truncated page without erroring or signalling that
 * more exist. Any table that outgrows that cap is read silently short.
 *
 * That is not a theoretical concern here: a raffle at its 10,000-participant cap
 * returned 1,000 entries, so the settlement draw saw a tenth of the entrants and
 * the reconciler mistook the missing 9,000 for new wallets.
 *
 * These helpers page explicitly with `.range()` until a short page arrives.
 */

const PAGE_SIZE = 1000;

// Refuses to loop forever if the range window ever stops advancing.
const MAX_PAGES = 200;

type RangeQuery<T> = {
  range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
};

/**
 * Read every row a query matches, one page at a time.
 *
 * `build` is called per page and must return a fresh query — PostgREST query
 * builders are single-use, so reusing one across pages silently rejects.
 *
 * @example
 *   const entries = await selectAll((from, to) =>
 *     supabase.from("litvm_raffle_entries").select("wallet_address").eq("raffle_id", id).range(from, to)
 *   );
 */
export async function selectAllPaged<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];

  for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex++) {
    const from = pageIndex * PAGE_SIZE;
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);

    const page = data ?? [];
    rows.push(...page);

    // A short page means the end of the result set.
    if (page.length < PAGE_SIZE) return rows;
  }

  console.warn(
    `selectAllPaged: stopped at the ${MAX_PAGES}-page guard after ${rows.length} rows; result may be truncated`
  );
  return rows;
}

/** Convenience wrapper for builders that already have `.range()` applied last. */
export async function selectAllFrom<T>(
  makeQuery: () => RangeQuery<T>
): Promise<T[]> {
  return selectAllPaged<T>((from, to) => makeQuery().range(from, to));
}
