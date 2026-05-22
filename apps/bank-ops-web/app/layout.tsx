import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Future Pay | Bank Operations",
  description: "Bank operations workspace fronted by the unified BFF."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
