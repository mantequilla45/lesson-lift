import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/auth/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { PASSWORD_REQUIREMENTS_MESSAGE, isValidPassword } from "@/app/lib/password";

// Creates a teacher account from the admin panel without touching the calling
// admin's own session. The self-serve signup flow uses
// supabase.auth.signUp(), which signs the CURRENT browser in as the new
// user — calling that here would log the admin out and into the new
// teacher's account. auth.admin.createUser() (service role, server-only)
// creates the user directly instead, and the email is pre-confirmed since
// the admin is setting the password themselves rather than sending an invite
// link.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: caller } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!caller?.is_admin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "";
  const surname = typeof body?.surname === "string" ? body.surname.trim() : "";
  const dialCode = typeof body?.dialCode === "string" ? body.dialCode : null;
  const phone = typeof body?.phone === "string" ? body.phone.trim() : null;

  if (!email || !password || !firstName || !surname) {
    return NextResponse.json(
      { error: "Email, password, first name and surname are required." },
      { status: 400 },
    );
  }
  if (!isValidPassword(password)) {
    return NextResponse.json({ error: PASSWORD_REQUIREMENTS_MESSAGE }, { status: 400 });
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    const msg = createError?.message ?? "";
    const friendly = /already|registered|exists/i.test(msg)
      ? "An account with this email already exists."
      : "Could not create the account. Please try again.";
    return NextResponse.json({ error: friendly }, { status: 400 });
  }

  const { error: profileError } = await supabaseAdmin.from("profiles").insert({
    id: created.user.id,
    first_name: firstName,
    surname,
    dial_code: dialCode,
    phone,
    country: dialCode,
  });
  if (profileError) {
    // Auth user now exists without a profile row — remove it so a retry with
    // the same email doesn't collide with a half-created account.
    await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: "Could not save the teacher's profile. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ id: created.user.id });
}
