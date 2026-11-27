import { createContext, useContext, type ReactNode } from "react";
import type { MeResponse } from "./api";

const SessionContext = createContext<MeResponse | null>(null);

export function SessionProvider({ value, children }: { value: MeResponse; children: ReactNode }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): MeResponse {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside SessionProvider");
  return session;
}
