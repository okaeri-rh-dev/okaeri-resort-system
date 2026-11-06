import { useState } from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDeleteQrCode, useUploadQrCode } from "@/hooks/usePaymentMethods";
import { stubPaneWidth } from "@/test/pane-width";
import type { PaymentMethodConfig } from "@/types";

import { PaymentMethodForm } from "../PaymentMethodForm";

vi.mock("@/hooks/usePaymentMethods", () => ({
  useCreatePaymentMethod: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdatePaymentMethod: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUploadQrCode: vi.fn(),
  useDeleteQrCode: vi.fn(),
}));

const gcash: PaymentMethodConfig = {
  id: "gcash",
  method_type: "e-wallet",
  provider_name: "GCash",
  display_name: "GCash",
  account_name: null,
  account_number: null,
  bank_name: null,
  qr_code_url: null,
  qr_code_storage_path: null,
  icon_name: "Smartphone",
  display_order: 0,
  instructions: null,
  is_active: true,
  created_at: null,
  updated_at: null,
};

const gcashWithQr: PaymentMethodConfig = {
  ...gcash,
  qr_code_url: "https://example.test/old.png",
  qr_code_storage_path: "qr-codes/gcash-0.png",
};

const upload = vi.fn();
const remove = vi.fn();

describe("PaymentMethodForm QR code", () => {
  beforeEach(() => {
    stubPaneWidth(390);
    upload.mockReset();
    remove.mockReset().mockResolvedValue(undefined);
    vi.mocked(useUploadQrCode).mockReturnValue({
      mutateAsync: upload,
      isPending: false,
    } as unknown as ReturnType<typeof useUploadQrCode>);
    vi.mocked(useDeleteQrCode).mockReturnValue({
      mutateAsync: remove,
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteQrCode>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows no QR code when an upload fails after a remove", async () => {
    upload.mockRejectedValue(new Error("upload failed"));
    const user = userEvent.setup();
    render(<PaymentMethodForm method={gcashWithQr} />);

    await user.click(screen.getByRole("button", { name: "Remove QR code" }));
    await user.upload(
      screen.getByLabelText("Upload QR code image"),
      new File(["qr"], "qr.png", { type: "image/png" })
    );

    await waitFor(() => expect(upload).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByRole("img", { name: "QR Code" })).not.toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: "Upload QR Code" })).toBeInTheDocument();
  });

  it("removes a QR code uploaded in the same form session", async () => {
    upload.mockResolvedValue({
      ...gcash,
      qr_code_url: "https://example.test/qr.png",
      qr_code_storage_path: "qr-codes/gcash-1.png",
    });
    const user = userEvent.setup();
    render(<PaymentMethodForm method={gcash} />);

    await user.upload(
      screen.getByLabelText("Upload QR code image"),
      new File(["qr"], "qr.png", { type: "image/png" })
    );
    await user.click(await screen.findByRole("button", { name: "Remove QR code" }));

    expect(remove).toHaveBeenCalledWith({ id: "gcash", storagePath: "qr-codes/gcash-1.png" });
    expect(screen.queryByRole("img", { name: "QR Code" })).not.toBeInTheDocument();
  });

  it("removes a QR code that existed when the form opened", async () => {
    const user = userEvent.setup();
    render(<PaymentMethodForm method={gcashWithQr} />);

    await user.click(screen.getByRole("button", { name: "Remove QR code" }));

    expect(remove).toHaveBeenCalledWith({ id: "gcash", storagePath: "qr-codes/gcash-0.png" });
  });

  it("does not remove a QR code while an upload is pending", async () => {
    function useNeverEndingUpload() {
      const [isPending, setIsPending] = useState(false);
      return {
        isPending,
        mutateAsync: () => {
          setIsPending(true);
          return new Promise(() => {});
        },
      } as unknown as ReturnType<typeof useUploadQrCode>;
    }
    vi.mocked(useUploadQrCode).mockImplementation(useNeverEndingUpload);
    const user = userEvent.setup();
    render(<PaymentMethodForm method={gcash} />);

    await user.upload(
      screen.getByLabelText("Upload QR code image"),
      new File(["qr"], "qr.png", { type: "image/png" })
    );
    const removeButton = await screen.findByRole("button", { name: "Remove QR code" });
    expect(removeButton).toBeDisabled();
    await user.click(removeButton);

    expect(remove).not.toHaveBeenCalled();
    expect(screen.getByRole("img", { name: "QR Code" })).toBeInTheDocument();
  });
});
