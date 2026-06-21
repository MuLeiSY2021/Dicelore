import {
  Home, Dices, Hammer, Settings, BookOpen, Scale, ScrollText,
  MessagesSquare, LayoutGrid, Pin, Timer, Eye, Languages, Moon, Sun, Palette,
  type LucideIcon,
} from "lucide-react";

export type IconName =
  | "home" | "dices" | "hammer" | "settings"
  | "book-open" | "scale" | "scroll-text" | "messages-square"
  | "layout-grid" | "pin" | "timer" | "eye"
  | "languages" | "moon" | "sun" | "palette";

export const ICONS: Record<IconName, LucideIcon> = {
  home: Home,
  dices: Dices,
  hammer: Hammer,
  settings: Settings,
  "book-open": BookOpen,
  scale: Scale,
  "scroll-text": ScrollText,
  "messages-square": MessagesSquare,
  "layout-grid": LayoutGrid,
  pin: Pin,
  timer: Timer,
  eye: Eye,
  languages: Languages,
  moon: Moon,
  sun: Sun,
  palette: Palette,
};
