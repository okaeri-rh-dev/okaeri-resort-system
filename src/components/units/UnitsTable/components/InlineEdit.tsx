import React, { useState } from "react";

import { Check, Edit2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface InlineEditProps {
  value: string | number;
  onSave: (value: string | number) => void;
  type?: "text" | "number";
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

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
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={cn("h-8", className)}
          placeholder={placeholder}
          autoFocus
          onBlur={handleCancel}
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSave}
          className="h-8 w-8 p-0"
          onMouseDown={(e) => e.preventDefault()}
        >
          <Check className="h-4 w-4 text-green-600" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCancel}
          className="h-8 w-8 p-0"
          onMouseDown={(e) => e.preventDefault()}
        >
          <X className="h-4 w-4 text-red-600" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex items-center justify-between",
        !disabled && "cursor-pointer rounded px-2 py-1 hover:bg-gray-50",
        className
      )}
      onClick={() => !disabled && setIsEditing(true)}
    >
      <span>{value}</span>
      {!disabled && (
        <Edit2 className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </div>
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

  const handleSave = (newValue: T) => {
    if (newValue !== value) {
      onSave(newValue);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <select
        value={editValue}
        onChange={(e) => {
          const newValue = e.target.value as T;
          setEditValue(newValue);
          handleSave(newValue);
        }}
        onBlur={() => setIsEditing(false)}
        className={cn(
          "focus:ring-primary h-8 rounded border border-gray-300 px-2 text-sm focus:ring-2 focus:outline-none",
          className
        )}
        autoFocus
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
    <div
      className={cn(
        "group flex items-center justify-between",
        !disabled && "cursor-pointer rounded px-2 py-1 hover:bg-gray-50",
        className
      )}
      onClick={() => !disabled && setIsEditing(true)}
    >
      <span>{currentOption?.label || value}</span>
      {!disabled && (
        <Edit2 className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </div>
  );
}
