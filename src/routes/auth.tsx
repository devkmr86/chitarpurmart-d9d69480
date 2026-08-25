import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Phone } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { phoneToEmail, isValidPhone, normalizePhone } from "@/lib/mannu";

const searchSchema = z.object({ next: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — Mannu A2Z Mart" },
      {
        name: "description",
        content: "Login or create your Mannu A2Z Mart account with Google, phone number or email.",
      },
      { property: "og:title", content: "Sign in — Mannu A2Z Mart" },
      { property: "og:description", content: "Google, phone or email login for Mannu A2Z Mart." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

/** Accepts a 10-digit mobile number or a real email address. */
function toLoginEmail(identifier: string) {
  const id = identifier.trim();
  if (id.includes("@")) return id.toLowerCase();
  return phoneToEmail(id);
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const search = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  async function done() {
    await router.invalidate();
    const next = search.next && search.next.startsWith("/") ? search.next : "/";
    navigate({ to: next, replace: true });
  }

  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
      extraParams: { prompt: "select_account" },
    });
    setLoading(false);
    if (result.error) { toast.error("Google sign-in fail hua, dobara try karein"); return; }
    if (!("redirected" in result && result.redirected)) {
      toast.success("Welcome!");
      void done();
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const id = identifier.trim();
    if (!isEmail(id) && !isValidPhone(id)) {
      toast.error("10-digit mobile number ya email daalein");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: toLoginEmail(id),
      password,
    });
    setLoading(false);
    if (error) { toast.error("Galat number/email ya password"); return; }
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
      toast.error(
        error.message.includes("already")
          ? "This number is already registered. Please log in."
          : error.message,
      );
      return;
    }
    toast.success("Account created!");
    void done();
  }

  async function handleOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!isEmail(otpEmail)) { toast.error("Sahi email address daalein"); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: otpEmail.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setOtpSent(true);
    toast.success("Login link aapke email par bhej diya gaya hai");
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

        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full gap-2 font-semibold"
            onClick={() => void handleGoogle()}
            disabled={loading}
          >
            <GoogleIcon /> Continue with Google
          </Button>
          <div className="my-4 flex items-center gap-3 text-[11px] uppercase text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> ya <span className="h-px flex-1 bg-border" />
          </div>

          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Register</TabsTrigger>
              <TabsTrigger value="otp">OTP</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ident">Mobile number or email</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="ident"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="9876543210 / you@email.com"
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
                <PasswordField id="pw" label="Password" value={password} onChange={setPassword} />
                <Button type="submit" className="h-11 w-full" disabled={loading}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : "Login"}
                </Button>
                <ForgotPassword />
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
                <PasswordField
                  id="pw2"
                  label="Create password"
                  value={password}
                  onChange={setPassword}
                  placeholder="Min 6 characters"
                />
                <Button type="submit" className="h-11 w-full" disabled={loading}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : "Create account"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Registering creates a customer account. You can apply to become a seller or
                  delivery partner from your profile.
                </p>
              </form>
            </TabsContent>

            <TabsContent value="otp">
              <form onSubmit={handleOtp} className="space-y-4 pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="otpmail">Email address</Label>
                  <Input
                    id="otpmail"
                    type="email"
                    value={otpEmail}
                    onChange={(e) => setOtpEmail(e.target.value)}
                    placeholder="you@email.com"
                    required
                  />
                </div>
                <Button type="submit" className="h-11 w-full" disabled={loading}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : "Send login link"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  {otpSent
                    ? "Email kholein aur link par tap karein — password ki zarurat nahi."
                    : "Bina password, sirf email link se login (SMS charge zero)."}
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder = "••••••••",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-10"
          required
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
  );
}

function ForgotPassword() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!isEmail(email)) { toast.error("Sahi email address daalein"); return; }
    setSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setOpen(false);
    toast.success("Password reset link email par bhej diya gaya");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="mx-auto block text-xs font-medium text-primary underline">
          Forgot password?
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset your password</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Jis email se account bana hai wo daalein. Sirf phone number se bane account ke liye
            support par WhatsApp karein.
          </p>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
          />
          <Button className="w-full" onClick={() => void send()} disabled={sending}>
            {sending ? <Loader2 className="size-4 animate-spin" /> : "Send reset link"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3a7.2 7.2 0 0 1-10.7-3.8H1.3v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8Z"
      />
    </svg>
  );
}
