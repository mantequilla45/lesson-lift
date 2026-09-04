import { redirect } from "next/navigation";
import { createClient } from "@/app/lib/auth/server";
import HelpView, { type MyThread } from "./HelpView";

// Same shape as the admin sections: a server component does the fetch, a client
// component does the rendering, and the row type is exported from the view.
export const dynamic = "force-dynamic";

export default async function HelpPage({
  searchParams,
}: {
  // ?thread= deep-links one conversation — used by the reply email and by the
  // launcher's "See all conversations". ?tab= picks the sub-branch.
  searchParams: Promise<{ thread?: string; tab?: string }>;
}) {
  const { thread, tab } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  // The proxy already gates this route; this is belt-and-braces so the RPC is
  // never called with no session.
  if (!user) redirect("/login");

  // Both in one round trip. The profile is only for prefilling the contact and
  // enquiry forms: we know who this is, so asking them to retype their name is
  // friction that buys nothing.
  const [{ data: threads }, { data: profile }] = await Promise.all([
    supabase.rpc("my_threads"),
    supabase.from("profiles").select("first_name, surname").eq("id", user.id).maybeSingle(),
  ]);

  const fullName = `${profile?.first_name ?? ""} ${profile?.surname ?? ""}`.trim();

  return (
    <HelpView
      initialThreads={(threads ?? []) as MyThread[]}
      initialOpenId={thread ?? null}
      initialTab={tab ?? null}
      knownName={fullName || null}
      knownEmail={user.email ?? null}
    />
  );
}
