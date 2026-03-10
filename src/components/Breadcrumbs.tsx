import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export type BreadcrumbItem = {
  label: string;
  to?: string;
};

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="text-sm text-[#6b665b]">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5">
              {item.to && !isLast ? (
                <Link to={item.to} className="hover:text-[#1f1f1f]">
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? "font-medium text-[#2e2a24]" : ""}>{item.label}</span>
              )}
              {!isLast ? <ChevronRight size={14} className="text-[#9c968a]" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
