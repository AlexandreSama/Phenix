// src/app/layout.tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
// Police auto-hébergée (paquet Fontsource) : aucune requête vers Google, ni au build ni chez le visiteur
import "@fontsource-variable/plus-jakarta-sans/wght.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Phenix",
  description: "Le bot Discord de PhenixMG : modération, niveaux, raids The Division 2, giveaways et tickets, réglés depuis un panel web.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
      <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
      </html>
  );
}
