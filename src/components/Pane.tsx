import type { ReactNode } from "react";

type PaneProps = {
  children: ReactNode;
  className?: string;
};

export function Pane({ children, className = "" }: PaneProps) {
  return (
    <section
      className={`rounded-[18px] border border-[#e7eaf2] border-b-2 border-b-[#e7eaf2] bg-white ${className}`}
    >
      {children}
    </section>
  );
}
