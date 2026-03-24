import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chess Swarm",
  description: "Chess analytics scaffold",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
