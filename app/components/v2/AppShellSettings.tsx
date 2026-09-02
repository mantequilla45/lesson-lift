"use client";

import { useAppShell, type AppShellSettings } from "@/app/components/v2/AppShellContext";

/**
 * Declares a page's chrome from a SERVER component.
 *
 * useAppShell() is a hook, so a server page cannot call it. Rendering this
 * instead puts the same call in a client component without turning the whole
 * page into one. It renders nothing.
 */
export default function AppShellSettingsDeclaration(props: AppShellSettings) {
  useAppShell(props);
  return null;
}
