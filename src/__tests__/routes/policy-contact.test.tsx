import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useActiveContactChannels, type ContactChannel } from "@/hooks/useContactChannels";
import { Route as PrivacyPolicyRoute } from "@/routes/privacy-policy";
import { Route as TermsRoute } from "@/routes/terms-and-conditions";

vi.mock("@/components/pwa/InstallBanner", () => ({ InstallBanner: () => null }));
vi.mock("@/hooks/useContactChannels", () => ({ useActiveContactChannels: vi.fn() }));

function channel(overrides: Partial<ContactChannel>): ContactChannel {
  return {
    id: "channel",
    kind: "viber",
    value: "+639171234567",
    label: null,
    is_active: true,
    display_order: 0,
    created_at: "2026-10-21T00:00:00Z",
    updated_at: "2026-10-21T00:00:00Z",
    ...overrides,
  };
}

const viber = channel({ id: "viber", kind: "viber", value: "+639171234567" });
const firstEmail = channel({
  id: "email-1",
  kind: "email",
  value: "stay@okaeri-resort.example",
  display_order: 1,
});
const secondEmail = channel({
  id: "email-2",
  kind: "email",
  value: "owner@okaeri-resort.example",
  display_order: 2,
});

function givenChannels(channels: ContactChannel[]) {
  vi.mocked(useActiveContactChannels).mockReturnValue({
    data: channels,
    isPending: false,
    isSuccess: true,
  } as unknown as ReturnType<typeof useActiveContactChannels>);
}

function renderAt(path: "/terms-and-conditions" | "/privacy-policy") {
  const rootRoute = createRootRoute();
  const routeTree = rootRoute.addChildren([
    TermsRoute.update({
      id: "/terms-and-conditions",
      path: "/terms-and-conditions",
      getParentRoute: () => rootRoute,
    } as never),
    PrivacyPolicyRoute.update({
      id: "/privacy-policy",
      path: "/privacy-policy",
      getParentRoute: () => rootRoute,
    } as never),
  ]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

async function contactSection(heading: RegExp) {
  const sectionHeading = await screen.findByRole("heading", { name: heading });
  return within(sectionHeading.closest("section")!);
}

describe("Terms and conditions contact information", () => {
  beforeEach(() => vi.mocked(useActiveContactChannels).mockReset());

  it("lists every visible contact channel", async () => {
    givenChannels([viber, firstEmail]);
    renderAt("/terms-and-conditions");

    const section = await contactSection(/Contact Information/);
    expect(section.getByText("Okaeri Resort")).toBeInTheDocument();
    expect(section.getByRole("link", { name: "Viber: +63 917 123 4567" })).toBeInTheDocument();
    expect(
      section.getByRole("link", { name: "Email: stay@okaeri-resort.example" })
    ).toBeInTheDocument();
    expect(section.queryByText(/Business Hours/)).not.toBeInTheDocument();
  });

  it("says no way to reach the resort is listed when no channel is visible", async () => {
    givenChannels([]);
    renderAt("/terms-and-conditions");

    const section = await contactSection(/Contact Information/);
    expect(section.getByText("Ways to reach the resort are not listed yet.")).toBeInTheDocument();
  });
  it("shows the notice instead of nothing when the channels fail to load", async () => {
    vi.mocked(useActiveContactChannels).mockReturnValue({
      data: undefined,
      isError: true,
    } as unknown as ReturnType<typeof useActiveContactChannels>);
    renderAt("/terms-and-conditions");

    const section = await contactSection(/Contact Information/);
    expect(section.getByText("Ways to reach the resort are not listed yet.")).toBeInTheDocument();
  });
});

describe("Privacy policy Data Protection Officer block", () => {
  beforeEach(() => vi.mocked(useActiveContactChannels).mockReset());

  it("names the resort manager and shows only the first visible email channel", async () => {
    givenChannels([viber, firstEmail, secondEmail]);
    renderAt("/privacy-policy");

    const section = await contactSection(/Contact Information/);
    expect(section.getByText("Data Protection Officer")).toBeInTheDocument();
    expect(section.getByText(/resort manager handles privacy requests/)).toBeInTheDocument();
    expect(
      section.getByRole("link", { name: "Email: stay@okaeri-resort.example" })
    ).toBeInTheDocument();
    expect(section.queryByText("owner@okaeri-resort.example")).not.toBeInTheDocument();
    expect(section.queryByRole("link", { name: /Viber/ })).not.toBeInTheDocument();
    expect(section.queryByText(/Business Hours/)).not.toBeInTheDocument();
  });

  it("lists every visible channel when no email channel is visible", async () => {
    givenChannels([viber]);
    renderAt("/privacy-policy");

    const section = await contactSection(/Contact Information/);
    expect(section.getByRole("link", { name: "Viber: +63 917 123 4567" })).toBeInTheDocument();
  });

  it("says no way to reach the resort is listed when no channel is visible", async () => {
    givenChannels([]);
    renderAt("/privacy-policy");

    const section = await contactSection(/Contact Information/);
    expect(section.getByText("Ways to reach the resort are not listed yet.")).toBeInTheDocument();
  });
});
