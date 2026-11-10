import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * Optimistically patch one row in every cached list under `listRoot`.
 * Rows are not re-filtered or re-sorted; the afterWrite refetch fixes order and membership.
 * Returns a restore function that puts back each list's exact old data.
 */
export async function patchCachedLists<Row>(
  queryClient: QueryClient,
  listRoot: QueryKey,
  patchRow: (row: Row) => Row
): Promise<() => void> {
  await queryClient.cancelQueries({ queryKey: listRoot });
  const snapshots = queryClient.getQueriesData<Row[]>({ queryKey: listRoot });
  queryClient.setQueriesData<Row[]>({ queryKey: listRoot }, (rows) => rows?.map(patchRow));
  return () => {
    for (const [queryKey, rows] of snapshots) queryClient.setQueryData(queryKey, rows);
  };
}
