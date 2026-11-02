// PostgREST `or=(...)` filter that matches the search in any column; the value is
// double-quoted so `,`, `(`, `)` and `.` stay literal, with `\` and `"` escaped.
export const ilikeAnyFilter = (columns: readonly string[], searchQuery: string) => {
  const quotedPattern = `"%${searchQuery.replace(/[\\"]/g, "\\$&")}%"`;
  return columns.map((column) => `${column}.ilike.${quotedPattern}`).join(",");
};
