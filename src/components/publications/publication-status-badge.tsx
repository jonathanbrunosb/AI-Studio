import { publicationStatusLabels, publicationStatusStyles, type PublicationStatus } from "@/lib/publications/publication-rules";

export function PublicationStatusBadge({ status }: { status: PublicationStatus | "not_prepared" }) {
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${publicationStatusStyles[status]}`}><span className="size-1.5 rounded-full bg-current" />{publicationStatusLabels[status]}</span>;
}
