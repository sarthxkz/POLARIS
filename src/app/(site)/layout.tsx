import { ScrollChrome } from "@/components/site/ScrollChrome";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-ground text-ink">
      {children}
      <ScrollChrome />
    </div>
  );
}
