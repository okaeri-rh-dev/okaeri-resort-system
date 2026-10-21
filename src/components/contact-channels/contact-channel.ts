import type { ComponentType, SVGProps } from "react";

import { Mail, Phone } from "lucide-react";

import type { ContactChannelKind } from "@/types/contact-channel-kind";

import { FacebookIcon, InstagramIcon, MessengerIcon, ViberIcon, WhatsAppIcon } from "./brand-icons";

export { CONTACT_CHANNEL_KINDS, type ContactChannelKind } from "@/types/contact-channel-kind";

export interface ContactChannelValue {
  kind: ContactChannelKind;
  value: string;
}

interface ContactChannelKindDetails {
  name: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export const contactChannelKinds: Record<ContactChannelKind, ContactChannelKindDetails> = {
  mobile: { name: "Mobile", Icon: Phone },
  viber: { name: "Viber", Icon: ViberIcon },
  whatsapp: { name: "WhatsApp", Icon: WhatsAppIcon },
  messenger: { name: "Messenger", Icon: MessengerIcon },
  email: { name: "Email", Icon: Mail },
  facebook: { name: "Facebook", Icon: FacebookIcon },
  instagram: { name: "Instagram", Icon: InstagramIcon },
};

export function toKindLabel({
  kind,
  label,
}: {
  kind: ContactChannelKind;
  label: string | null;
}): string {
  const { name } = contactChannelKinds[kind];
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
