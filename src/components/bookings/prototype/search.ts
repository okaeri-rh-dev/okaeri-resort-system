/** PROTOTYPE — URL state for every variant. */
import { getRouteApi } from "@tanstack/react-router";

import type { ProtoFilters } from "./fixture";

const protoRoute = getRouteApi("/admin/prototype/bookings");

export type ProtoSearch = ReturnType<typeof protoRoute.useSearch>;

/** One replace-navigation per change, so back leaves the page. */
export function useProtoSearch() {
  const search = protoRoute.useSearch();
  const navigate = protoRoute.useNavigate();
  const setSearch = (patch: Partial<ProtoSearch>) =>
    void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });
  const filters: ProtoFilters = {
    q: search.q,
    cabin: search.cabin,
    pay: search.pay,
    src: search.src,
  };
  return { search, setSearch, filters };
}
