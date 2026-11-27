import {
  Armchair,
  Boxes,
  Lightbulb,
  Package,
  Plug,
  Projector,
  Speaker,
  Table,
  Theater,
  Trophy,
  Wrench,
} from "lucide-react";

const ICONS = {
  seating: Armchair,
  tables: Table,
  audio: Speaker,
  lighting: Lightbulb,
  stage: Theater,
  projection: Projector,
  power: Plug,
  sports: Trophy,
  furniture: Boxes,
  tools: Wrench,
  other: Package,
} as const;

export function categoryIcon(category: string | null | undefined) {
  return ICONS[(category ?? "other") as keyof typeof ICONS] ?? Package;
}

export function CategoryGlyph({
  category,
  className = "h-5 w-5",
}: {
  category: string | null | undefined;
  className?: string;
}) {
  const Icon = categoryIcon(category);
  return <Icon className={className} />;
}
