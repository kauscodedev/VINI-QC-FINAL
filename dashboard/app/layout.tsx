import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VINI QC Executive Dashboard",
  description: "Dashboard for QC scoring and call quality analytics.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
