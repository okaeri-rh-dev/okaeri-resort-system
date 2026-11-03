import type { AnchorHTMLAttributes } from "react";

type RouterLinkStubProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: string;
  params?: Record<string, string>;
  search?: Record<string, unknown>;
};

// Stands in for TanStack Router's Link, which needs a router context:
// vi.mock("@tanstack/react-router", async () => ({ Link: (await import("@/test/router-link-stub")).RouterLinkStub }))
export function RouterLinkStub({
  to,
  params = {},
  search,
  children,
  ...anchorProps
}: RouterLinkStubProps) {
  const path = to.replace(/\$(\w+)/g, (_, key: string) => params[key]);
  const query = search
    ? `?${new URLSearchParams(Object.entries(search).map(([key, value]) => [key, String(value)]))}`
    : "";
  return (
    <a data-testid="router-link" href={path + query} {...anchorProps}>
      {children}
    </a>
  );
}
