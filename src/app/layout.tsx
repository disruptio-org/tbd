import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Nousio — AI Workspace",
  description:
    "AI-powered SaaS toolkit for SMEs: document management, OCR, intelligent search, diagnostics, and more.",
  icons: {
    icon: [
      {
        url: '/logos/icon_black.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/logos/icon_white.png',
        media: '(prefers-color-scheme: dark)',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
