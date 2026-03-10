import { useState, type ReactNode } from "react";
import {
  ChevronDown,
  DollarSign,
  FileText,
  House,
  Package,
  ShoppingCart,
  UsersRound,
} from "lucide-react";

function NavItem({
  active,
  icon,
  label,
  withChevron,
  onClick,
}: {
  active?: boolean;
  icon: ReactNode;
  label: string;
  withChevron?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 w-full items-center rounded-xl px-3 text-left text-[14px] ${
        active
          ? "bg-[#dce1eb] font-semibold text-[#171a24]"
          : "text-[#6c7285] hover:bg-[#e9edf5]/70"
      }`}
    >
      <span className={`mr-3 ${active ? "text-[#111111]" : "text-[#6f7588]"}`}>{icon}</span>
      <span className="flex-1">{label}</span>
      {withChevron ? <ChevronDown size={16} className="text-[#8c90a1]" /> : null}
    </button>
  );
}

export function SidebarNav() {
  const [ordersOpen, setOrdersOpen] = useState(true);

  return (
    <>
      <p className="mt-5 text-[11px] font-semibold tracking-[0.14em] text-[#7c8295]">MAIN</p>
      <div className="mt-2 space-y-1">
        <NavItem active icon={<House size={16} />} label="Dashboard" />
        <NavItem withChevron icon={<Package size={16} />} label="Products" />
        <button
          type="button"
          onClick={() => setOrdersOpen((current) => !current)}
          className="flex h-9 w-full items-center rounded-xl px-3 text-[14px] text-[#6c7285] hover:bg-[#e9edf5]/70"
        >
          <span className="mr-3 text-[#6f7588]">
            <ShoppingCart size={16} />
          </span>
          <span className="flex-1 text-left">Orders</span>
          <ChevronDown
            size={16}
            className={`text-[#8c90a1] transition-transform ${ordersOpen ? "" : "-rotate-90"}`}
          />
        </button>
      </div>

      {ordersOpen ? (
        <div className="ml-[20px] mt-1 border-l border-[#d6dbe7] pl-3 text-[14px] text-[#7c8295]">
          <div className="h-8 leading-8">All Orders</div>
          <div className="h-8 leading-8">Returns</div>
          <div className="h-8 leading-8">Order Tracking</div>
        </div>
      ) : null}

      <div className="mt-2 space-y-1">
        <NavItem icon={<DollarSign size={16} />} label="Sales" />
        <NavItem icon={<UsersRound size={16} />} label="Customers" />
        <NavItem icon={<FileText size={16} />} label="Reports" />
      </div>
    </>
  );
}
