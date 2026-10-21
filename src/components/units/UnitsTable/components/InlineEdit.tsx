import React, { useEffect, useRef, useState } from "react";

import { Check, Edit2, X } from "lucide-react";

import { Button, Input } from "@/components/patterns";
import { cn } from "@/lib/utils";

interface InlineEditProps {
  value: string | number;
  onSave: (value: string | number) => void;
  type?: "text" | "number";
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const readValueClasses =
  "group flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left transition-colors duration-150 hover:bg-muted focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none disabled:cursor-default disabled:hover:bg-transparent";

/**
 * Inline edit component for table cells
 * Allows in-place editing with keyboard shortcuts
 */
export const InlineEdit: React.FC<InlineEditProps> = ({
  value,
  onSave,
  type = "text",
  placeholder,
  className,
  disabled = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const handleSave = () => {
    const newValue = type === "number" ? parseFloat(editValue) : editValue;
    if (newValue !== value) {
      onSave(newValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value.toString());
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={cn("h-8", className)}
          placeholder={placeholder}
          onBlur={handleCancel}
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSave}
          className="h-8 w-8 p-0"
          onMouseDown={(e) => e.preventDefault()}
          aria-label="Save"
        >
          <Check className="text-success-foreground h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCancel}
          className="h-8 w-8 p-0"
          onMouseDown={(e) => e.preventDefault()}
          aria-label="Cancel"
        >
          <X className="text-danger-foreground h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(readValueClasses, className)}
      onClick={() => setIsEditing(true)}
    >
      <span>{value}</span>
      {!disabled && (
        <Edit2
          className="h-3 w-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden="true"
        />
      )}
    </button>
  );
};

interface InlineSelectProps<T extends string> {
  value: T;
  options: Array<{ value: T; label: string }>;
  onSave: (value: T) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Inline select component for dropdown editing in table cells
 */
export function InlineSelect<T extends string>({
  value,
  options,
  onSave,
  className,
  disabled = false,
}: InlineSelectProps<T>) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (isEditing) selectRef.current?.focus();
  }, [isEditing]);

  const handleSave = (newValue: T) => {
    if (newValue !== value) {
      onSave(newValue);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <select
        ref={selectRef}
        value={editValue}
        onChange={(e) => {
          const newValue = e.target.value as T;
          setEditValue(newValue);
          handleSave(newValue);
        }}
        onBlur={() => setIsEditing(false)}
        className={cn(
          "border-input bg-background focus-visible:ring-ring h-8 rounded border px-2 text-sm focus-visible:ring-2 focus-visible:outline-none",
          className
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  const currentOption = options.find((opt) => opt.value === value);

  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(readValueClasses, className)}
      onClick={() => setIsEditing(true)}
    >
      <span>{currentOption?.label || value}</span>
      {!disabled && (
        <Edit2
          className="h-3 w-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden="true"
        />
      )}
    </button>
  );
}
