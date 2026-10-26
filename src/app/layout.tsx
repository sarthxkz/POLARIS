import type { Metadata, Viewport } from "next";
import { Work_Sans } from "next/font/google";
import "./globals.css";

const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-work-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "POLARIS — World Intelligence System",
    template: "%s · POLARIS",
  },
  description:
    "Navigate the Bigger Picture. Wildfires, storms, earthquakes, aircraft and satellites on a live 3D Earth, from public sources, each with its time and origin.",
  applicationName: "POLARIS",
  icons: { icon: { url: "/icon.svg", type: "image/svg+xml" } },
  openGraph: {
    title: "POLARIS — World Intelligence System",
    description: "Navigate the Bigger Picture. Public Earth-observation data on a live 3D globe.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#04070c",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={workSans.variable}>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
