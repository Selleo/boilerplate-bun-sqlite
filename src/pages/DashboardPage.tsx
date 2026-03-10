import logo from "../assets/logo.png";
import { EmptyContent } from "../components/EmptyContent";
import { PageHeader } from "../components/PageHeader";
import { SidebarNav } from "../components/SidebarNav";

function Sidebar() {
  return (
    <aside className="p-5">
      <div className="flex h-9 items-center gap-3">
        <img src={logo} alt="Brand logo" className="h-8 w-8 rounded-lg" />
        <span className="text-[17px] font-semibold leading-none tracking-[-0.01em] text-[#222430]">
          Brand name
        </span>
      </div>
      <SidebarNav />
    </aside>
  );
}

export function DashboardPage() {
  return (
    <div className="min-h-screen bg-[#f7f7f9]">
      <div className="grid min-h-screen lg:grid-cols-[244px_1fr]">
        <div className="border-r border-[#e4e6ef] bg-[#f1f2f6]">
          <Sidebar />
        </div>
        <main className="bg-[#f7f7f9] px-6 pb-6 pt-5">
          <PageHeader title="Dashboard" />
          <EmptyContent />
        </main>
      </div>
    </div>
  );
}
