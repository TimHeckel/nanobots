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
  title: "nanobots.sh — Build AI bot swarms for your GitHub repos",
  description:
    "Describe a bot in plain English. Test it against your code. Deploy a swarm that scans, fixes, and ships PRs autonomously. Start with 6 built-in bots. Create your own in seconds.",
  openGraph: {
    title: "nanobots.sh — Build AI bot swarms for your GitHub repos",
    description:
      "Describe a bot in plain English. Deploy a swarm that scans, fixes, and ships PRs autonomously.",
    url: "https://nanobots.sh",
    siteName: "nanobots.sh",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "nanobots.sh — Build AI bot swarms for your GitHub repos",
    description:
      "Describe a bot in plain English. Deploy a swarm that scans, fixes, and ships PRs autonomously.",
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
