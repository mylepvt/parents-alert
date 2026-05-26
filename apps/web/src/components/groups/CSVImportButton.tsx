"use client";
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Upload, Loader2 } from "lucide-react";

interface CSVImportButtonProps {
  groupId: string;
}

export default function CSVImportButton({ groupId }: CSVImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const [result, setResult] = useState<{ added: number; errors: string[] } | null>(null);

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post(`/groups/${groupId}/parents/import`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: (data) => {
      setResult(data);
      qc.invalidateQueries({ queryKey: ["parents", groupId] });
      qc.invalidateQueries({ queryKey: ["groups"] });
    },
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) mutation.mutate(file);
    e.target.value = "";
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFile}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={mutation.isPending}
        className="flex items-center gap-2 px-4 py-2.5 border border-[#27272A] rounded-xl text-sm text-[#A1A1AA] hover:text-[#F4F4F5] hover:border-[#52525B] transition-colors min-h-[44px] disabled:opacity-60"
      >
        {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        Import CSV
      </button>

      {result && (
        <div className="mt-2 p-3 bg-[#18181B] rounded-lg border border-[#27272A] text-xs">
          <p className="text-green-400">{result.added} parents added</p>
          {result.errors.length > 0 && (
            <div className="mt-1">
              <p className="text-red-400">{result.errors.length} errors:</p>
              {result.errors.slice(0, 3).map((e, i) => (
                <p key={i} className="text-[#A1A1AA] mt-0.5">{e}</p>
              ))}
              {result.errors.length > 3 && (
                <p className="text-[#71717A]">+{result.errors.length - 3} more</p>
              )}
            </div>
          )}
        </div>
      )}

      <p className="mt-1 text-[10px] text-[#71717A]">
        CSV columns: child_name, parent_name, phone_number (+91XXXXXXXXXX)
      </p>
    </div>
  );
}
