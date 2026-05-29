"use client";
import { useAuthStore } from "@/stores/authStore";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import BottomNav from "./BottomNav";
import TopBar from "./TopBar";

interface AppShellProps {
  children: React.ReactNode;
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  hideNav?: boolean;
}

export default function AppShell({ children, title, showBack, onBack, hideNav }: AppShellProps) {
  const { isAuthenticated, _hasHydrated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) router.push("/login");
  }, [isAuthenticated, _hasHydrated, router]);

  // Still hydrating from localStorage — show nothing to prevent flicker
  if (!_hasHydrated) return null;
  if (!isAuthenticated) return null;

  return (
    <div className="flex flex-col min-h-screen bg-[#09090B] text-[#F4F4F5]">
      <TopBar title={title} showBack={showBack} onBack={onBack} />
      <main className="flex-1 pb-20 overflow-y-auto">{children}</main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
