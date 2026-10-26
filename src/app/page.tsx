import { Explorer } from "@/components/explorer/Explorer";

export default function HomePage() {
  return (
    <main id="main" tabIndex={-1} className="outline-none">
      <h1 className="sr-only">POLARIS — a live 3D globe of natural events, aircraft and satellites</h1>
      <Explorer />
    </main>
  );
}
