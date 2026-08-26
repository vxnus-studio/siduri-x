import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Siduri — Local-First Companion",
  description:
    "Siduri — a local-first companion with explicit memory, grounded knowledge, and optional presence.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Noto+Sans+JP:wght@400;500;700&family=Noto+Serif+JP:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#0b0b0e] text-[#eee8df] selection:bg-[#d99a68]/30 selection:text-[#f4c28d]">
        {children}
      </body>
    </html>
  );
}
