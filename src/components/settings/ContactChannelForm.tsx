import type { ComponentProps } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  Button,
  Form,
  FormField,
  Input,
  PhoneInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/patterns";
import {
  useCreateContactChannel,
  useUpdateContactChannel,
  type ContactChannel,
} from "@/hooks/useContactChannels";
import {
  CONTACT_CHANNEL_KINDS,
  contactChannelKindNames,
  isPhoneKind,
  normalizeValue,
  PH_MOBILE_PLACEHOLDER,
  toDisplayValue,
  validateValue,
  type ContactChannelKind,
} from "@/lib/contact-channel";

const contactChannelSchema = z
  .object({
    kind: z.enum(CONTACT_CHANNEL_KINDS),
    value: z.string(),
    label: z.string().trim().max(40, "Keep the label to 40 characters or fewer"),
  })
  .superRefine(({ kind, value }, ctx) => {
    const message = validateValue(kind, value);
    if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message });
  });

type ContactChannelFormValues = z.infer<typeof contactChannelSchema>;

const SOCIAL_HINT = "Paste the URL or the handle.";

const valueFieldText: Record<ContactChannelKind, { placeholder: string; description?: string }> = {
  mobile: { placeholder: PH_MOBILE_PLACEHOLDER },
  viber: { placeholder: PH_MOBILE_PLACEHOLDER },
  whatsapp: { placeholder: PH_MOBILE_PLACEHOLDER },
  messenger: { placeholder: "m.me/yourpage", description: SOCIAL_HINT },
  facebook: { placeholder: "facebook.com/yourpage", description: SOCIAL_HINT },
  instagram: { placeholder: "@yourhandle", description: SOCIAL_HINT },
  email: { placeholder: "stay@example.com" },
};

interface KindSelectProps extends Omit<ComponentProps<typeof SelectTrigger>, "onChange"> {
  value: ContactChannelKind;
  onChange: (kind: ContactChannelKind) => void;
}

// FormField hands its id and ARIA props to the control; a Select needs them on its trigger.
function KindSelect({ value, onChange, ...triggerProps }: KindSelectProps) {
  return (
    <Select value={value} onValueChange={(kind) => onChange(kind as ContactChannelKind)}>
      <SelectTrigger {...triggerProps}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CONTACT_CHANNEL_KINDS.map((kind) => (
          <SelectItem key={kind} value={kind}>
            {contactChannelKindNames[kind]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface ContactChannelFormProps {
  channel?: ContactChannel;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ContactChannelForm({ channel, onSuccess, onCancel }: ContactChannelFormProps) {
  const createChannel = useCreateContactChannel();
  const updateChannel = useUpdateContactChannel();

  const form = useForm<ContactChannelFormValues>({
    resolver: zodResolver(contactChannelSchema),
    defaultValues: {
      kind: channel?.kind ?? "mobile",
      value: channel ? toDisplayValue(channel) : "",
      label: channel?.label ?? "",
    },
  });

  const kind = form.watch("kind");
  const { placeholder, description } = valueFieldText[kind];

  const onSubmit = async ({ kind, value, label }: ContactChannelFormValues) => {
    const input = { kind, value: normalizeValue(kind, value), label: label || null };
    try {
      if (channel) {
        await updateChannel.mutateAsync({ id: channel.id, updates: input });
      } else {
        await createChannel.mutateAsync(input);
      }
      onSuccess();
    } catch {
      // The mutation's error toast says what went wrong; the dialog stays open to fix it.
    }
  };

  const isSaving = createChannel.isPending || updateChannel.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="kind" label="Kind">
          {(field) => <KindSelect {...field} />}
        </FormField>

        <FormField control={form.control} name="value" label="Value" description={description}>
          {(field) =>
            isPhoneKind(kind) ? (
              <PhoneInput autoComplete="off" placeholder={placeholder} {...field} />
            ) : (
              <Input
                type={kind === "email" ? "email" : "text"}
                inputMode={kind === "email" ? "email" : "url"}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={placeholder}
                {...field}
              />
            )
          }
        </FormField>

        <FormField
          control={form.control}
          name="label"
          label="Label (optional)"
          description="Whose number or which account, such as Maria."
        >
          {(field) => <Input autoComplete="off" maxLength={40} {...field} />}
        </FormField>

        <div className="medium:flex-row medium:justify-end flex flex-col-reverse gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {channel ? "Save channel" : "Add channel"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
