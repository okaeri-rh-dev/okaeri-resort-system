import { useEffect, useRef, type ReactNode } from "react";

import { X } from "lucide-react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ModalWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  closeOnOutsideClick?: boolean;
  closeOnEscape?: boolean;
  className?: string;
}

/**
 * Reusable modal wrapper with proper cleanup and accessibility
 * Handles escape key, outside clicks, and scroll locking
 */
export function ModalWrapper({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  closeOnOutsideClick: _closeOnOutsideClick = true,
  closeOnEscape = true,
  className,
}: ModalWrapperProps) {
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Store the previously focused element and restore it on close
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
    } else if (previousActiveElement.current) {
      previousActiveElement.current.focus();
      previousActiveElement.current = null;
    }
  }, [isOpen]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = "hidden";

      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose, closeOnEscape]);

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-[90vw]",
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn(sizeClasses[size], className)}>
        <ErrorBoundary
          level="component"
          fallback={
            <div className="p-4 text-red-600">
              An error occurred in the modal content.
              <button onClick={onClose} className="ml-4 underline">
                Close
              </button>
            </div>
          }
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>

          <div className="py-4">{children}</div>

          {footer && <DialogFooter>{footer}</DialogFooter>}
        </ErrorBoundary>
      </DialogContent>
    </Dialog>
  );
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  isLoading?: boolean;
}

/**
 * Confirmation modal for destructive actions
 */
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  isLoading = false,
}: ConfirmModalProps) {
  const handleConfirm = async () => {
    await onConfirm();
    onClose();
  };

  const confirmButtonClass =
    variant === "destructive"
      ? "bg-red-600 text-white hover:bg-red-700"
      : "bg-primary text-white hover:bg-primary/90";

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="rounded bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className={cn(
              "rounded px-4 py-2 transition-colors disabled:opacity-50",
              confirmButtonClass
            )}
          >
            {isLoading ? "Processing..." : confirmText}
          </button>
        </div>
      }
    >
      <p className="text-gray-600">{message}</p>
    </ModalWrapper>
  );
}

interface DrawerWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  position?: "left" | "right";
  size?: "sm" | "md" | "lg";
}

/**
 * Drawer component for side panels
 */
export function DrawerWrapper({
  isOpen,
  onClose,
  title,
  children,
  position = "right",
  size = "md",
}: DrawerWrapperProps) {
  const sizeClasses = {
    sm: "w-80",
    md: "w-96",
    lg: "w-[480px]",
  };

  const positionClasses = {
    left: "left-0",
    right: "right-0",
  };

  const translateClasses = {
    left: isOpen ? "translate-x-0" : "-translate-x-full",
    right: isOpen ? "translate-x-0" : "translate-x-full",
  };

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <ErrorBoundary level="component">
      <div className="fixed inset-0 z-50">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50 transition-opacity" onClick={onClose} />

        {/* Drawer */}
        <div
          className={cn(
            "fixed top-0 bottom-0 bg-white shadow-xl transition-transform duration-300",
            sizeClasses[size],
            positionClasses[position],
            translateClasses[position]
          )}
        >
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button onClick={onClose} className="rounded p-1 transition-colors hover:bg-gray-100">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="h-[calc(100%-64px)] overflow-y-auto p-4">{children}</div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
