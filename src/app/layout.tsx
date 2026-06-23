import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digital Asset OS",
  description: "Phase 1 market and ledger workspace for the digital asset operating system."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
