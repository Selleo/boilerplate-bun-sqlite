import { authClient } from "../auth-client";
import logoBig from "../assets/logo_big.png";

export function LoginPage() {
  const signInWithGoogle = async () => {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/",
    });
  };

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10">
      <section className="w-full max-w-5xl overflow-hidden rounded-2xl border border-[#d9d4c8] bg-white shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="flex items-center justify-center border-b border-[#e7e1d4] bg-[#f7f4ec] p-8 md:border-b-0 md:border-r md:border-[#e7e1d4] md:p-12">
            <img
              src={logoBig}
              alt="Auditor Console logo"
              className="h-auto w-full max-w-[420px]"
            />
          </div>

          <div className="flex min-h-full flex-col p-8 sm:p-10 md:p-12">
            <h1 className="text-3xl font-semibold tracking-wide">Auditor Console</h1>
            <p className="mt-4 text-base leading-relaxed text-[#5f594e]">
              Auditor Console is used to design, publish, and manage audit frameworks and assessment
              structures for your organization.
            </p>
            <div className="mt-4 rounded-lg border border-[#e7c6bc] bg-[#fdf2ef] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9a4f3e]">
                Warning
              </p>
              <p className="mt-1 text-sm leading-relaxed text-[#8a5648]">
                Authorized team members only. If you do not have explicit access to this
                environment, close this page and contact your system administrator.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              className="mt-auto w-full rounded-lg bg-[#1f6feb] px-4 py-3 text-base font-medium text-white hover:bg-[#1b63d6]"
            >
              Continue with Google
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
