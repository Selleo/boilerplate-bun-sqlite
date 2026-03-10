import { useState } from "react";
import { authClient } from "../auth-client";
import logo from "../assets/logo.png";

export function LoginPage() {
  const [loginPending, setLoginPending] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const signInWithGoogle = async () => {
    if (loginPending) return;
    setLoginPending(true);
    setLoginError(null);

    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
      });
    } catch {
      setLoginError("Google sign-in failed. Check OAuth configuration and try again.");
    } finally {
      setLoginPending(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-[#f7f7f9] px-4 py-10">
      <section className="w-full max-w-[420px] rounded-2xl border border-[#e4e6ef] bg-white p-6 shadow-[0_10px_30px_rgba(18,25,42,0.04)]">
        <div className="mb-6 flex items-center gap-3">
          <img src={logo} alt="Brand logo" className="h-8 w-8 rounded-lg" />
          <span className="text-[17px] font-semibold leading-none tracking-[-0.01em] text-[#222430]">
            Brand name
          </span>
        </div>

        <h1 className="text-[20px] font-semibold leading-none tracking-[-0.01em] text-[#232733]">
          Sign in
        </h1>
        <p className="mt-2 text-[14px] text-[#7b8195]">Sign in with your Google account.</p>
        {loginError ? (
          <p className="mt-3 rounded-xl border border-[#f0c9c9] bg-[#fff4f4] px-3 py-2 text-[13px] text-[#a05252]">
            {loginError}
          </p>
        ) : null}

        <button
          type="button"
          className="mt-6 h-10 w-full rounded-xl bg-[#242733] text-[14px] font-medium text-white hover:bg-[#1e212c]"
          disabled={loginPending}
          onClick={() => void signInWithGoogle()}
        >
          {loginPending ? "Connecting..." : "Continue with Google"}
        </button>
      </section>
    </div>
  );
}
