import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AI Studio | Comunicação Contábil", template: "%s | AI Studio" },
  description: "Ambiente integrado para criação, gestão e aprovação de conteúdos da Contabilidade.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
