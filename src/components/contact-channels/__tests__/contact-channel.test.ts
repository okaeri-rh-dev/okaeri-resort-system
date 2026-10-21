import { describe, expect, it } from "vitest";

import {
  CONTACT_CHANNEL_KINDS,
  normalizeValue,
  toDisplayValue,
  toHref,
  toKindLabel,
  validateValue,
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

describe("normalizeValue", () => {
  const cases: Array<[ContactChannelKind, string, string]> = [
    ["mobile", "0917 123 4567", "+639171234567"],
    ["mobile", "9171234567", "+639171234567"],
    ["viber", "+63 917 123 4567", "+639171234567"],
    ["whatsapp", "639171234567", "+639171234567"],
    ["whatsapp", "0917-123-4567", "+639171234567"],
    ["messenger", "https://m.me/okaeriresort", "okaeriresort"],
    ["messenger", "messenger.com/t/okaeriresort/", "okaeriresort"],
    ["messenger", "https://www.facebook.com/okaeriresort", "okaeriresort"],
    ["messenger", "@okaeriresort", "okaeriresort"],
    ["facebook", "https://www.facebook.com/okaeriresortlaunion/", "okaeriresortlaunion"],
    ["facebook", "m.facebook.com/okaeriresortlaunion?ref=share", "okaeriresortlaunion"],
    ["facebook", "facebook.com/okaeriresortlaunion", "okaeriresortlaunion"],
    ["facebook", "  okaeriresortlaunion  ", "okaeriresortlaunion"],
    ["instagram", "https://www.instagram.com/okaeri.resort/?igsh=abc123", "okaeri.resort"],
    ["instagram", "instagram.com/okaeri.resort", "okaeri.resort"],
    ["instagram", "@okaeri.resort", "okaeri.resort"],
    ["email", "  Stay@Okaeri.Example ", "stay@okaeri.example"],
  ];

  it.each(cases)("normalizes a %s value %j to %j", (kind, input, stored) => {
    expect(normalizeValue(kind, input)).toBe(stored);
  });

  it("covers every kind", () => {
    expect([...new Set(coveredKinds(cases))]).toEqual(everyKind);
  });
});

describe("validateValue", () => {
  const validCases: Array<[ContactChannelKind, string]> = [
    ["mobile", "0917 123 4567"],
    ["viber", "+63 917 123 4567"],
    ["whatsapp", "639171234567"],
    ["messenger", "https://m.me/okaeriresort"],
    ["facebook", "https://www.facebook.com/okaeriresortlaunion/"],
    ["instagram", "@okaeri.resort"],
    ["email", " Stay@Okaeri.Example "],
  ];

  it.each(validCases)("accepts a %s value %j", (kind, input) => {
    expect(validateValue(kind, input)).toBeNull();
  });

  const invalidCases: Array<[ContactChannelKind, string, string]> = [
    ["mobile", "0917 123 456", "Enter a PH mobile number, like 0917 123 4567"],
    ["mobile", "02 8123 4567", "Enter a PH mobile number, like 0917 123 4567"],
    ["viber", "hello", "Enter a PH mobile number, like 0917 123 4567"],
    ["whatsapp", "", "Enter a PH mobile number, like 0917 123 4567"],
    ["messenger", "okaeri resort", "Paste the Messenger URL or the handle"],
    ["facebook", "https://example.com/okaeri", "Paste the Facebook URL or the handle"],
    ["instagram", "https://www.facebook.com/okaeri", "Paste the Instagram URL or the handle"],
    ["instagram", "@", "Paste the Instagram URL or the handle"],
    ["email", "stay@okaeri", "Enter an email address, like stay@example.com"],
    ["email", "stay okaeri@example.com", "Enter an email address, like stay@example.com"],
  ];

  it.each(invalidCases)("rejects a %s value %j with %j", (kind, input, message) => {
    expect(validateValue(kind, input)).toBe(message);
  });

  it("covers every kind", () => {
    expect(coveredKinds(validCases)).toEqual(everyKind);
    expect([...new Set(coveredKinds(invalidCases))]).toEqual(everyKind);
  });
});
