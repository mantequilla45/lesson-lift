"use client";

// Client-side twin of publicSettings() (app/lib/settings.ts), for the signup
// and login pages. Those are client components — they own OAuth calls and form
// state — so the settings they obey have to be fetched after mount rather than
// passed down from a server component.
//
// Starts from the same permissive defaults as the server reader and for the
// same reason: until the answer arrives, or if it never does, the app behaves
// exactly as it did before these switches existed. The signup form is disabled
// only once the database has actually said signups are closed, so a slow
// network shows a working page rather than a wrongly locked one.
import { useEffect, useState } from "react";
import { createClient } from "@/app/lib/auth/client";

export interface PublicSettingsState {
  signupsOpen: boolean;
  googleSignin: boolean;
  /** False until the first read resolves — use it to hold back any UI whose
   *  wrong state would be misleading rather than merely early. */
  loaded: boolean;
}

export function usePublicSettings(): PublicSettingsState {
  const [state, setState] = useState<PublicSettingsState>({
    signupsOpen: true,
    googleSignin: true,
    loaded: false,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("public_settings");
      if (cancelled || error) return;

      const rows = (data ?? []) as { key: string; value: unknown }[];
      const read = (key: string) => {
        const row = rows.find((r) => r.key === key);
        return typeof row?.value === "boolean" ? row.value : true;
      };

      setState({
        signupsOpen: read("signups_open"),
        googleSignin: read("google_signin"),
        loaded: true,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
