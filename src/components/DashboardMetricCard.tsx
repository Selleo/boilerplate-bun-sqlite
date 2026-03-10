import type { ReactNode } from "react";
import { Pane } from "./Pane";

type DashboardMetricCardProps = {
  title: string;
  metric: string;
  icon: ReactNode;
  color: string;
};

export function DashboardMetricCard({
  title,
  metric,
  icon,
  color,
}: DashboardMetricCardProps) {
  return (
    <Pane className="px-4 py-3">
      <div className="flex items-center gap-4">
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-full"
          style={{ color, backgroundColor: `${color}1a` }}
        >
          {icon}
        </span>
        <div>
          <p className="text-[14px] leading-5 text-[#666d82]">{title}</p>
          <p className="mt-1 text-[24px] font-semibold leading-none tracking-[-0.02em] text-[#242733]">
            {metric}
          </p>
        </div>
      </div>
    </Pane>
  );
}
