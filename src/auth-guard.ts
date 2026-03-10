import { authClient } from "./auth-client";

let redirectInProgress = false;

export async function logoutAndRedirectToLogin() {
  if (redirectInProgress) return;
  redirectInProgress = true;

  try {
    await authClient.signOut();
  } catch {
    // Best-effort sign-out before redirect.
  }

  window.location.assign("/login");
}

