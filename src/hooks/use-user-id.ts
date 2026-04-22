"use client";

import { useState, useEffect } from "react";

const COOKIE_NAME = "andreasgpt-uid";

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

/**
 * Generate or retrieve a persistent anonymous user ID.
 * Stored as a cookie so it's sent automatically with every request.
 */
export function useUserId(): string | null {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let id = getCookie(COOKIE_NAME);
    if (!id) {
      id = crypto.randomUUID();
      setCookie(COOKIE_NAME, id);
    }
    setUserId(id);
  }, []);

  return userId;
}
