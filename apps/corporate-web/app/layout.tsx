import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Future Pay | Corporate Operations",
  description: "SaaS-style corporate operations dashboard for the Future Pay banking payouts platform."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
