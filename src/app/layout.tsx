import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "nanobots.sh — The immune system for your codebase",
  description:
    "AI agents that live in your GitHub repo and continuously maintain codebase health. Dead code, flaky tests, stale docs, dependency rot — fixed before you notice.",
  openGraph: {
    title: "nanobots.sh — The immune system for your codebase",
    description:
      "AI agents that live in your GitHub repo and continuously maintain codebase health.",
    url: "https://nanobots.sh",
    siteName: "nanobots.sh",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "nanobots.sh — The immune system for your codebase",
    description:
      "AI agents that live in your GitHub repo and continuously maintain codebase health.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
