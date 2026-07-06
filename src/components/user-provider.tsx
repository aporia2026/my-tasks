"use client";

import { createContext, useContext, useEffect, useState } from "react";

import type { UserRole } from "@/lib/types";

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}

interface UserContextValue {
  user: CurrentUser | null;
  loading: boolean;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  loading: true,
});

export function useUser(): UserContextValue {
  return useContext(UserContext);
}

/** Fetches the signed-in user once and shares it so pages can branch by role. */
export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { user: CurrentUser } | null) => setUser(body?.user ?? null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <UserContext.Provider value={{ user, loading }}>
      {children}
    </UserContext.Provider>
  );
}
