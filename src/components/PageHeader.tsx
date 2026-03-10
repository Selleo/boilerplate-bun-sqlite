import { useEffect, useState } from "react";
import { ChevronDown, CircleUserRound, LogOut } from "lucide-react";
import { authClient } from "../auth-client";
import { SearchInput } from "./SearchInput";

export function PageHeader({ title }: { title: string }) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [userImage, setUserImage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/me")
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { user?: { image?: string | null } };
      })
      .then((payload) => {
        if (cancelled) return;
        setUserImage(payload?.user?.image ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setUserImage(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    if (logoutPending) return;
    setLogoutPending(true);
    try {
      await authClient.signOut();
    } finally {
      window.location.assign("/login");
    }
  };

  return (
    <header className="flex h-9 items-center justify-between">
      <h1 className="text-[20px] font-semibold leading-none tracking-[-0.01em] text-[#232733]">
        {title}
      </h1>
      <div className="flex items-center gap-3">
        <SearchInput />
        <div className="relative">
          <button
            type="button"
            onClick={() => setUserMenuOpen((current) => !current)}
            className="flex h-9 items-center gap-2 rounded-xl border border-[#dfe5f0] border-b-2 border-b-[#dfe5f0] bg-white px-2 text-[#97a0b3]"
          >
            {userImage ? (
              <img
                src={userImage}
                alt="User avatar"
                className="h-6 w-6 rounded-full object-cover"
                onError={() => setUserImage(null)}
              />
            ) : (
              <span className="h-6 w-6 rounded-full bg-[linear-gradient(130deg,#d2ac8c,#8e6138)]" />
            )}
            <ChevronDown size={15} />
          </button>
          {userMenuOpen ? (
            <div className="absolute right-0 top-11 z-10 w-44 rounded-xl border border-[#e7e9f1] bg-white p-1 shadow-[0_10px_25px_rgba(22,28,45,0.08)]">
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[14px] text-[#3f455c] hover:bg-[#f4f6fb]">
                <CircleUserRound size={14} />
                Account settings
              </button>
              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={logoutPending}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[14px] text-[#3f455c] hover:bg-[#f4f6fb] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LogOut size={14} />
                {logoutPending ? "Logging out..." : "Logout"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
