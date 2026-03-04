import { redirect } from "next/navigation";

import { SignInButton } from "@/components/auth-buttons";
import { auth } from "@/lib/auth";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/dashboard");
  }

  return (
    <div className="card stack" style={{ maxWidth: 440, margin: "60px auto" }}>
      <h1 style={{ margin: 0 }}>Time Tracking</h1>
      <p style={{ margin: 0 }}>Sign in with your invited Google account.</p>
      <SignInButton />
    </div>
  );
}
