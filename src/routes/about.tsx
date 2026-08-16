import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app/AppShell";
import { BrandFooter } from "@/components/app/Tagline";
import { useBusiness } from "@/hooks/useBusiness";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About us — Mannu A2Z Mart" },
      { name: "description", content: "Mannu A2Z Mart is a hyperlocal multi-vendor delivery service in Ranchi. Read our licence, registration and support details." },
      { property: "og:title", content: "About Mannu A2Z Mart" },
      { property: "og:description", content: "Aapke ghar ki digital dukan — licence, registration and support details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: About,
});

function About() {
  const { business, brand, tagline } = useBusiness();
  return (
    <AppShell>
      <PageHeader title="About us" subtitle={tagline} />
      <main className="mx-auto max-w-3xl px-4 py-4">
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-display text-lg font-bold">{brand}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {business?.about_text ??
              "Mannu A2Z Mart apke mohalle ki dukano ko aapke ghar tak pahunchata hai — ration, sabzi, fal, meat aur bahut kuch, minutes me."}
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="FSSAI Licence No." value={business?.fssai_number} />
            <Row label="Udyam / MSME Reg. No." value={business?.udyam_number} />
            <Row label="Support phone" value={business?.support_phone} />
            <Row label="Support email" value={business?.support_email} />
          </dl>
        </section>
        <BrandFooter />
      </main>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value?: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
