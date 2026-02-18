import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenGrove",
  description: "Local-first AI chat",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased bg-[var(--bg)] text-[var(--text)]">
        {children}
      </body>
    </html>
  );
}
