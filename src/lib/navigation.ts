import { BarChart3, BookOpen, FileStack, LayoutTemplate, Settings, Sparkles } from "lucide-react";

export const navigationItems = [
  { label: "Dashboard", href: "/", icon: BarChart3 },
  { label: "Estúdio de Criação", href: "/studio", icon: Sparkles },
  { label: "Biblioteca", href: "/biblioteca", icon: BookOpen },
  { label: "Gestão Editorial", href: "/gestao-editorial", icon: FileStack },
  { label: "Modelos", href: "/modelos", icon: LayoutTemplate },
  { label: "Administração", href: "/administracao", icon: Settings },
] as const;

export function getPageTitle(pathname: string) {
  return navigationItems.find((item) => item.href === pathname)?.label ?? "AI Studio";
}
