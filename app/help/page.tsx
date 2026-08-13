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
  // launcher's "See all conversations".
  searchParams: Promise<{ thread?: string }>;
}) {
  const { thread } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  // The proxy already gates this route; this is belt-and-braces so the RPC is
  // never called with no session.
  if (!user) redirect("/login");

  const { data: threads } = await supabase.rpc("my_threads");

  return (
    <HelpView
      initialThreads={(threads ?? []) as MyThread[]}
      initialOpenId={thread ?? null}
    />
  );
}
