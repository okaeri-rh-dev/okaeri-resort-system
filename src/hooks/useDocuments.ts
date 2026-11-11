import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { DEFAULT_LETTERHEAD } from "@/components/documents/constants";
import { toLetterheadContacts } from "@/components/documents/letterhead-contacts";
import type { DocumentType, LetterheadConfig } from "@/components/documents/types";
import { useActiveContactChannels } from "@/hooks/useContactChannels";
import { afterWrite } from "@/lib/after-write";
import { letterheadKeys } from "@/lib/query-keys";
import { db, handleSupabaseError } from "@/lib/supabase";
import type { TablesInsert } from "@/types/database.types";

const letterheadQuery = () =>
  queryOptions({
    queryKey: letterheadKeys.all,
    queryFn: async (): Promise<LetterheadConfig | null> => {
      const { data, error } = await db.documents.letterhead();
      if (error) throw error;
      return data;
    },
  });

/** The shared letterhead; until someone saves it, the default one with the active contact channels. */
export function useLetterhead(): LetterheadConfig | undefined {
  const { data: saved } = useQuery(letterheadQuery());
  const { data: channels } = useActiveContactChannels();
  if (saved) return saved;
  if (saved === null && channels) {
    return { ...DEFAULT_LETTERHEAD, ...toLetterheadContacts(channels) };
  }
  return undefined;
}

// Blank optional fields go as "", so a cleared logo or TIN is also cleared in the shared row.
function toLetterheadRow(letterhead: LetterheadConfig): TablesInsert<"letterhead"> {
  return {
    resort_name: letterhead.resort_name,
    tagline: letterhead.tagline ?? "",
    logo_base64: letterhead.logo_base64 ?? "",
    address_line_1: letterhead.address_line_1,
    address_line_2: letterhead.address_line_2 ?? "",
    city: letterhead.city,
    province: letterhead.province,
    zip_code: letterhead.zip_code,
    phone: letterhead.phone,
    email: letterhead.email,
    website: letterhead.website ?? "",
    tin: letterhead.tin ?? "",
  };
}

export function useSaveLetterhead() {
  return useMutation({
    mutationFn: async (letterhead: LetterheadConfig): Promise<void> => {
      const { error } = await db.documents.saveLetterhead(toLetterheadRow(letterhead));
      if (error) throw error;
    },
    onSettled: () => afterWrite("letterhead"),
    onError: (error) => {
      toast.error("Could not save letterhead", { description: handleSupabaseError(error) });
    },
  });
}

/** Takes the next shared document number; offline it fails instead of waiting or guessing. */
export function useAllocateDocumentNumber() {
  return useMutation({
    mutationFn: async (documentType: DocumentType): Promise<string> => {
      const { data, error } = await db.documents.allocateNumber(documentType);
      if (error) throw error;
      return data;
    },
    networkMode: "always",
    onError: (error) => {
      toast.error("Could not get a document number", {
        description: handleSupabaseError(error),
      });
    },
  });
}
