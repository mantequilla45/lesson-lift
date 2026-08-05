"use client";

import { useMemo, useState } from "react";
import { fmtDate, nf } from "../format";
import {
  C,
  Card,
  CardFooter,
  EmptyState,
  FilterBar,
  Note,
  PageHead,
  Table,
  Tag,
  Td,
  Th,
  Tr,
  inputClass,
  inputStyle,
} from "../ui";

export interface PromoRow {
  id: string;
  code: string;
  offer: string;
  channel: string | null;
  redeemed: number;
  max_redemptions: number | null;
  expires_at: string | null;
  active: boolean;
  duration: string | null;
  applies_to_products: number;
  created_at: string;
}

/**
 * Read-only by design. Stripe validates codes at checkout, so Stripe is the
 * only place a code can meaningfully be created or changed — a code that
 * existed only here would be rejected the moment a teacher typed it. This page
 * reports what is actually live rather than keeping a second copy that drifts.
 */
export default function PromosView({
  rows,
  error,
}: {
  rows: PromoRow[];
  error: string | null;
}) {
  const [q, setQ] = useState("");
  const [state, setState] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((p) => {
      if (needle && !`${p.code} ${p.offer} ${p.channel ?? ""}`.toLowerCase().includes(needle)) {
        return false;
      }
      const expired = p.expires_at ? new Date(p.expires_at) < new Date() : false;
      if (state === "active" && (!p.active || expired)) return false;
      if (state === "inactive" && p.active && !expired) return false;
      return true;
    });
  }, [rows, q, state]);

  const totalRedeemed = rows.reduce((a, p) => a + Number(p.redeemed), 0);

  return (
    <>
      <PageHead
        title="Promo codes"
        sub="Every promotion code live in Stripe, with how many times each has been redeemed."
      />

      {error ? (
        <Note tone="danger">
          <b>Could not reach Stripe.</b> {error}
        </Note>
      ) : (
        <Note>
          Codes are created and edited <b>in Stripe</b>, which is what validates them at
          checkout. This page reads them live — there is no separate copy here to fall out of
          step. Set a <code>channel</code> key in a code&apos;s Stripe metadata to label where
          it&apos;s being used.
        </Note>
      )}

      <div className="mt-4">
        <Card>
          <FilterBar>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Code, offer or channel"
              className={inputClass}
              style={{ ...inputStyle, minWidth: 230 }}
            />
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className={inputClass}
              style={inputStyle}
            >
              <option value="">Any state</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive or expired</option>
            </select>
            <div className="flex-1" />
            <Tag>{nf.format(filtered.length)} shown</Tag>
          </FilterBar>

          {filtered.length === 0 ? (
            <EmptyState
              title={rows.length === 0 ? "No promotion codes in Stripe" : "Nothing matches that"}
              body={
                rows.length === 0
                  ? "Create a coupon and a promotion code in the Stripe dashboard and it will appear here. Checkout already accepts them — allow_promotion_codes is on."
                  : "Try clearing a filter."
              }
            />
          ) : (
            <Table>
              <thead>
                <tr className="text-left">
                  <Th>Code</Th>
                  <Th>Offer</Th>
                  <Th>Where it&apos;s used</Th>
                  <Th align="right">Redeemed</Th>
                  <Th>Expires</Th>
                  <Th>State</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const expired = p.expires_at ? new Date(p.expires_at) < new Date() : false;
                  const capped =
                    p.max_redemptions != null && p.redeemed >= p.max_redemptions;
                  return (
                    <Tr key={p.id}>
                      <Td>
                        <span
                          className="font-mono font-semibold text-xs"
                          style={{ color: C.ink }}
                        >
                          {p.code}
                        </span>
                      </Td>
                      <Td>
                        <span style={{ color: C.ink }}>{p.offer}</span>
                        {p.applies_to_products > 0 && (
                          <div className="text-xs" style={{ color: C.muted }}>
                            Limited to {p.applies_to_products} product
                            {p.applies_to_products === 1 ? "" : "s"}
                          </div>
                        )}
                      </Td>
                      <Td>
                        <span className="text-xs" style={{ color: C.ink2 }}>
                          {p.channel ?? (
                            <span style={{ color: C.muted }}>Not tagged</span>
                          )}
                        </span>
                      </Td>
                      <Td align="right" mono>
                        {nf.format(Number(p.redeemed))}
                        {p.max_redemptions != null && (
                          <span style={{ color: C.muted }}> / {nf.format(p.max_redemptions)}</span>
                        )}
                      </Td>
                      <Td>
                        <span className="text-xs">
                          {p.expires_at ? fmtDate(p.expires_at) : "—"}
                        </span>
                      </Td>
                      <Td>
                        {expired ? (
                          <Tag tone="plain" dot>
                            Expired
                          </Tag>
                        ) : capped ? (
                          <Tag tone="warn" dot>
                            Fully redeemed
                          </Tag>
                        ) : p.active ? (
                          <Tag tone="ok" dot>
                            Active
                          </Tag>
                        ) : (
                          <Tag tone="plain" dot>
                            Inactive
                          </Tag>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          )}

          <CardFooter>
            {rows.length > 0 && (
              <>
                {nf.format(rows.length)} code{rows.length === 1 ? "" : "s"} ·{" "}
                {nf.format(totalRedeemed)} total redemption
                {totalRedeemed === 1 ? "" : "s"} · read live from Stripe
              </>
            )}
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
