import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Claude Manager - Your AI Agent Command Center",
  description: "Manage, monitor, and orchestrate your Claude Code agents from a beautiful 3D interface. Track usage, manage skills, and boost your productivity.",
  keywords: ["Claude", "AI", "Agent", "Manager", "Claude Code", "Productivity", "Developer Tools"],
  authors: [{ name: "Claude Manager Team" }],
  icons: {
    icon: "/bot-icon.png",
    apple: "/bot-icon.png",
  },
  openGraph: {
    title: "Claude Manager - Your AI Agent Command Center",
    description: "Manage, monitor, and orchestrate your Claude Code agents from a beautiful 3D interface.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
