// Mirrors the contact_channels_kind_check constraint.
export const CONTACT_CHANNEL_KINDS = [
  "mobile",
  "viber",
  "whatsapp",
  "messenger",
  "email",
  "facebook",
  "instagram",
] as const;

export type ContactChannelKind = (typeof CONTACT_CHANNEL_KINDS)[number];
