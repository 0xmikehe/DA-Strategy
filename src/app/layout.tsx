import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digital Asset Ops",
  description: "Phase 1 P0 engineering baseline for the digital asset operating system."
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
