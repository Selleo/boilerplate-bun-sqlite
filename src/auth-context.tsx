import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { authClient } from "./auth-client";

type SessionStatus = "loading" | "authenticated" | "unauthenticated";

type AuthUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type AuthContextValue = {
  status: SessionStatus;
  user: AuthUser | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  const refresh = async () => {
    try {
      const response = await fetch("/api/me", { cache: "no-store" });
      if (!response.ok) {
        setStatus("unauthenticated");
        setUser(null);
        return;
      }
      const payload = (await response.json()) as { user?: AuthUser };
      setUser(payload.user ?? null);
      setStatus("authenticated");
    } catch {
      setStatus("unauthenticated");
      setUser(null);
    }
  };

  const logout = async () => {
    try {
      await authClient.signOut();
    } catch {
      // Best-effort sign-out.
    } finally {
      setStatus("unauthenticated");
      setUser(null);
    }
  };

  useEffect(() => {
    void refresh();

    const handleWindowFocus = () => {
      void refresh();
    };

    window.addEventListener("focus", handleWindowFocus);
    return () => {
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
