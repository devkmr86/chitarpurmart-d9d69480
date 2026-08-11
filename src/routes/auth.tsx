import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Phone } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { phoneToEmail, isValidPhone, normalizePhone } from "@/lib/mannu";

const searchSchema = z.object({ next: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — Mannu A2Z Mart" },
      {
        name: "description",
        content: "Login or create your Mannu A2Z Mart account with your phone number.",
      },
      { property: "og:title", content: "Sign in — Mannu A2Z Mart" },
      { property: "og:description", content: "Phone number login for Mannu A2Z Mart." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const search = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  async function done() {
    await router.invalidate();
    const next = search.next && search.next.startsWith("/") ? search.next : "/";
    navigate({ to: next, replace: true });
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidPhone(phone)) { toast.error("Enter a valid 10-digit mobile number"); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: phoneToEmail(phone),
      password,
    });
    setLoading(false);
    if (error) { toast.error("Wrong phone number or password"); return; }
    toast.success("Welcome back!");
    void done();
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidPhone(phone)) { toast.error("Enter a valid 10-digit mobile number"); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: phoneToEmail(phone),
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { phone: normalizePhone(phone), full_name: name.trim() },
      },
    });
    setLoading(false);
    if (error) {
      { toast.error(
        error.message.includes("already")
          ? "This number is already registered. Please log in."
          : error.message,
      ); return; }
    }
    toast.success("Account created!");
    void done();
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-gradient-to-b from-primary/10 to-background px-4 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-primary text-2xl shadow-lg">
            🛒
          </div>
          <h1 className="font-display text-2xl font-extrabold">Mannu A2Z Mart</h1>
          <p className="text-sm text-muted-foreground">Sab kuch, ek app mein.</p>
        </div>

        <Tabs defaultValue="login" className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Register</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4 pt-4">
              <PhoneField phone={phone} setPhone={setPhone} />
              <div className="space-y-1.5">
                <Label htmlFor="pw">Password</Label>
                <Input
                  id="pw"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <Button type="submit" className="h-11 w-full" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : "Login"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="nm">Full name</Label>
                <Input
                  id="nm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Suraj Kumar"
                  required
                />
              </div>
              <PhoneField phone={phone} setPhone={setPhone} />
              <div className="space-y-1.5">
                <Label htmlFor="pw2">Create password</Label>
                <Input
                  id="pw2"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  required
                />
              </div>
              <Button type="submit" className="h-11 w-full" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : "Create account"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Registering creates a customer account. You can apply to become a seller or
                delivery partner from your profile.
              </p>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function PhoneField({ phone, setPhone }: { phone: string; setPhone: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="ph">Mobile number</Label>
      <div className="relative">
        <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="ph"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder="9876543210"
          className="pl-9"
          required
        />
      </div>
    </div>
  );
}
