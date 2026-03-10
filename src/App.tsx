import "./index.css";
import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth-context";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";

function AuthLoading() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f7f7f9] text-[14px] text-[#7b8195]">
      Loading...
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === "loading") return <AuthLoading />;
  if (status !== "authenticated") return <Navigate to="/login" replace />;
  return children;
}

function RequireGuest({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === "loading") return <AuthLoading />;
  if (status === "authenticated") return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/login"
        element={
          <RequireGuest>
            <LoginPage />
          </RequireGuest>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
