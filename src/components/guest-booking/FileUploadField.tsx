import React, { useCallback, useState } from "react";

import { AlertCircle, FileText, Image, Upload, X } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileUploadFieldProps {
  onChange: (file: File | null) => void;
  value?: File | null;
  disabled?: boolean;
  accept?: string;
  maxSize?: number;
  name?: string;
  required?: boolean;
}

export function FileUploadField({
  onChange,
  value,
  disabled = false,
  accept = "image/*,application/pdf",
  maxSize = 2 * 1024 * 1024, // 2MB default
  name,
  required = false,
}: FileUploadFieldProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const validateFile = (file: File): boolean => {
    setError(null);

    // Check file size
    if (file.size > maxSize) {
      setError(`File is too large. Maximum size is ${formatFileSize(maxSize)}`);
      return false;
    }

    // Check file type
    const acceptedTypes = accept.split(",").flatMap((type) => {
      if (type === "image/*") {
        return ["image/jpeg", "image/png", "image/jpg", "image/webp"];
      } else if (type === "application/pdf") {
        return ["application/pdf"];
      }
      return [type.trim()];
    });

    if (
      !acceptedTypes.some((type) => file.type === type || file.name.endsWith(type.split("/")[1]))
    ) {
      setError("Invalid file type. Please upload a JPG, PNG, or PDF file.");
      return false;
    }

    return true;
  };

  const handleFileChange = useCallback(
    (file: File | null) => {
      if (file) {
        if (!validateFile(file)) {
          return;
        }

        onChange(file);

        // Generate preview for images
        if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setPreview(reader.result as string);
          };
          reader.readAsDataURL(file);
        } else {
          setPreview(null);
        }
      } else {
        onChange(null);
        setPreview(null);
        setError(null);
      }
    },
    [onChange, maxSize]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragActive(false);

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileChange(files[0]);
      }
    },
    [handleFileChange, disabled]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragActive(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileChange(files[0]);
    }
  };

  const removeFile = () => {
    handleFileChange(null);
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) {
      return <Image className="h-8 w-8" />;
    }
    return <FileText className="h-8 w-8" />;
  };

  return (
    <div className="space-y-4">
      {value ? (
        <div className="rounded-lg border p-4">
          <div className="flex items-start gap-4">
            {preview ? (
              <img src={preview} alt="Preview" className="h-20 w-20 rounded object-cover" />
            ) : (
              <div className="bg-muted flex h-20 w-20 items-center justify-center rounded">
                {getFileIcon(value)}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{value.name}</p>
              <p className="text-muted-foreground text-xs">{formatFileSize(value.size)}</p>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={removeFile}
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            "cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors",
            isDragActive && "border-primary bg-primary/5",
            disabled && "cursor-not-allowed opacity-50",
            error && "border-destructive"
          )}
        >
          <input
            type="file"
            id={name}
            name={name}
            accept={accept}
            onChange={handleInputChange}
            disabled={disabled}
            required={required}
            className="sr-only"
          />

          <label htmlFor={name} className={cn("cursor-pointer", disabled && "cursor-not-allowed")}>
            <Upload className="text-muted-foreground mx-auto mb-4 h-12 w-12" />

            <p className="mb-1 text-sm font-medium">
              {isDragActive
                ? "Drop the file here"
                : "Drag & drop your file here, or click to browse"}
            </p>

            <p className="text-muted-foreground text-xs">
              JPG, PNG or PDF up to {formatFileSize(maxSize)}
            </p>
          </label>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
