import { useRef, useState } from "react";

import { CheckCircle, FileImage, FileText, Loader2, RotateCcw, Upload, X } from "lucide-react";

import { Button, Callout, Progress } from "@/components/patterns";
import { compressImage, formatFileSize, validateFile } from "@/lib/file-validation-client";
import { cn } from "@/lib/utils";

export interface PaymentProofUploadProps {
  /** Used to name the stored file. */
  bookingReference: string;
  onUploadComplete?: (filePath: string) => void;
  onUploadError?: (error: string) => void;
  disabled?: boolean;
  /** The stored file path (React Hook Form controlled value). */
  value?: string | null;
  onChange?: (value: string | null) => void;
  /** Reports true while a chosen screenshot is being checked or uploaded, false once it settles. */
  onUploadingChange?: (uploading: boolean) => void;
}

type UploadState =
  | { status: "empty" | "uploaded"; rejection?: string }
  | { status: "validating" | "uploading" | "failed" };

interface CompressionInfo {
  originalSize: number;
  ratio: number;
}

async function requestUploadUrl(bookingReference: string, file: File) {
  const response = await fetch("/api/guest-booking/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      booking_reference: bookingReference,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to get upload URL");
  }

  const data = (await response.json()) as {
    success: boolean;
    upload_url?: string;
    file_path?: string;
    error?: string;
  };

  if (!data.success) {
    throw new Error(data.error || "Upload URL generation failed");
  }
  if (!data.upload_url || !data.file_path) {
    throw new Error("Invalid response from upload URL endpoint");
  }

  return { uploadUrl: data.upload_url, filePath: data.file_path };
}

function putFile(uploadUrl: string, file: File, onProgress: (percentage: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Upload failed")));
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });
}

/**
 * The guest's payment screenshot field. Choosing (or dropping) a file validates it, compresses
 * images, and uploads it straight away to a signed storage URL; `onChange` receives the stored path.
 */
export function PaymentProofUpload({
  bookingReference,
  onUploadComplete,
  onUploadError,
  disabled,
  value,
  onChange,
  onUploadingChange,
}: PaymentProofUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>({
    status: value ? "uploaded" : "empty",
  });
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [compressionInfo, setCompressionInfo] = useState<CompressionInfo | null>(null);
  const { status } = uploadState;
  const rejection = "rejection" in uploadState ? uploadState.rejection : undefined;
  const isBusy = status === "validating" || status === "uploading";

  const reportUploading = async (task: () => Promise<void>) => {
    onUploadingChange?.(true);
    try {
      await task();
    } finally {
      onUploadingChange?.(false);
    }
  };

  const upload = async (fileToUpload: File) => {
    setUploadState({ status: "uploading" });
    setUploadProgress(0);

    try {
      const { uploadUrl, filePath } = await requestUploadUrl(bookingReference, fileToUpload);
      await putFile(uploadUrl, fileToUpload, setUploadProgress);
      setUploadState({ status: "uploaded" });
      onUploadComplete?.(filePath);
      onChange?.(filePath);
    } catch (err) {
      console.error("[UPLOAD] Upload error:", err);
      setUploadState({ status: "failed" });
      onUploadError?.(err instanceof Error ? err.message : "Upload failed");
      if (value) onChange?.(null);
    }
  };

  const checkAndUpload = async (chosenFile: File) => {
    setUploadState({ status: "validating" });
    setCompressionInfo(null);

    try {
      const validationError = await validateFile(chosenFile);
      if (validationError) {
        setUploadState({
          status: value ? "uploaded" : "empty",
          rejection: validationError.message,
        });
        return;
      }

      const compressed = await compressImage(chosenFile);
      if (compressed.wasCompressed) {
        setCompressionInfo({
          originalSize: compressed.originalSize,
          ratio: compressed.compressionRatio,
        });
      }

      setFile(compressed.file);
      await upload(compressed.file);
    } catch (err) {
      console.error("[UPLOAD] File validation error:", err);
      setUploadState({
        status: "empty",
        rejection: "We couldn't check that file. Please choose it again.",
      });
    }
  };

  const handleFileSelect = (chosenFile: File) => reportUploading(() => checkAndUpload(chosenFile));

  const handleRetry = () => (file ? reportUploading(() => upload(file)) : Promise.resolve());

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const chosenFile = event.target.files?.[0];
    event.target.value = "";
    if (chosenFile) {
      void handleFileSelect(chosenFile);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile && !disabled && !isBusy) {
      void handleFileSelect(droppedFile);
    }
  };

  const handleRemove = () => {
    setUploadState({ status: "empty" });
    setFile(null);
    setCompressionInfo(null);
    onChange?.(null);
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const FileIcon = file?.type === "application/pdf" ? FileText : FileImage;

  const fileDetails = (
    <div className="flex min-w-0 items-center gap-3">
      <FileIcon className="text-muted-foreground size-8 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{file?.name ?? "Payment screenshot"}</p>
        {file && (
          <p className="text-muted-foreground text-xs tabular-nums">
            {formatFileSize(file.size)}
            {compressionInfo &&
              ` · compressed by ${compressionInfo.ratio.toFixed(0)}% from ${formatFileSize(compressionInfo.originalSize)}`}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        aria-label="Payment screenshot file"
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled || isBusy}
      />

      {rejection && (
        <Callout tone="danger" title="Screenshot not accepted">
          {rejection}
        </Callout>
      )}

      {status === "empty" && (
        <div
          onDrop={handleDrop}
          onDragOver={(event) => event.preventDefault()}
          className={cn(
            "border-input bg-card rounded-lg border-2 border-dashed p-6 text-center",
            disabled && "opacity-50"
          )}
        >
          <Upload className="text-muted-foreground mx-auto mb-3 size-10" aria-hidden="true" />
          <p className="mb-1 text-sm font-medium">Drop your payment screenshot here</p>
          <p className="text-muted-foreground mb-4 text-xs">JPEG, PNG or PDF, up to 5MB</p>
          <Button type="button" variant="outline" onClick={openFilePicker} disabled={disabled}>
            <Upload aria-hidden="true" />
            Choose screenshot
          </Button>
        </div>
      )}

      {status === "validating" && (
        <div className="bg-card flex items-center gap-3 rounded-lg border p-4" role="status">
          <Loader2 className="text-primary size-5 animate-spin" aria-hidden="true" />
          <p className="text-muted-foreground text-sm">Checking your screenshot…</p>
        </div>
      )}

      {status === "uploading" && (
        <div className="bg-card space-y-3 rounded-lg border p-4">
          {fileDetails}
          <div role="status" className="flex items-center gap-2 text-sm">
            <Loader2 className="text-primary size-4 animate-spin" aria-hidden="true" />
            <span className="tabular-nums">Uploading… {uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} aria-label="Upload progress" className="h-2" />
        </div>
      )}

      {status === "uploaded" && (
        <div className="bg-card space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-3">
            {fileDetails}
            <span className="text-success-foreground flex shrink-0 items-center gap-1 text-sm font-medium">
              <CheckCircle className="size-4" aria-hidden="true" />
              Uploaded
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={openFilePicker} disabled={disabled}>
              <RotateCcw aria-hidden="true" />
              Replace
            </Button>
            <Button type="button" variant="outline" onClick={handleRemove} disabled={disabled}>
              <X aria-hidden="true" />
              Remove
            </Button>
          </div>
        </div>
      )}

      {status === "failed" && (
        <div className="bg-card space-y-3 rounded-lg border p-4">
          {fileDetails}
          <Callout tone="danger" title="Upload failed">
            We couldn&apos;t upload your screenshot. Check your connection and try again.
          </Callout>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void handleRetry()} disabled={disabled}>
              <RotateCcw aria-hidden="true" />
              Try again
            </Button>
            <Button type="button" variant="outline" onClick={handleRemove} disabled={disabled}>
              <X aria-hidden="true" />
              Remove
            </Button>
          </div>
        </div>
      )}

      {status === "empty" && !rejection && (
        <p className="text-muted-foreground text-xs">
          Attach a screenshot of your GCash or bank transfer.
          {import.meta.env.DEV
            ? " Optional in development mode."
            : " We need it to confirm your booking."}{" "}
          Large images are compressed before upload.
        </p>
      )}
    </div>
  );
}
