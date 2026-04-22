import { cookies } from "next/headers";

/**
 * Get the anonymous user ID from the request cookie.
 * Returns null if not set (should not happen in normal usage).
 */
export async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("andreasgpt-uid")?.value ?? null;
}
