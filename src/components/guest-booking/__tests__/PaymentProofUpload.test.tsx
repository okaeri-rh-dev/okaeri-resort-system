import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PaymentProofUpload } from "../PaymentProofUpload";

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function pngFile(name = "gcash.png") {
  return new File([new Uint8Array([...PNG_HEADER, 0, 0, 0, 0])], name, { type: "image/png" });
}

/** A stand-in for the signed-URL PUT that the test finishes by hand. */
class FakeUploadRequest {
  static pending: FakeUploadRequest[] = [];
  status = 0;
  upload = new EventTarget();
  private events = new EventTarget();

  constructor() {
    FakeUploadRequest.pending.push(this);
  }

  open() {}
  setRequestHeader() {}
  send() {}

  addEventListener(type: string, listener: EventListener) {
    this.events.addEventListener(type, listener);
  }

  progress(loaded: number, total: number) {
    const event = Object.assign(new Event("progress"), { lengthComputable: true, loaded, total });
    this.upload.dispatchEvent(event);
  }

  respond(status: number) {
    this.status = status;
    this.events.dispatchEvent(new Event("load"));
  }
}

async function nextUploadRequest() {
  await waitFor(() => expect(FakeUploadRequest.pending.length).toBeGreaterThan(0));
  return FakeUploadRequest.pending.shift()!;
}

const fetchUploadUrl = vi.fn();
let storedPathCount = 0;

beforeEach(() => {
  FakeUploadRequest.pending = [];
  storedPathCount = 0;
  fetchUploadUrl.mockImplementation(async () => {
    storedPathCount += 1;
    return {
      ok: true,
      json: async () => ({
        success: true,
        upload_url: "https://storage.test/signed",
        file_path: `payment-proofs/TEMP-1/proof-${storedPathCount}.png`,
      }),
    };
  });
  vi.stubGlobal("fetch", fetchUploadUrl);
  vi.stubGlobal("XMLHttpRequest", FakeUploadRequest);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderUpload(storedPath: string | null = null) {
  const onChange = vi.fn();
  const onUploadingChange = vi.fn();
  const user = userEvent.setup({ applyAccept: false });
  render(
    <PaymentProofUpload
      bookingReference="TEMP-1"
      value={storedPath}
      onChange={onChange}
      onUploadingChange={onUploadingChange}
    />
  );
  const chooseFile = (file: File) =>
    user.upload(screen.getByLabelText(/payment screenshot file/i), file);
  return { onChange, onUploadingChange, user, chooseFile };
}

async function uploadSuccessfully(chooseFile: (file: File) => Promise<void>, file = pngFile()) {
  await chooseFile(file);
  const request = await nextUploadRequest();
  act(() => request.respond(200));
}

describe("PaymentProofUpload", () => {
  it("uploads a valid screenshot as soon as it is chosen", async () => {
    const { onChange, chooseFile } = renderUpload();

    await uploadSuccessfully(chooseFile);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("payment-proofs/TEMP-1/proof-1.png"));
    expect(screen.queryByRole("button", { name: /^upload$/i })).not.toBeInTheDocument();
    expect(screen.getByText("gcash.png")).toBeInTheDocument();
  });

  it("shows progress while uploading and reports the upload as in progress until it settles", async () => {
    const { onUploadingChange, chooseFile } = renderUpload();

    await chooseFile(pngFile());
    const request = await nextUploadRequest();
    act(() => request.progress(40, 100));

    expect(screen.getByText(/uploading… 40%/i)).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /upload progress/i })).toBeInTheDocument();
    expect(onUploadingChange).toHaveBeenLastCalledWith(true);

    act(() => request.respond(200));

    await waitFor(() => expect(onUploadingChange).toHaveBeenLastCalledWith(false));
    expect(onUploadingChange.mock.calls).toEqual([[true], [false]]);
  });

  it("shows the error and Try again when the upload fails, and a retry stores the same file", async () => {
    const { onChange, user, chooseFile } = renderUpload();

    await chooseFile(pngFile());
    const failedRequest = await nextUploadRequest();
    act(() => failedRequest.respond(500));

    expect(await screen.findByText(/upload failed with status 500/i)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /try again/i }));
    const retryRequest = await nextUploadRequest();
    act(() => retryRequest.respond(200));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("payment-proofs/TEMP-1/proof-2.png"));
    expect(screen.getByText("gcash.png")).toBeInTheDocument();
  });

  it("opens the file picker from Replace and stores the new file in place of the old one", async () => {
    const { onChange, user, chooseFile } = renderUpload();
    await uploadSuccessfully(chooseFile);
    await screen.findByRole("button", { name: /replace/i });

    const openPicker = vi.spyOn(HTMLInputElement.prototype, "click");
    await user.click(screen.getByRole("button", { name: /replace/i }));
    expect(openPicker).toHaveBeenCalled();
    openPicker.mockRestore();

    await uploadSuccessfully(chooseFile, pngFile("bank-transfer.png"));

    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith("payment-proofs/TEMP-1/proof-2.png")
    );
    expect(screen.getByText("bank-transfer.png")).toBeInTheDocument();
  });

  it("clears the stored path when a replacement fails, and a retry stores the new file", async () => {
    const { onChange, user, chooseFile } = renderUpload("payment-proofs/TEMP-1/earlier.png");
    await user.click(screen.getByRole("button", { name: /replace/i }));

    await chooseFile(pngFile("bank-transfer.png"));
    const failedRequest = await nextUploadRequest();
    act(() => failedRequest.respond(500));

    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(null));

    await user.click(screen.getByRole("button", { name: /try again/i }));
    const retryRequest = await nextUploadRequest();
    act(() => retryRequest.respond(200));

    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith("payment-proofs/TEMP-1/proof-2.png")
    );
  });

  it("clears the stored path when Remove is pressed", async () => {
    const { onChange, user, chooseFile } = renderUpload();
    await uploadSuccessfully(chooseFile);

    await user.click(await screen.findByRole("button", { name: /remove/i }));

    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("button", { name: /choose screenshot/i })).toBeInTheDocument();
  });

  it("rejects a file of the wrong type with a clear message and does not upload it", async () => {
    const { onChange, chooseFile } = renderUpload();
    const textFile = new File(["not an image"], "notes.txt", { type: "text/plain" });

    await chooseFile(textFile);

    expect(
      await screen.findByText(/only jpeg, png, and pdf files are allowed/i)
    ).toBeInTheDocument();
    expect(fetchUploadUrl).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });
});
