import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "nanobots — Operator Control Room",
  description:
    "Sprinto-first SOC 2 evidence collection, monitoring, and export middleware.",
  openGraph: {
    title: "nanobots — Operator Control Room",
    description:
      "Conversation-first control room for evidence sources, control health, and Sprinto export state.",
    url: "https://nanobots.sh",
    siteName: "nanobots",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "nanobots — Operator Control Room",
    description:
      "Conversation-first control room for evidence sources, control health, and Sprinto export state.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
