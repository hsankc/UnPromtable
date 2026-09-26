import { BookOpen, Boxes, Brain, FileCode2, Landmark, LayoutGrid, PlusSquare, ShieldAlert, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const APP_NAV: NavItem[] = [
  { href: "/app", label: "Genel bakış", icon: LayoutGrid },
  { href: "/app/modeller", label: "Modeller", icon: Brain },
  { href: "/app/olustur", label: "Kontrat oluştur", icon: PlusSquare },
  { href: "/app/getir", label: "Kontratını getir", icon: FileCode2 },
  { href: "/app/kontratlar", label: "Kontratlar", icon: Boxes },
  { href: "/app/saldiri", label: "Saldırı dene", icon: ShieldAlert },
  { href: "/app/hazine", label: "Hazine", icon: Landmark },
  { href: "/app/entegrasyon", label: "Entegrasyon", icon: BookOpen },
];

export function activeNav(pathname: string): NavItem | undefined {
  // Longest matching prefix wins, so /app/kontratlar/0x… maps to Kontratlar.
  return [...APP_NAV]
    .sort((a, b) => b.href.length - a.href.length)
    .find((n) => (n.href === "/app" ? pathname === "/app" : pathname === n.href || pathname.startsWith(`${n.href}/`)));
}
