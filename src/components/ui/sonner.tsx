import { Toaster as Sonner } from "sonner";

import { useUIStore } from "@/stores/useUIStore";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useUIStore((state) => state.theme);

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      mobileOffset={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 72px)" }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-popover",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
