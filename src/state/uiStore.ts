import { create } from "zustand";

type Theme = "light" | "dark";
type Prefs = { theme: Theme; rulers: boolean; pixelGrid: boolean };

const KEY = "blendy.ui";

function load(): Prefs {
  const fallback: Prefs = {
    theme: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    rulers: true,
    pixelGrid: false,
  };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Prefs>;
    return {
      theme: saved.theme === "dark" || saved.theme === "light" ? saved.theme : fallback.theme,
      rulers: typeof saved.rulers === "boolean" ? saved.rulers : fallback.rulers,
      pixelGrid: typeof saved.pixelGrid === "boolean" ? saved.pixelGrid : fallback.pixelGrid,
    };
  } catch {
    return fallback;
  }
}

type Ui = Prefs & { toggle: (key: keyof Omit<Prefs, "theme">) => void; toggleTheme: () => void };

/** View preferences: per-browser, never part of the document or its history. */
export const useUi = create<Ui>((set) => ({
  ...load(),
  toggle: (key) => set((s) => ({ [key]: !s[key] })),
  toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
}));

const apply = ({ theme }: Prefs) => {
  document.documentElement.dataset.theme = theme;
};
apply(useUi.getState());
useUi.subscribe((s) => {
  apply(s);
  try {
    localStorage.setItem(KEY, JSON.stringify({ theme: s.theme, rulers: s.rulers, pixelGrid: s.pixelGrid }));
  } catch {
    /* storage unavailable: prefs last for the session */
  }
});
