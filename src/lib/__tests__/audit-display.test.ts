import { describe, expect, it } from "vitest";

import { auditActorLabel, isAnonymized } from "../audit-display";

const ANONYMIZED = { anonymized_at: "2028-01-02T03:00:00Z" };

describe("isAnonymized", () => {
  it("is true only when metadata carries anonymized_at", () => {
    expect(isAnonymized({ metadata: ANONYMIZED })).toBe(true);
    expect(isAnonymized({ metadata: { ip: "10.0.0.1" } })).toBe(false);
    expect(isAnonymized({ metadata: null })).toBe(false);
    expect(isAnonymized({ metadata: ["anonymized_at"] })).toBe(false);
  });
});

describe("auditActorLabel", () => {
  it("shows the email when present", () => {
    expect(auditActorLabel({ user_email: "a@b.com", user_id: "u1", metadata: null })).toBe(
      "a@b.com"
    );
  });

  it("marks anonymized staff rows", () => {
    expect(auditActorLabel({ user_email: null, user_id: "u1", metadata: ANONYMIZED })).toBe(
      "Staff (details removed)"
    );
  });

  it("falls back to System otherwise", () => {
    expect(auditActorLabel({ user_email: null, user_id: null, metadata: ANONYMIZED })).toBe(
      "System"
    );
    expect(auditActorLabel({ user_email: null, user_id: "u1", metadata: null })).toBe("System");
  });
});
