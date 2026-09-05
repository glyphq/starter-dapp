"use client";

import { useEffect, useSyncExternalStore } from "react";

type Theme = "dark" | "light";
const STORAGE_KEY = "qubic-starter-theme";
const CHANGE_EVENT = "qubic-starter-theme-change";
let memoryTheme: Theme | null = null;

function readTheme(): Theme {
  if (memoryTheme) return memoryTheme;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* Storage is optional, including in private browsing. */
  }
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: light)");
  const onStorage = () => {
    memoryTheme = null;
    onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
    media.removeEventListener("change", onChange);
  };
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, (): Theme => "dark");
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  function toggleTheme() {
    memoryTheme = theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(STORAGE_KEY, memoryTheme);
    } catch {
      /* Keep the in-memory choice. */
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
  return { theme, toggleTheme };
}
