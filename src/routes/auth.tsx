import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — GUL Paper Management System" },
      { name: "description", content: "Sign in to GUL Paper Management System." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Enter a valid email").max(255);
const passwordSchema = z.string().min(6, "Password must be at least 6 characters").max(128);

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);


  async function onSignIn(e: React.FormEvent) {
    e.preventDefault();
    const em = emailSchema.safeParse(email);
    const pw = passwordSchema.safeParse(password);
    if (!em.success) return toast.error(em.error.issues[0].message);
    if (!pw.success) return toast.error(pw.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: em.data, password: pw.data });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Signed in");
    navigate({ to: "/", replace: true });
  }

  async function onForgot(e: React.FormEvent) {
    e.preventDefault();
    const em = emailSchema.safeParse(email);
    if (!em.success) return toast.error(em.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(em.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password reset email sent");
    setMode("signin");
  }


  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between bg-primary/5 p-10 border-r">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground font-display font-bold text-lg">G</div>
          <div>
            <div className="font-display text-lg font-semibold">GUL Paper</div>
            <div className="text-xs text-muted-foreground">Management System</div>
          </div>
        </div>
        <div>
          <h2 className="font-display text-3xl font-semibold leading-tight text-foreground">
            Run every purchase, sale and rupee from one dashboard.
          </h2>
          <p className="mt-3 text-muted-foreground max-w-md">
            Purchase, sales, banks, cash and expenses — automatic balances, clean reports, made for daily use.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">© {new Date().getFullYear()} GUL Paper</div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-6 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground font-display font-bold">G</div>
            <div className="font-display text-lg font-semibold">GUL Paper</div>
          </div>

          {mode === "signin" && (
            <form onSubmit={onSignIn} className="space-y-4" suppressHydrationWarning>
              <div>
                <h1 className="font-display text-2xl font-semibold">Sign in</h1>
                <p className="text-sm text-muted-foreground mt-1">Enter your credentials to continue.</p>
              </div>
              <div className="space-y-1.5" suppressHydrationWarning>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required suppressHydrationWarning />
              </div>
              <div className="space-y-1.5" suppressHydrationWarning>
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required suppressHydrationWarning />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </Button>
              <button
                type="button"
                onClick={() => setMode("forgot")}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Forgot password?
              </button>
              <p className="text-xs text-muted-foreground">
                Don't have an account? Ask an admin to invite you.
              </p>
            </form>
          )}

          {mode === "forgot" && (
            <form onSubmit={onForgot} className="space-y-4" suppressHydrationWarning>
              <div>
                <h1 className="font-display text-2xl font-semibold">Reset password</h1>
                <p className="text-sm text-muted-foreground mt-1">We'll email you a reset link.</p>
              </div>
              <div className="space-y-1.5" suppressHydrationWarning>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required suppressHydrationWarning />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending…" : "Send reset link"}
              </Button>
              <button type="button" onClick={() => setMode("signin")} className="text-xs text-muted-foreground hover:text-foreground">
                Back to sign in
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
