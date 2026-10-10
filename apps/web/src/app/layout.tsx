// src/app/layout.tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = { title: "Phenix", description: "Panel Phenix" };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
      <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
      </html>
  );
}