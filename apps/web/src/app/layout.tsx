import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "TourneyForge - Fishing Tournament Management",
  description: "Professional fishing tournament management platform",
};

const LOCAL_DEV = process.env.LOCAL_DEV === "true";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const content = (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );

  if (LOCAL_DEV) {
    return content;
  }

  return <ClerkProvider>{content}</ClerkProvider>;
}
