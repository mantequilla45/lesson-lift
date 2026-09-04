"use client";

// The general contact form.
//
// One component, two surfaces: the public /contact page and the Contact tab on
// /help. They differ only in whether the heading is drawn, because /help heads
// its own panel. A second copy for the signed-in case is a second place for the
// field list and the validation to drift, which is the mistake
// app/(app)/help/NewConversation.tsx documents in its header.
//
// When signed in, name and email are passed in and rendered read-only: we know
// them, and asking a teacher to retype what is already on their profile is
// friction that buys nothing.

import { useState } from "react";
import {
  HEARD_ABOUT_OPTIONS,
  HEARD_ABOUT_OTHER,
  isEmail,
  isPhone,
} from "@/app/lib/enquiry";
import { Field, Honeypot, INPUT_CLASS, INPUT_STYLE } from "./fields";
import { useEnquirySubmit } from "./useEnquirySubmit";
import Sent from "./Sent";

export default function ContactForm({
  heading = true,
  knownName,
  knownEmail,
}: {
  /** /help heads its own panel, so its built-in heading would be the second on
   *  the page. Default true for /contact, which has no other. */
  heading?: boolean;
  knownName?: string | null;
  knownEmail?: string | null;
}) {
  const [name, setName] = useState(knownName ?? "");
  const [email, setEmail] = useState(knownEmail ?? "");
  const [phone, setPhone] = useState("");
  const [heard, setHeard] = useState("");
  const [heardOther, setHeardOther] = useState("");
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState("");

  const { busy, error, reference, submit, reset } = useEnquirySubmit();

  // Locked rather than hidden: a teacher should be able to see which address
  // the reply is going to, even though they cannot change it here.
  const lockedName = Boolean(knownName);
  const lockedEmail = Boolean(knownEmail);

  const phoneOk = phone.trim() === "" || isPhone(phone);
  const ready =
    name.trim() !== "" && isEmail(email) && message.trim() !== "" && phoneOk;

  if (reference !== null) {
    return (
      <Sent
        reference={reference}
        email={email.trim()}
        onAgain={() => {
          // Keep who they are; clear what they said.
          setMessage("");
          setPhone("");
          setHeard("");
          setHeardOther("");
          reset();
        }}
      />
    );
  }

  return (
    <div className="max-w-xl">
      {heading && (
        <>
          <h3 className="text-xl font-medium mb-1">Contact us</h3>
          <p className="text-sm font-light mb-5" style={{ color: "var(--j-muted)" }}>
            Tell us what you need and we will get back to you, usually within a
            working day.
          </p>
        </>
      )}

      {error && (
        <p className="text-sm mb-3" role="alert" style={{ color: "#B3261E" }}>
          {error}
        </p>
      )}

      <Field label="Name" htmlFor="contact-name">
        <input
          id="contact-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          readOnly={lockedName}
          maxLength={120}
          autoComplete="name"
          placeholder="Priya Shah"
          className={`${INPUT_CLASS} ${lockedName ? "cursor-not-allowed" : ""}`}
          style={{
            ...INPUT_STYLE,
            ...(lockedName ? { backgroundColor: "var(--j-tint)" } : {}),
          }}
        />
      </Field>

      <Field label="Email" htmlFor="contact-email">
        <input
          id="contact-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          readOnly={lockedEmail}
          maxLength={200}
          autoComplete="email"
          placeholder="you@school.sch.uk"
          className={`${INPUT_CLASS} ${lockedEmail ? "cursor-not-allowed" : ""}`}
          style={{
            ...INPUT_STYLE,
            ...(lockedEmail ? { backgroundColor: "var(--j-tint)" } : {}),
          }}
        />
      </Field>

      <Field
        label="Phone number"
        htmlFor="contact-phone"
        optional
        hint={phone.trim() !== "" && !phoneOk ? "That does not look like a phone number." : undefined}
      >
        <input
          id="contact-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={40}
          autoComplete="tel"
          placeholder="020 7946 0958"
          className={INPUT_CLASS}
          style={INPUT_STYLE}
        />
      </Field>

      <Field label="Where did you hear about Jooma" htmlFor="contact-heard" optional>
        <select
          id="contact-heard"
          value={heard}
          onChange={(e) => setHeard(e.target.value)}
          className={INPUT_CLASS}
          style={INPUT_STYLE}
        >
          <option value="">Select an option</option>
          {HEARD_ABOUT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      {heard === HEARD_ABOUT_OTHER && (
        <Field label="Where did you hear about us" htmlFor="contact-heard-other">
          <input
            id="contact-heard-other"
            value={heardOther}
            onChange={(e) => setHeardOther(e.target.value)}
            maxLength={120}
            placeholder="A staffroom recommendation"
            className={INPUT_CLASS}
            style={INPUT_STYLE}
          />
        </Field>
      )}

      <Field label="Message" htmlFor="contact-message">
        <textarea
          id="contact-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={7}
          maxLength={5000}
          placeholder="What can we help you with?"
          className={`${INPUT_CLASS} resize-none`}
          style={INPUT_STYLE}
        />
      </Field>

      <Honeypot value={company} onChange={setCompany} />

      <button
        type="button"
        onClick={() =>
          void submit({
            kind: "contact",
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim(),
            heard_about: heard,
            heard_other: heard === HEARD_ABOUT_OTHER ? heardOther.trim() : "",
            message: message.trim(),
            company,
          })
        }
        disabled={busy || !ready}
        className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        style={{ backgroundColor: "var(--j-purple)" }}
      >
        {busy ? "Sending…" : "Send message"}
      </button>
    </div>
  );
}
