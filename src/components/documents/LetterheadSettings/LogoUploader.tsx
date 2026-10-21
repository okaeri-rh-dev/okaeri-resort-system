import { useCallback, useRef, useState } from "react";

import { ImagePlus, X } from "lucide-react";

import {
  LOGO_BASE64_MAX_BYTES,
  LOGO_COMPRESSED_MAX_BYTES,
  LOGO_MAX_SIZE_BYTES,
} from "@/components/documents/constants";
import { Button } from "@/components/patterns";

interface LogoUploaderProps {
  logo_base64?: string;
  onLogoChange: (base64: string | undefined) => void;
}

export function LogoUploader({ logo_base64, onLogoChange }: LogoUploaderProps) {
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setError(null);

      if (!file.type.startsWith("image/")) {
        setError("Please select an image file (PNG, JPG).");
        return;
      }

      if (file.size > LOGO_MAX_SIZE_BYTES) {
        setError("Image must be under 500KB.");
        return;
      }

      setIsProcessing(true);
      try {
        let imageToConvert = file;

        // Compress if over target size
        if (file.size > LOGO_COMPRESSED_MAX_BYTES) {
          const imageCompression = await import("browser-image-compression");
          imageToConvert = await imageCompression.default(file, {
            maxSizeMB: LOGO_COMPRESSED_MAX_BYTES / (1024 * 1024),
            maxWidthOrHeight: 400,
            useWebWorker: true,
          });
        }

        // Convert to base64
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          if (result.length > LOGO_BASE64_MAX_BYTES) {
            setError("Compressed image is still too large. Try a smaller image.");
            setIsProcessing(false);
            return;
          }
          onLogoChange(result);
          setIsProcessing(false);
        };
        reader.onerror = () => {
          setError("Failed to read image file.");
          setIsProcessing(false);
        };
        reader.readAsDataURL(imageToConvert);
      } catch {
        setError("Failed to process image.");
        setIsProcessing(false);
      }

      // Reset input so the same file can be re-selected
      if (inputRef.current) inputRef.current.value = "";
    },
    [onLogoChange]
  );

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Logo</p>

      {logo_base64 ? (
        <div className="flex items-center gap-3">
          <div
            data-theme="light"
            className="bg-card flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border"
          >
            <img
              src={logo_base64}
              alt="Logo preview"
              width={56}
              height={56}
              className="max-h-14 max-w-14 object-contain"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => onLogoChange(undefined)}
          >
            <X className="mr-1 h-4 w-4" />
            Remove
          </Button>
        </div>
      ) : (
        <button
          type="button"
          className="border-border text-muted-foreground hover:border-primary/50 hover:text-foreground flex h-20 w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed text-sm transition-colors"
          onClick={() => inputRef.current?.click()}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <span className="animate-pulse">Processing...</span>
          ) : (
            <>
              <ImagePlus className="h-5 w-5" />
              Upload Logo
            </>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {error && <p className="text-destructive text-xs">{error}</p>}
      <p className="text-muted-foreground text-xs">
        PNG or JPG, max 500KB. Will be compressed to ~200KB.
      </p>
    </div>
  );
}
