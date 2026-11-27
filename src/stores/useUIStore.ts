import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface UIStore {
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;
}

export const useUIStore = create<UIStore>()(
  devtools(
    (set) => ({
      theme: "system",

      setTheme: (theme) => {
        set({ theme });

        const root = window.document.documentElement;
        root.classList.remove("light", "dark");

        if (theme === "system") {
          const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
          root.classList.add(systemTheme);
        } else {
          root.classList.add(theme);
        }

        localStorage.setItem("theme", theme);
      },
    }),
    {
      name: "UIStore",
    }
  )
);

// Initialize theme on app start; index.html has already applied the class before first paint
export const initializeTheme = () => {
  const savedTheme = localStorage.getItem("theme") as "light" | "dark" | "system" | null;
  useUIStore.getState().setTheme(savedTheme || "system");

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (useUIStore.getState().theme === "system") useUIStore.getState().setTheme("system");
  });
};
