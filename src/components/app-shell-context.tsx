"use client";

import { createContext, useContext } from "react";

interface AppShellAccount {
  email: string;
  orgName: string;
}

const AppShellContext = createContext<AppShellAccount | null>(null);

export function AppShellProvider({
  account,
  children,
}: {
  account: AppShellAccount;
  children: React.ReactNode;
}) {
  return <AppShellContext value={account}>{children}</AppShellContext>;
}

export function useAppShellAccount(): AppShellAccount {
  const account = useContext(AppShellContext);
  if (!account) throw new Error("Account details must be rendered inside AppShell.");
  return account;
}
