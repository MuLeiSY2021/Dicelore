// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

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
