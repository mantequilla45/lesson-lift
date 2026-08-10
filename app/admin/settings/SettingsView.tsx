"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/auth/client";
import {
  C,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Note,
  PageHead,
  Toggle,
  ToggleRow,
  inputClass,
  inputStyle,
  useToast,
} from "../ui";

export interface SettingRow {
  key: string;
  label: string;
  description: string | null;
  section: string;
  /** jsonb — boolean for switches, number for limits. */
  value: boolean | number | string;
  sort: number;
}

const SECTION_TITLE: Record<string, string> = {
  access: "Access",
  fair_use: "Fair use and abuse",
  general: "General",
};

export default function SettingsView({ rows }: { rows: SettingRow[] }) {
  const router = useRouter();
  const [toastNode, fire] = useToast();
  const [pending, setPending] = useState<Record<string, number>>({});

  const sections = useMemo(() => {
    const map = new Map<string, SettingRow[]>();
    for (const r of rows) {
      if (!map.has(r.section)) map.set(r.section, []);
      map.get(r.section)!.push(r);
    }
    return [...map.entries()];
  }, [rows]);

  const save = async (key: string, value: boolean | number, label: string) => {
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_set_setting", {
      p_key: key,
      p_value: value,
    });
    if (error) {
      fire(error.message);
      return;
    }
    fire(`${label} updated.`);
    router.refresh();
  };

  return (
    <>
      <PageHead
        title="Settings"
        sub="System-wide switches. Most of these you'll set once and forget."
      />

      <div className="mb-4">
        <Note tone="warn">
          These are recorded and shown here, but most are <b>not yet read</b> by the app —
          wiring each one to the behaviour it describes is separate work. Signup, maintenance
          mode and sign-in providers are configured in Supabase Auth today.
        </Note>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-2">
        {sections.map(([section, items]) => (
          <Card key={section}>
            <CardHeader>
              <CardTitle>{SECTION_TITLE[section] ?? section}</CardTitle>
            </CardHeader>
            <CardBody>
              {items.map((s) => {
                const isNumber = typeof s.value === "number";
                return (
                  <ToggleRow key={s.key} title={s.label} desc={s.description ?? undefined}>
                    {isNumber ? (
                      <input
                        type="number"
                        defaultValue={Number(s.value)}
                        onChange={(e) =>
                          setPending((p) => ({ ...p, [s.key]: Number(e.target.value) }))
                        }
                        onBlur={() => {
                          const next = pending[s.key];
                          if (next !== undefined && next !== Number(s.value)) {
                            save(s.key, next, s.label);
                          }
                        }}
                        className={inputClass}
                        style={{ ...inputStyle, width: 90 }}
                      />
                    ) : (
                      <Toggle
                        on={Boolean(s.value)}
                        onChange={(next) => save(s.key, next, s.label)}
                        label={s.label}
                      />
                    )}
                  </ToggleRow>
                );
              })}
            </CardBody>
          </Card>
        ))}

        <Card>
          <CardHeader>
            <CardTitle>Data protection</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="text-sm space-y-1.5">
              {[
                ["Hosting", "Supabase, EU (eu-central-1)"],
                ["Model providers", "OpenAI · Anthropic"],
                ["Prompts stored", "In tool_runs, indefinitely"],
                ["Cost telemetry", "token_usage, asset_cost, slide_cost"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <span style={{ color: C.muted }}>{k}</span>
                  <span className="text-right" style={{ color: C.ink }}>
                    {v}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <Note>
                Retention and deletion policies aren&apos;t implemented yet — prompts and
                generations are kept indefinitely. Worth settling before a school&apos;s data
                protection officer asks.
              </Note>
            </div>
          </CardBody>
        </Card>
      </div>

      {toastNode}
    </>
  );
}
