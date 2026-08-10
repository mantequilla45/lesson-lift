"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SEAT_BANDS, ONBOARD_FEE } from "@/app/lib/costs";
import { gbp, nf } from "../format";
import {
  AiChip,
  Btn,
  C,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  FilterBar,
  Meter,
  PageHead,
  Stat,
  StatusTag,
  Table,
  Tag,
  Td,
  Th,
  Tr,
  inputClass,
  inputStyle,
} from "../ui";
import { SeatLegend, SeatPool } from "./SeatPool";
import SchoolDrawer from "./SchoolDrawer";

export interface SchoolRow {
  id: string;
  name: string;
  urn: string | null;
  town: string | null;
  trust_name: string | null;
  status: string;
  seats: number;
  seats_assigned: number;
  seats_invited: number;
  seats_dormant: number;
  seats_free: number;
  rate: number;
  monthly_value: number;
  annual_value: number;
  resources_used: number;
  resources_pool: number;
  ai_used: number;
  ai_pool: number;
  cost_usd: number;
  onboarding_percent: number;
  renews_at: string | null;
  created_at: string;
}

export interface TrustRow {
  id: string;
  name: string;
  schools: number;
}

export default function SchoolsTable({
  rows,
  trusts,
}: {
  rows: SchoolRow[];
  trusts: TrustRow[];
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [trust, setTrust] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((s) => {
      if (needle) {
        const hay = `${s.name} ${s.urn ?? ""} ${s.town ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (status && s.status !== status) return false;
      if (trust === "standalone" && s.trust_name) return false;
      if (trust && trust !== "standalone" && s.trust_name !== trust) return false;
      return true;
    });
  }, [rows, q, status, trust]);

  const totals = useMemo(
    () => ({
      seats: rows.reduce((a, s) => a + s.seats, 0),
      assigned: rows.reduce((a, s) => a + Number(s.seats_assigned) + Number(s.seats_dormant), 0),
      value: rows.reduce((a, s) => a + Number(s.monthly_value), 0),
      live: rows.filter((s) => s.status === "live").length,
    }),
    [rows],
  );

  const idle = totals.seats - totals.assigned;

  return (
    <>
      <PageHead
        title="Schools"
        sub="Seat pools, invoices and onboarding progress for every institution."
      >
        <Link href="/admin/onboard">
          <Btn variant="primary">+ Onboard a school</Btn>
        </Link>
      </PageHead>

      {rows.length > 0 && (
        <div className="grid gap-3.5 mb-6 grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Schools"
            value={nf.format(rows.length)}
            foot={`${totals.live} live · ${rows.length - totals.live} not yet`}
          />
          <Stat label="Seats sold" value={nf.format(totals.seats)} foot={`across ${rows.length} schools`} />
          <Stat
            label="Seats assigned"
            value={nf.format(totals.assigned)}
            foot={
              totals.seats
                ? `${Math.round((totals.assigned / totals.seats) * 100)}% used · ${nf.format(idle)} idle`
                : "—"
            }
          />
          <Stat
            label="B2B monthly value"
            value={gbp(totals.value)}
            foot="Invoiced annually in advance"
          />
        </div>
      )}

      <Card>
        <FilterBar>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="School name, URN or town"
            className={inputClass}
            style={{ ...inputStyle, minWidth: 230 }}
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={inputClass}
            style={inputStyle}
          >
            <option value="">Any status</option>
            <option value="live">Live</option>
            <option value="onboarding">Onboarding</option>
            <option value="pending">Not started</option>
            <option value="paused">Paused</option>
          </select>
          <select
            value={trust}
            onChange={(e) => setTrust(e.target.value)}
            className={inputClass}
            style={inputStyle}
          >
            <option value="">Any trust</option>
            <option value="standalone">Standalone</option>
            {trusts.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name} ({nf.format(t.schools)})
              </option>
            ))}
          </select>
          <div className="flex-1" />
          <Tag>{nf.format(filtered.length)} shown</Tag>
        </FilterBar>

        {filtered.length === 0 ? (
          <EmptyState
            title={rows.length === 0 ? "No schools yet" : "No schools match that"}
            body={
              rows.length === 0
                ? "Onboard your first school to start selling seats. The wizard sets up the seat pool, billing terms and invites in six steps."
                : "Try clearing a filter."
            }
            action={
              rows.length === 0 ? (
                <Link href="/admin/onboard">
                  <Btn variant="primary">Onboard a school</Btn>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <thead>
              <tr className="text-left">
                <Th>School</Th>
                <Th>Seat pool</Th>
                <Th align="right">Assigned</Th>
                <Th>Band</Th>
                <Th>Resource pool</Th>
                <Th>AI images</Th>
                <Th align="right">Per year</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <Tr key={s.id} clickable onClick={() => setOpenId(s.id)}>
                  <Td>
                    <div className="font-semibold" style={{ color: C.ink }}>
                      {s.name}
                    </div>
                    <div className="text-xs" style={{ color: C.muted }}>
                      {[s.town, s.urn && `URN ${s.urn}`, s.trust_name]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </div>
                  </Td>
                  <Td>
                    <SeatPool
                      assigned={Number(s.seats_assigned)}
                      invited={Number(s.seats_invited)}
                      dormant={Number(s.seats_dormant)}
                      free={Number(s.seats_free)}
                    />
                  </Td>
                  <Td align="right">
                    <span className="tabular-nums" style={{ color: C.ink }}>
                      {nf.format(Number(s.seats_assigned) + Number(s.seats_dormant))}/
                      {nf.format(s.seats)}
                    </span>
                    {Number(s.seats_free) > 0 && (
                      <div className="text-xs" style={{ color: C.warn }}>
                        {nf.format(Number(s.seats_free))} free
                      </div>
                    )}
                  </Td>
                  <Td>
                    <Tag tone="brand">{gbp(Number(s.rate))}</Tag>
                  </Td>
                  <Td>
                    <Meter
                      used={Number(s.resources_used)}
                      allow={s.resources_pool}
                      compact
                    />
                    <div className="text-[11px] tabular-nums mt-1" style={{ color: C.muted }}>
                      {nf.format(Number(s.resources_used))} / {nf.format(s.resources_pool)}
                    </div>
                  </Td>
                  <Td>
                    <AiChip used={Number(s.ai_used)} allow={s.ai_pool} />
                  </Td>
                  <Td align="right">
                    <span className="tabular-nums font-semibold" style={{ color: C.ink }}>
                      {gbp(Number(s.annual_value))}
                    </span>
                  </Td>
                  <Td>
                    <StatusTag status={s.status} />
                    {s.onboarding_percent < 100 && (
                      <div className="text-xs mt-1" style={{ color: C.muted }}>
                        {s.onboarding_percent}% set up
                      </div>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <div className="grid gap-3.5 mt-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Seat legend</CardTitle>
          </CardHeader>
          <CardBody>
            <SeatLegend />
            <p className="text-xs mt-3" style={{ color: C.muted }}>
              Dormant and unassigned seats are your renewal risk. Chase them before the
              invoice, not after.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Seat price ladder</CardTitle>
          </CardHeader>
          <Table>
            <thead>
              <tr className="text-left">
                <Th>Seats</Th>
                <Th align="right">Per seat / mo</Th>
                <Th align="right">Per seat / yr</Th>
                <Th align="right">Example</Th>
              </tr>
            </thead>
            <tbody>
              {SEAT_BANDS.map((b) => (
                <Tr key={b.band}>
                  <Td>
                    <span className="font-medium" style={{ color: C.ink }}>
                      {b.band}
                    </span>
                  </Td>
                  <Td align="right" mono>
                    {gbp(b.rate)}
                  </Td>
                  <Td align="right" mono>
                    {gbp(b.rate * 12)}
                  </Td>
                  <Td align="right">
                    <span className="tabular-nums" style={{ color: C.ink2 }}>
                      {b.min} seats = {gbp(b.rate * 12 * b.min)}
                    </span>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <div
            className="px-4 py-3 border-t text-xs"
            style={{ borderColor: C.divider, color: C.ink2 }}
          >
            Plus a one-off {gbp(ONBOARD_FEE)} onboarding and training package, waived on
            two-year deals. Crossing a band re-prices every seat, not just the new ones.
          </div>
        </Card>
      </div>

      {openId && <SchoolDrawer schoolId={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
