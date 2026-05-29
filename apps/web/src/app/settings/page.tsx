"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AppShell from "@/components/layout/AppShell";
import { useAuthStore } from "@/stores/authStore";
import api from "@/lib/api";
import { Loader2, Lock, LogOut, User, Download, Database, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const { user, clearAuth } = useAuthStore();
  const router = useRouter();

  const [current, setCurrent] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const qc = useQueryClient();

  const { data: backups } = useQuery<{ id: string; trigger: string; size_bytes: number; created_at: string }[]>({
    queryKey: ["backups"],
    queryFn: async () => (await api.get("/admin/backups")).data,
  });

  const triggerBackup = useMutation({
    mutationFn: () => api.post("/admin/backups"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["backups"] }),
  });

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (newPass !== confirm) {
      setMsg({ type: "err", text: "New passwords don't match" });
      return;
    }
    if (newPass.length < 6) {
      setMsg({ type: "err", text: "Password must be at least 6 characters" });
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/change-password", {
        current_password: current,
        new_password: newPass,
      });
      setMsg({ type: "ok", text: "Password changed successfully" });
      setCurrent(""); setNewPass(""); setConfirm("");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setMsg({ type: "err", text: detail || "Failed to change password" });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  const downloadBackup = async (id: string, createdAt: string) => {
    try {
      const res = await api.get(`/admin/backups/${id}/download`, { responseType: "blob" });
      const ts = new Date(createdAt).toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const filename = `busalert_backup_${ts}.sql`;
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/sql" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Download failed. Try again.");
    }
  };

  return (
    <AppShell title="Settings">
      <div className="px-4 pt-5 pb-6 space-y-5 max-w-lg mx-auto">

        {/* Profile */}
        <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-green-950/50 border border-green-800 flex items-center justify-center">
            <User size={22} className="text-green-400" />
          </div>
          <div>
            <p className="font-bold text-[#F4F4F5]">Shikha Chaudhary</p>
            <p className="text-xs text-[#A1A1AA]">Transport Manager · Seth M R Jaipuria School</p>
            <p className="text-xs text-[#71717A] mt-0.5">@{user?.username}</p>
          </div>
        </div>

        {/* Change Password */}
        <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Lock size={15} className="text-[#71717A]" />
            <p className="text-sm font-semibold text-[#F4F4F5]">Change Password</p>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-3">
            {[
              { label: "Current Password", value: current, set: setCurrent },
              { label: "New Password", value: newPass, set: setNewPass },
              { label: "Confirm New Password", value: confirm, set: setConfirm },
            ].map(({ label, value, set }) => (
              <div key={label}>
                <label className="text-xs text-[#A1A1AA]">{label}</label>
                <input
                  type="password"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  required
                  className="w-full mt-1 px-3 py-2.5 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-[#F4F4F5] placeholder-[#52525B] focus:outline-none focus:border-[#52525B]"
                />
              </div>
            ))}

            {msg && (
              <p className={`text-xs ${msg.type === "ok" ? "text-green-400" : "text-red-400"}`}>
                {msg.text}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-60 rounded-lg text-sm font-semibold text-white min-h-[44px] flex items-center justify-center gap-2 transition-colors"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Update Password
            </button>
          </form>
        </div>

        {/* Database Backup */}
        <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database size={15} className="text-[#71717A]" />
              <p className="text-sm font-semibold text-[#F4F4F5]">Database Backup</p>
            </div>
            <button
              onClick={() => triggerBackup.mutate()}
              disabled={triggerBackup.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-[#3F3F46] hover:border-[#52525B] text-[#A1A1AA] hover:text-[#F4F4F5] disabled:opacity-60 rounded-lg text-xs font-medium transition-colors"
            >
              {triggerBackup.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Backup Now
            </button>
          </div>

          <p className="text-xs text-[#71717A]">Auto-backs up every 24h. Last 7 stored. Click to download any.</p>

          <div className="space-y-1.5">
            {!backups?.length ? (
              <p className="text-xs text-[#52525B] text-center py-3">No backups yet — auto runs on next cycle.</p>
            ) : (
              backups.map((b) => (
                <div key={b.id} className="flex items-center justify-between py-2 px-3 bg-[#09090B] rounded-lg">
                  <div>
                    <p className="text-xs text-[#F4F4F5]">
                      {new Date(b.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <p className="text-[10px] text-[#71717A]">
                      {b.trigger === "auto" ? "Auto" : "Manual"} · {(b.size_bytes / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <button
                    onClick={() => downloadBackup(b.id, b.created_at)}
                    className="p-2 text-[#52525B] hover:text-blue-400 transition-colors"
                    title="Download"
                  >
                    <Download size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* App Info */}
        <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold text-[#F4F4F5] mb-3">App Info</p>
          {[
            { label: "App", value: "Bus Alert v1.0" },
            { label: "School", value: "Seth M R Jaipuria School, Bhiwadi" },
            { label: "Owner", value: "Shikha Chaudhary" },
          ].map(({ label, value }) => (
            <div key={label} className="flex gap-2">
              <span className="text-xs text-[#71717A] w-16 flex-shrink-0">{label}</span>
              <span className="text-xs text-[#A1A1AA]">{value}</span>
            </div>
          ))}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full py-3 border border-red-900 text-red-400 hover:bg-red-950/20 rounded-xl text-sm font-semibold min-h-[48px] flex items-center justify-center gap-2 transition-colors"
        >
          <LogOut size={15} />
          Logout
        </button>
      </div>
    </AppShell>
  );
}
