import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yaazh — Miles apart. One moment.",
  description: "Yaazh is a private place for two people to listen and watch together.",
};

export const viewport: Viewport = {
  themeColor: "#10090d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
