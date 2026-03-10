import { authClient } from "../auth-client";
import logo from "../assets/logo.png";

export function LoginPage() {
  const signInWithGoogle = async () => {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/",
    });
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

        <button
          type="button"
          className="mt-6 h-10 w-full rounded-xl bg-[#242733] text-[14px] font-medium text-white hover:bg-[#1e212c]"
          onClick={() => void signInWithGoogle()}
        >
          Continue with Google
        </button>
      </section>
    </div>
  );
}
