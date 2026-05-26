"use client";
import { useLogout } from "@/hooks/useAuth";
import { useAuthStore } from "@/stores/authStore";
import { LogOut, Bus } from "lucide-react";

interface TopBarProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
}

export default function TopBar({ title, showBack, onBack }: TopBarProps) {
  const logout = useLogout();
  const { user } = useAuthStore();

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-[#18181B] border-b border-[#27272A] sticky top-0 z-50">
      <div className="flex items-center gap-3">
        {showBack ? (
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-[#27272A] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <Bus size={20} className="text-green-500" />
          </div>
        )}
        <h1 className="text-base font-semibold text-[#F4F4F5] truncate max-w-[200px]">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        {user && (
          <span className="text-xs text-[#A1A1AA] hidden sm:inline">{user.username}</span>
        )}
        <button
          onClick={logout}
          className="p-2 rounded-full hover:bg-[#27272A] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="Logout"
        >
          <LogOut size={18} className="text-[#A1A1AA]" />
        </button>
      </div>
    </header>
  );
}
