import type { ComponentType, SVGProps } from "react";

import { Mail, Phone } from "lucide-react";

import type { ContactChannelKind } from "@/lib/contact-channel";

import { FacebookIcon, InstagramIcon, MessengerIcon, ViberIcon, WhatsAppIcon } from "./brand-icons";

export const contactChannelIcons: Record<
  ContactChannelKind,
  ComponentType<SVGProps<SVGSVGElement>>
> = {
  mobile: Phone,
  viber: ViberIcon,
  whatsapp: WhatsAppIcon,
  messenger: MessengerIcon,
  email: Mail,
  facebook: FacebookIcon,
  instagram: InstagramIcon,
};
