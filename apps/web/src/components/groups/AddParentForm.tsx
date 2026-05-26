"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Loader2 } from "lucide-react";

const schema = z.object({
  child_name: z.string().min(1, "Required"),
  parent_name: z.string().min(1, "Required"),
  phone_number: z.string().regex(/^\+91[6-9]\d{9}$/, "Format: +91XXXXXXXXXX"),
});

type FormData = z.infer<typeof schema>;

interface AddParentFormProps {
  groupId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function AddParentForm({ groupId, onSuccess, onCancel }: AddParentFormProps) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => api.post(`/groups/${groupId}/parents`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parents", groupId] });
      qc.invalidateQueries({ queryKey: ["groups"] });
      reset();
      onSuccess();
    },
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3 p-4 bg-[#09090B] rounded-xl border border-[#27272A]">
      <p className="text-sm font-semibold text-[#F4F4F5]">Add Parent</p>

      {[
        { field: "child_name" as const, label: "Child Name", placeholder: "Arjun Sharma" },
        { field: "parent_name" as const, label: "Parent Name", placeholder: "Rajesh Sharma" },
        { field: "phone_number" as const, label: "Phone", placeholder: "+919876543210" },
      ].map(({ field, label, placeholder }) => (
        <div key={field}>
          <label className="text-xs text-[#A1A1AA]">{label}</label>
          <input
            {...register(field)}
            placeholder={placeholder}
            className="w-full mt-1 px-3 py-2.5 bg-[#18181B] border border-[#27272A] rounded-lg text-sm text-[#F4F4F5] placeholder-[#52525B] focus:outline-none focus:border-[#52525B]"
          />
          {errors[field] && (
            <p className="text-xs text-red-400 mt-1">{errors[field]?.message}</p>
          )}
        </div>
      ))}

      {mutation.isError && (
        <p className="text-xs text-red-400">Failed to add parent. Check the phone number format.</p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 border border-[#27272A] rounded-lg text-sm text-[#A1A1AA] min-h-[44px]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="flex-1 py-2.5 bg-green-600 rounded-lg text-sm font-semibold text-white min-h-[44px] flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {mutation.isPending && <Loader2 size={14} className="animate-spin" />}
          Add Parent
        </button>
      </div>
    </form>
  );
}
