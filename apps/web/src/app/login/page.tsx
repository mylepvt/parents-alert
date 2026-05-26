"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin } from "@/hooks/useAuth";
import { useAuthStore } from "@/stores/authStore";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Bus, Loader2 } from "lucide-react";

const schema = z.object({
  username: z.string().min(1, "Required"),
  password: z.string().min(1, "Required"),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [showPwd, setShowPwd] = useState(false);
  const login = useLogin();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (isAuthenticated) router.push("/dashboard");
  }, [isAuthenticated, router]);

  return (
    <div className="min-h-screen bg-[#09090B] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Bus size={32} className="text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-[#F4F4F5]">Bus Alert</h1>
          <p className="text-sm text-[#A1A1AA] mt-1">Seth M R Jaipuria School, Bhiwadi</p>
        </div>

        <form onSubmit={handleSubmit((d) => login.mutate(d))} className="space-y-4">
          <div>
            <label className="text-sm text-[#A1A1AA]">Username</label>
            <input
              {...register("username")}
              type="text"
              autoComplete="username"
              className="w-full mt-1.5 px-4 py-4 bg-[#18181B] border border-[#27272A] rounded-xl text-[#F4F4F5] text-base placeholder-[#52525B] focus:outline-none focus:border-[#52525B] min-h-[56px]"
              placeholder="admin"
            />
            {errors.username && <p className="text-xs text-red-400 mt-1">{errors.username.message}</p>}
          </div>

          <div>
            <label className="text-sm text-[#A1A1AA]">Password</label>
            <div className="relative mt-1.5">
              <input
                {...register("password")}
                type={showPwd ? "text" : "password"}
                autoComplete="current-password"
                className="w-full px-4 py-4 pr-12 bg-[#18181B] border border-[#27272A] rounded-xl text-[#F4F4F5] text-base placeholder-[#52525B] focus:outline-none focus:border-[#52525B] min-h-[56px]"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[#A1A1AA]"
              >
                {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>}
          </div>

          {login.isError && (
            <div className="p-3 bg-red-950/50 border border-red-800 rounded-xl">
              <p className="text-sm text-red-400">Invalid username or password</p>
            </div>
          )}

          <button
            type="submit"
            disabled={login.isPending}
            className="w-full py-4 bg-green-600 hover:bg-green-500 disabled:opacity-60 rounded-xl text-base font-semibold text-white transition-colors min-h-[56px] flex items-center justify-center gap-2"
          >
            {login.isPending && <Loader2 size={18} className="animate-spin" />}
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
