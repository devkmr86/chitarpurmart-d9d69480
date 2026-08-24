import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset password — Mannu A2Z Mart" },
      {
        name: "description",
        content: "Set a new password for your Mannu A2Z Mart account.",
      },
      { property: "og:title", content: "Reset password — Mannu A2Z Mart" },
      { property: "og:description", content: "Choose a new password and get back to shopping." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setReady(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function save() {
    if (password.length < 6) { toast.error("Password kam se kam 6 characters ka ho"); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password update ho gaya");
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/10 to-background px-4">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-sm">
        <h1 className="font-display text-xl font-bold">Naya password set karein</h1>
        {ready ? (
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="np">New password</Label>
              <div className="relative">
                <Input
                  id="np"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <Button className="h-11 w-full" onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Save password"}
            </Button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Yeh link expire ho gaya hai ya invalid hai. Login page se dobara &quot;Forgot
            password?&quot; try karein.
          </p>
        )}
      </div>
    </div>
  );
}
