import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chess Swarm",
  description: "Premium Chess.com analytics dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="app-body">{children}</body>
    </html>
  );
}
