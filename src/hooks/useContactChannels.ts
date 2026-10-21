import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { toKindLabel, type MoveDirection } from "@/lib/contact-channel";
import { contactChannelKeys } from "@/lib/query-keys";
import { db, handleSupabaseError } from "@/lib/supabase";
import type { Tables, TablesInsert } from "@/types/database.types";

export type ContactChannel = Tables<"contact_channels">;

export type ContactChannelInput = Pick<
  TablesInsert<"contact_channels">,
  "kind" | "value" | "label"
>;

const UNIQUE_VIOLATION = "23505";

function contactChannelErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && error.code === UNIQUE_VIOLATION) {
    return "This channel already exists";
  }
  return handleSupabaseError(error);
}

const contactChannelsQuery = () =>
  queryOptions({
    queryKey: contactChannelKeys.list(),
    queryFn: async (): Promise<ContactChannel[]> => {
      const { data, error } = await db.contactChannels.all();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

// Contact channels rarely change, so guest pages can cache them for a long time.
const activeContactChannelsQuery = () =>
  queryOptions({
    queryKey: contactChannelKeys.active(),
    queryFn: async (): Promise<ContactChannel[]> => {
      const { data, error } = await db.contactChannels.active();
      if (error) throw error;
      return data;
    },
    staleTime: 30 * 60 * 1000,
  });

/** Every contact channel, hidden ones included, for admin settings. */
export function useContactChannels() {
  return useQuery(contactChannelsQuery());
}

/** Active contact channels in display order, for guest-facing pages. */
export function useActiveContactChannels() {
  return useQuery(activeContactChannelsQuery());
}

export function useCreateContactChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ContactChannelInput): Promise<ContactChannel> => {
      const { data, error } = await db.contactChannels.create(input);
      if (error) throw error;
      return data;
    },
    onSuccess: (channel) => {
      queryClient.invalidateQueries({ queryKey: contactChannelKeys.all });
      toast.success("Contact channel added", {
        description: `${toKindLabel(channel)} is now listed.`,
      });
    },
    onError: (error) => {
      toast.error("Could not add contact channel", {
        description: contactChannelErrorMessage(error),
      });
    },
  });
}

export function useUpdateContactChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: ContactChannelInput;
    }): Promise<ContactChannel> => {
      const { data, error } = await db.contactChannels.update(id, updates);
      if (error) throw error;
      return data;
    },
    onSuccess: (channel) => {
      queryClient.invalidateQueries({ queryKey: contactChannelKeys.all });
      toast.success("Contact channel updated", {
        description: `${toKindLabel(channel)} has been updated.`,
      });
    },
    onError: (error) => {
      toast.error("Could not update contact channel", {
        description: contactChannelErrorMessage(error),
      });
    },
  });
}

export function useSetContactChannelActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      isActive,
    }: {
      id: string;
      isActive: boolean;
    }): Promise<ContactChannel> => {
      const { data, error } = await db.contactChannels.setActive(id, isActive);
      if (error) throw error;
      return data;
    },
    onSuccess: (channel) => {
      queryClient.invalidateQueries({ queryKey: contactChannelKeys.all });
      const kindLabel = toKindLabel(channel);
      if (channel.is_active) {
        toast.success("Contact channel shown", { description: `Guests now see ${kindLabel}.` });
      } else {
        toast.success("Contact channel hidden", {
          description: `Guests no longer see ${kindLabel}.`,
        });
      }
    },
    onError: (error, { isActive }) => {
      toast.error(`Could not ${isActive ? "show" : "hide"} contact channel`, {
        description: contactChannelErrorMessage(error),
      });
    },
  });
}

export function useReorderContactChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      channel,
      direction,
    }: {
      channel: ContactChannel;
      direction: MoveDirection;
    }): Promise<void> => {
      const { error } = await db.contactChannels.reorder(channel.id, direction);
      if (error) throw error;
    },
    onSuccess: (_, { channel, direction }) => {
      queryClient.invalidateQueries({ queryKey: contactChannelKeys.all });
      toast.success("Contact channel moved", {
        description: `${toKindLabel(channel)} moved ${direction}.`,
      });
    },
    onError: (error) => {
      toast.error("Could not move contact channel", {
        description: contactChannelErrorMessage(error),
      });
    },
  });
}
