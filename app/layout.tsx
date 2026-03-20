import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rental Software",
  description: "Inflatable-first rental platform built to expand into party and trailer workflows.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
