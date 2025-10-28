import { useCallback, useState } from "react";

import { AlertCircle, CheckCircle, FileImage, FileText, Loader2, Upload, X } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  compressImage,
  formatFileSize,
  validateFile,
  type FileValidationError,
} from "@/lib/file-validation-client";

export interface PaymentProofUploadProps {
  bookingReference: string; // For file path naming
  onUploadComplete: (filePath: string) => void;
  onUploadError?: (error: string) => void;
  disabled?: boolean;
}

/**
 * PaymentProofUpload Component
 *
 * Secure file upload component with:
 * - Drag-and-drop interface
 * - Magic number validation
 * - Client-side image compression
 * - Upload progress tracking
 * - Signed URL integration
 *
 * @param bookingReference - Temporary booking reference for file naming
 * @param onUploadComplete - Callback when upload succeeds (receives file_path)
 * @param onUploadError - Optional callback when upload fails
 * @param disabled - Disable upload while form is submitting
 */
export function PaymentProofUpload({
  bookingReference,
  onUploadComplete,
  onUploadError,
  disabled,
}: PaymentProofUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<FileValidationError | null>(null);
  const [compressionInfo, setCompressionInfo] = useState<{
    originalSize: number;
    compressedSize: number;
    ratio: number;
  } | null>(null);

  // Handle file selection (click or drag-and-drop)
  const handleFileSelect = useCallback(async (file: File) => {
    setError(null);
    setIsValidating(true);
    setCompressionInfo(null);

    try {
      // 1. Validate file (type, size, magic number)
      const validationError = await validateFile(file);
      if (validationError) {
        setError(validationError);
        setIsValidating(false);
        return;
      }

      // 2. Compress image if needed
      const result = await compressImage(file);

      if (result.wasCompressed) {
        setCompressionInfo({
          originalSize: result.originalSize,
          compressedSize: result.compressedSize,
          ratio: result.compressionRatio,
        });
      }

      // 3. Set file for upload
      setSelectedFile(result.file);
      setError(null);
    } catch (err) {
      console.error("[UPLOAD] File validation error:", err);
      setError({
        type: "VALIDATION_FAILED",
        message: "Failed to validate file. Please try again.",
        severity: "error",
      });
    } finally {
      setIsValidating(false);
    }
  }, []);

  // Handle file input change
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle drag-and-drop
  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const file = event.dataTransfer.files?.[0];
      if (file && !disabled) {
        handleFileSelect(file);
      }
    },
    [disabled, handleFileSelect]
  );

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  // Upload file to Supabase Storage
  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Step 1: Get signed upload URL from API
      const urlResponse = await fetch("/api/guest-booking/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_reference: bookingReference,
          file_name: selectedFile.name,
          file_type: selectedFile.type,
          file_size: selectedFile.size,
        }),
      });

      if (!urlResponse.ok) {
        throw new Error("Failed to get upload URL");
      }

      const urlData = (await urlResponse.json()) as {
        success: boolean;
        upload_url?: string;
        file_path?: string;
        error?: string;
      };

      if (!urlData.success) {
        throw new Error(urlData.error || "Upload URL generation failed");
      }

      const { upload_url, file_path } = urlData;

      if (!upload_url || !file_path) {
        throw new Error("Invalid response from upload URL endpoint");
      }

      // Step 2: Upload file to signed URL using XMLHttpRequest (for progress tracking)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const percentage = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percentage);
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("Upload failed"));
        });

        xhr.addEventListener("abort", () => {
          reject(new Error("Upload cancelled"));
        });

        xhr.open("PUT", upload_url);
        xhr.setRequestHeader("Content-Type", selectedFile.type);
        xhr.send(selectedFile);
      });

      // Step 3: Success - store file path
      setUploadedFilePath(file_path);
      onUploadComplete(file_path);
    } catch (err) {
      console.error("[UPLOAD] Upload error:", err);
      const errorMessage = err instanceof Error ? err.message : "Upload failed";
      setError({
        type: "VALIDATION_FAILED",
        message: errorMessage,
        severity: "error",
      });
      onUploadError?.(errorMessage);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Remove selected file
  const handleRemove = () => {
    setSelectedFile(null);
    setUploadedFilePath(null);
    setError(null);
    setCompressionInfo(null);
  };

  // Render uploaded file preview
  const renderPreview = () => {
    if (!uploadedFilePath) return null;

    const isImage = selectedFile?.type.startsWith("image/");

    return (
      <Card className="mt-4">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            {isImage ? (
              <FileImage className="h-8 w-8 text-green-600" />
            ) : (
              <FileText className="h-8 w-8 text-green-600" />
            )}
            <div>
              <p className="text-sm font-medium">{selectedFile?.name}</p>
              <p className="text-muted-foreground text-xs">
                {formatFileSize(selectedFile?.size || 0)}
                {compressionInfo && (
                  <span className="ml-2 text-green-600">
                    (Compressed by {compressionInfo.ratio.toFixed(0)}%)
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <Button variant="ghost" size="icon" onClick={handleRemove} disabled={disabled}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Upload Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {/* File uploaded - show preview */}
      {uploadedFilePath ? (
        renderPreview()
      ) : (
        <>
          {/* Drag-and-Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${disabled ? "cursor-not-allowed opacity-50" : "hover:border-primary cursor-pointer"} ${selectedFile ? "border-green-500 bg-green-50" : "border-gray-300"} `}
          >
            {isValidating ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="text-primary h-8 w-8 animate-spin" />
                <p className="text-muted-foreground text-sm">Validating file...</p>
              </div>
            ) : selectedFile ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2">
                  {selectedFile.type.startsWith("image/") ? (
                    <FileImage className="h-8 w-8 text-green-600" />
                  ) : (
                    <FileText className="h-8 w-8 text-green-600" />
                  )}
                  <div className="text-left">
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatFileSize(selectedFile.size)}
                      {compressionInfo && (
                        <span className="ml-2 text-green-600">
                          Compressed from {formatFileSize(compressionInfo.originalSize)}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {compressionInfo && (
                  <Alert>
                    <AlertDescription className="text-xs">
                      Image compressed by {compressionInfo.ratio.toFixed(0)}% for faster upload
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2">
                  <Button onClick={handleUpload} disabled={isUploading || disabled}>
                    {isUploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading... {uploadProgress}%
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleRemove}
                    disabled={isUploading || disabled}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                </div>

                {isUploading && <Progress value={uploadProgress} className="w-full" />}
              </div>
            ) : (
              <label htmlFor="file-input" className="cursor-pointer">
                <Upload className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <p className="mb-2 text-sm font-medium">
                  Drop payment proof here or click to browse
                </p>
                <p className="text-muted-foreground text-xs">JPEG, PNG, or PDF (max 5MB)</p>
                <input
                  id="file-input"
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={handleInputChange}
                  className="hidden"
                  disabled={disabled}
                />
              </label>
            )}
          </div>

          {/* Info Alert */}
          {!selectedFile && !error && (
            <Alert>
              <AlertDescription className="text-xs">
                Upload a screenshot or photo of your payment (bank transfer, GCash, etc.). Images
                are automatically compressed for faster upload.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  );
}
