import type { ContactChannelKind } from "@/types/contact-channel-kind";

export { CONTACT_CHANNEL_KINDS, type ContactChannelKind } from "@/types/contact-channel-kind";

export interface ContactChannelValue {
  kind: ContactChannelKind;
  value: string;
}

export const contactChannelKindNames: Record<ContactChannelKind, string> = {
  mobile: "Mobile",
  viber: "Viber",
  whatsapp: "WhatsApp",
  messenger: "Messenger",
  email: "Email",
  facebook: "Facebook",
  instagram: "Instagram",
};

export function toKindLabel({
  kind,
  label,
}: {
  kind: ContactChannelKind;
  label: string | null;
}): string {
  const name = contactChannelKindNames[kind];
  return label ? `${name} (${label})` : name;
}

const PHONE_KINDS: ReadonlySet<ContactChannelKind> = new Set(["mobile", "viber", "whatsapp"]);

export function isPhoneKind(kind: ContactChannelKind): boolean {
  return PHONE_KINDS.has(kind);
}

function formatPhilippinePhone(e164: string): string {
  const match = /^\+63(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return match ? `+63 ${match[1]} ${match[2]} ${match[3]}` : e164;
}

function normalizePhilippinePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  const national = digits.replace(/^(63|0)(?=9\d{9}$)/, "");
  return /^9\d{9}$/.test(national) ? `+63${national}` : input.trim();
}

type SocialKind = Extract<ContactChannelKind, "messenger" | "facebook" | "instagram">;

// Each pattern matches a pasted profile URL and captures the handle.
const SOCIAL_URL_PATTERNS: Record<SocialKind, RegExp[]> = {
  messenger: [
    /^(?:https?:\/\/)?m\.me\/([^/?#]+)/i,
    /^(?:https?:\/\/)?(?:www\.)?messenger\.com\/t\/([^/?#]+)/i,
    /^(?:https?:\/\/)?(?:(?:www|m)\.)?facebook\.com\/([^/?#]+)/i,
  ],
  facebook: [/^(?:https?:\/\/)?(?:(?:www|m)\.)?facebook\.com\/([^/?#]+)/i],
  instagram: [/^(?:https?:\/\/)?(?:(?:www|m)\.)?instagram\.com\/([^/?#]+)/i],
};

function isSocialKind(kind: ContactChannelKind): kind is SocialKind {
  return kind in SOCIAL_URL_PATTERNS;
}

function normalizeHandle(kind: SocialKind, input: string): string {
  const trimmed = input.trim();
  for (const pattern of SOCIAL_URL_PATTERNS[kind]) {
    const handle = pattern.exec(trimmed)?.[1];
    if (handle) return handle;
  }
  return trimmed.replace(/^@/, "");
}

/** Turns what a manager typed or pasted into the value stored for that kind. */
export function normalizeValue(kind: ContactChannelKind, input: string): string {
  if (isPhoneKind(kind)) return normalizePhilippinePhone(input);
  if (isSocialKind(kind)) return normalizeHandle(kind, input);
  return input.trim().toLowerCase();
}

const STORED_VALUE_PATTERNS: Record<ContactChannelKind, RegExp> = {
  mobile: /^\+639\d{9}$/,
  viber: /^\+639\d{9}$/,
  whatsapp: /^\+639\d{9}$/,
  messenger: /^[A-Za-z0-9.-]{1,50}$/,
  facebook: /^[A-Za-z0-9.-]{1,50}$/,
  instagram: /^[A-Za-z0-9._]{1,30}$/,
  email: /^(?=.{1,254}$)[^\s@]+@[^\s@]+\.[^\s@]+$/,
};

function invalidValueMessage(kind: ContactChannelKind): string {
  if (isPhoneKind(kind)) return "Enter a PH mobile number, like 0917 123 4567";
  if (isSocialKind(kind)) return `Paste the ${contactChannelKindNames[kind]} URL or the handle`;
  return "Enter an email address, like stay@example.com";
}

/** The message to show when the input is not a valid value for its kind, or null when it is. */
export function validateValue(kind: ContactChannelKind, input: string): string | null {
  return STORED_VALUE_PATTERNS[kind].test(normalizeValue(kind, input))
    ? null
    : invalidValueMessage(kind);
}

export function toDisplayValue({ kind, value }: ContactChannelValue): string {
  if (isPhoneKind(kind)) return formatPhilippinePhone(value);
  if (kind === "instagram") return `@${value}`;
  return value;
}

export function toHref({ kind, value }: ContactChannelValue): string {
  switch (kind) {
    case "mobile":
      return `tel:${value}`;
    case "viber":
      return `viber://chat?number=${encodeURIComponent(value)}`;
    case "whatsapp":
      return `https://wa.me/${value.replace(/\D/g, "")}`;
    case "messenger":
      return `https://m.me/${value}`;
    case "facebook":
      return `https://facebook.com/${value}`;
    case "instagram":
      return `https://instagram.com/${value}`;
    case "email":
      return `mailto:${value}`;
  }
}
