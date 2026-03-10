import logoBig from "../assets/logo_big.png";

export function NoWorkspaceAccessPage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-6 py-10">
      <section className="w-full rounded-2xl border border-[#ddd7ca] bg-white px-8 py-10 text-center shadow-sm">
        <div className="mx-auto mb-6 flex justify-center">
          <img
            src={logoBig}
            alt="Auditor Console logo"
            className="h-auto w-full max-w-[320px] object-contain"
          />
        </div>
        <h1 className="text-2xl font-semibold text-[#2e2a24]">No workspace access</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-[#5f594d]">
          Your account is not assigned to any workspace. Contact your administrator to request
          access.
        </p>
      </section>
    </div>
  );
}
