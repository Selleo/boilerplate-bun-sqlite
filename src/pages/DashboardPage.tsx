import logoBig from "../assets/logo_big.png";

export function DashboardPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-4xl flex-col items-center justify-center px-4 text-center">
      <div className="relative">
        <img
          src={logoBig}
          alt="Auditor Console logo"
          className="h-auto w-full max-w-[420px] object-contain opacity-85"
        />
      </div>
      <p className="mt-6 max-w-2xl text-xl text-[#5f594d]">
        Welcome to Auditor Console, start your assessment.
      </p>
    </div>
  );
}
