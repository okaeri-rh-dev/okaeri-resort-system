import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface LeaveWithoutSavingDialogProps {
  open: boolean;
  /** Says what is lost if the user leaves */
  description: string;
  /** Runs on Keep editing and on Escape */
  onKeepEditing: () => void;
  /** Must close the dialog: Leave does not close it */
  onLeave: () => void;
}

/**
 * Asks before a form with unsaved changes is left. Use it for long forms (DESIGN.md checklist 11).
 *
 * @example
 * <LeaveWithoutSavingDialog
 *   open={confirmingLeave}
 *   description="Your changes are not saved. If you leave now, they are lost."
 *   onKeepEditing={() => setConfirmingLeave(false)}
 *   onLeave={close}
 * />
 */
export function LeaveWithoutSavingDialog({
  open,
  description,
  onKeepEditing,
  onLeave,
}: LeaveWithoutSavingDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onKeepEditing()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              // The caller closes the dialog; a Radix close here would also run onKeepEditing
              event.preventDefault();
              onLeave();
            }}
          >
            Leave
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
