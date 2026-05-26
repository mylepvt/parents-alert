"use client";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import type { User } from "@/types";

export function useLogin() {
  const { setAuth } = useAuthStore();
  const router = useRouter();

  return useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const { data: tokenData } = await api.post<{ access_token: string }>("/auth/login", credentials);
      const { data: user } = await api.get<User>("/auth/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      return { token: tokenData.access_token, user };
    },
    onSuccess: ({ token, user }) => {
      setAuth(user, token);
      router.push("/dashboard");
    },
  });
}

export function useLogout() {
  const { clearAuth } = useAuthStore();
  const router = useRouter();

  return () => {
    clearAuth();
    router.push("/login");
  };
}
