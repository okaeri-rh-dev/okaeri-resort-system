import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { patchCachedLists } from "@/lib/optimistic-list-patch";

type Row = { id: string; name: string };

const listRoot = ["things", "list"] as const;
const byNameKey = [...listRoot, { sort: "name" }];
const searchBKey = [...listRoot, { search: "b" }];
const detailKey = ["things", "detail", "b"];

describe("patchCachedLists", () => {
  it("patches every cached list under the root and restores the exact old data", async () => {
    const queryClient = new QueryClient();
    const detail = { id: "b", name: "Ben" };
    queryClient.setQueryData(byNameKey, [
      { id: "a", name: "Ana" },
      { id: "b", name: "Ben" },
    ]);
    queryClient.setQueryData(searchBKey, [{ id: "b", name: "Ben" }]);
    queryClient.setQueryData(detailKey, detail);

    const restore = await patchCachedLists<Row>(queryClient, listRoot, (row) =>
      row.id === "b" ? { ...row, name: "Benny" } : row
    );

    expect(queryClient.getQueryData(byNameKey)).toEqual([
      { id: "a", name: "Ana" },
      { id: "b", name: "Benny" },
    ]);
    expect(queryClient.getQueryData(searchBKey)).toEqual([{ id: "b", name: "Benny" }]);
    expect(queryClient.getQueryData(detailKey)).toBe(detail);

    restore();

    expect(queryClient.getQueryData(byNameKey)).toEqual([
      { id: "a", name: "Ana" },
      { id: "b", name: "Ben" },
    ]);
    expect(queryClient.getQueryData(searchBKey)).toEqual([{ id: "b", name: "Ben" }]);
  });
});
