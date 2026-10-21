import { describe, expect, it } from "vitest";

import {
  CONTACT_CHANNEL_KINDS,
  toDisplayValue,
  toHref,
  toKindLabel,
  type ContactChannelKind,
} from "../contact-channel";

function coveredKinds(cases: Array<[ContactChannelKind, ...unknown[]]>) {
  return cases.map(([kind]) => kind).sort();
}

const everyKind = [...CONTACT_CHANNEL_KINDS].sort();

describe("toHref", () => {
  const cases: Array<[ContactChannelKind, string, string]> = [
    ["mobile", "+639171234567", "tel:+639171234567"],
    ["viber", "+639171234567", "viber://chat?number=%2B639171234567"],
    ["whatsapp", "+639171234567", "https://wa.me/639171234567"],
    ["messenger", "okaeriresort", "https://m.me/okaeriresort"],
    ["facebook", "okaeriresortlaunion", "https://facebook.com/okaeriresortlaunion"],
    ["instagram", "okaeri.resort", "https://instagram.com/okaeri.resort"],
    ["email", "stay@okaeri.example", "mailto:stay@okaeri.example"],
  ];

  it.each(cases)("links a %s channel (%s) to %s", (kind, value, href) => {
    expect(toHref({ kind, value })).toBe(href);
  });

  it("covers every kind", () => {
    expect(coveredKinds(cases)).toEqual(everyKind);
  });
});

describe("toKindLabel", () => {
  const cases: Array<[ContactChannelKind, string | null, string]> = [
    ["mobile", "Maria", "Mobile (Maria)"],
    ["viber", null, "Viber"],
    ["whatsapp", null, "WhatsApp"],
    ["messenger", null, "Messenger"],
    ["email", "Bookings", "Email (Bookings)"],
    ["facebook", null, "Facebook"],
    ["instagram", null, "Instagram"],
  ];

  it.each(cases)("names a %s channel labelled %s as %s", (kind, label, text) => {
    expect(toKindLabel({ kind, label })).toBe(text);
  });

  it("covers every kind", () => {
    expect(coveredKinds(cases)).toEqual(everyKind);
  });
});

describe("toDisplayValue", () => {
  const cases: Array<[ContactChannelKind, string, string]> = [
    ["mobile", "+639171234567", "+63 917 123 4567"],
    ["viber", "+639181112222", "+63 918 111 2222"],
    ["whatsapp", "+639285556666", "+63 928 555 6666"],
    ["messenger", "okaeriresort", "okaeriresort"],
    ["facebook", "okaeriresortlaunion", "okaeriresortlaunion"],
    ["instagram", "okaeri.resort", "@okaeri.resort"],
    ["email", "stay@okaeri.example", "stay@okaeri.example"],
  ];

  it.each(cases)("shows a %s channel (%s) as %s", (kind, value, display) => {
    expect(toDisplayValue({ kind, value })).toBe(display);
  });

  it("covers every kind", () => {
    expect(coveredKinds(cases)).toEqual(everyKind);
  });
});
