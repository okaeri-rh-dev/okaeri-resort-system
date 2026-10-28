import { useState } from "react";

import { toLetterheadContacts } from "@/components/documents/letterhead-contacts";
import type { LetterheadConfig } from "@/components/documents/types";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@/components/patterns";
import { useActiveContactChannels } from "@/hooks/useContactChannels";
import { useDocumentStore } from "@/stores/useDocumentStore";

import { LogoUploader } from "./LogoUploader";

interface LetterheadSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LetterheadSettings({ open, onOpenChange }: LetterheadSettingsProps) {
  const { letterhead, updateLetterhead, resetLetterhead } = useDocumentStore();
  const { data: contactChannels = [] } = useActiveContactChannels();

  // Local state for the form to batch updates on save
  const [local, setLocal] = useState(letterhead);

  // Sync local state when dialog opens
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setLocal(letterhead);
    onOpenChange(nextOpen);
  };

  const handleSave = () => {
    updateLetterhead(local);
    onOpenChange(false);
  };

  const handleReset = () => {
    resetLetterhead(toLetterheadContacts(contactChannels));
    setLocal(useDocumentStore.getState().letterhead);
  };

  const set = (field: keyof LetterheadConfig, value: string | undefined) => {
    setLocal((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Letterhead Settings</DialogTitle>
          <DialogDescription>
            Configure your resort's letterhead details. These appear on all generated documents.
          </DialogDescription>
        </DialogHeader>

        <div className="@container space-y-4 py-2">
          <LogoUploader
            logo_base64={local.logo_base64}
            onLogoChange={(val) => set("logo_base64", val)}
          />

          <div className="grid gap-3 @md:grid-cols-2">
            <div className="@md:col-span-2">
              <Label htmlFor="resort_name">Resort Name</Label>
              <Input
                id="resort_name"
                value={local.resort_name}
                onChange={(e) => set("resort_name", e.target.value)}
              />
            </div>

            <div className="@md:col-span-2">
              <Label htmlFor="tagline">Tagline</Label>
              <Input
                id="tagline"
                value={local.tagline || ""}
                onChange={(e) => set("tagline", e.target.value)}
                placeholder="Your Home Away From Home"
              />
            </div>

            <div className="@md:col-span-2">
              <Label htmlFor="address_line_1">Address Line 1</Label>
              <Input
                id="address_line_1"
                value={local.address_line_1}
                onChange={(e) => set("address_line_1", e.target.value)}
              />
            </div>

            <div className="@md:col-span-2">
              <Label htmlFor="address_line_2">Address Line 2</Label>
              <Input
                id="address_line_2"
                value={local.address_line_2 || ""}
                onChange={(e) => set("address_line_2", e.target.value)}
                placeholder="Building, Floor, etc."
              />
            </div>

            <div>
              <Label htmlFor="city">City</Label>
              <Input id="city" value={local.city} onChange={(e) => set("city", e.target.value)} />
            </div>

            <div>
              <Label htmlFor="province">Province</Label>
              <Input
                id="province"
                value={local.province}
                onChange={(e) => set("province", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="zip_code">ZIP Code</Label>
              <Input
                id="zip_code"
                value={local.zip_code}
                onChange={(e) => set("zip_code", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={local.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={local.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={local.website || ""}
                onChange={(e) => set("website", e.target.value)}
                placeholder="www.example.com"
              />
            </div>

            <div className="@md:col-span-2">
              <Label htmlFor="tin">TIN (Tax Identification Number)</Label>
              <Input
                id="tin"
                value={local.tin || ""}
                onChange={(e) => set("tin", e.target.value)}
                placeholder="000-000-000-000"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={handleReset}>
            Reset to Defaults
          </Button>
          <Button type="button" onClick={handleSave}>
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
