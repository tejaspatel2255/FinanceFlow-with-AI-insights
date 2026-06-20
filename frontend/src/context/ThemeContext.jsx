import { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

const ThemeContext = createContext({
  theme: "original",
  setTheme: () => {},
  mode: "light",
  setMode: () => {},
  toggleMode: () => {},
});

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem("financeflow-theme") || "original";
  });
  const [mode, setModeState] = useState(() => {
    return (
      localStorage.getItem("financeflow-mode") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    );
  });

  const debounceTimeoutRef = useRef(null);

  // Sync state to local storage and document element
  useEffect(() => {
    localStorage.setItem("financeflow-theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("financeflow-mode", mode);
    if (mode === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [mode]);

  // Fetch settings from Supabase when user logs in
  useEffect(() => {
    if (!user) return;

    const fetchUserSettings = async () => {
      try {
        const { data, error } = await supabase
          .from("user_settings")
          .select("theme_preference, mode_preference")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setThemeState(data.theme_preference);
          setModeState(data.mode_preference);
        }
      } catch (err) {
        console.error("Failed to load user settings from database:", err);
      }
    };

    fetchUserSettings();
  }, [user]);

  // Debounced save to Supabase
  const savePreferencesToDb = (newTheme, newMode) => {
    if (!user) return;

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(async () => {
      try {
        const { error } = await supabase.from("user_settings").upsert({
          user_id: user.id,
          theme_preference: newTheme,
          mode_preference: newMode,
        });

        if (error) throw error;
      } catch (err) {
        console.error("Failed to save theme preferences to Supabase:", err);
      }
    }, 800); // 800ms debounce
  };

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
    savePreferencesToDb(newTheme, mode);
  };

  const setMode = (newMode) => {
    setModeState(newMode);
    savePreferencesToDb(theme, newMode);
  };

  const toggleMode = () => {
    const nextMode = mode === "light" ? "dark" : "light";
    setModeState(nextMode);
    savePreferencesToDb(theme, nextMode);
  };

  const value = {
    theme,
    setTheme,
    mode,
    setMode,
    toggleMode,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
