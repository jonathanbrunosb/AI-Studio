import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AI Studio | Comunicação Contábil", template: "%s | AI Studio" },
  description: "Ambiente integrado para criação, gestão e aprovação de conteúdos da Contabilidade.",
};

// Renderização dinâmica em todas as páginas: necessária para aplicar o nonce da CSP a cada requisição.
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
