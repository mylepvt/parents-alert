"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AppShell from "@/components/layout/AppShell";
import AddParentForm from "@/components/groups/AddParentForm";
import CSVImportButton from "@/components/groups/CSVImportButton";
import api from "@/lib/api";
import type { ClassGroup, Parent } from "@/types";
import { cn } from "@/lib/utils";
import { Plus, ChevronDown, ChevronUp, Trash2, Users, Loader2 } from "lucide-react";

function ParentItem({ parent, onDelete }: { parent: Parent; onDelete: (id: string) => void }) {
  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-[#27272A]/50">
      <div>
        <p className="text-sm text-[#F4F4F5]">{parent.child_name}</p>
        <p className="text-xs text-[#A1A1AA]">{parent.parent_name} · {parent.phone_number}</p>
      </div>
      <button
        onClick={() => onDelete(parent.id)}
        className="p-2 text-[#71717A] hover:text-red-400 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function GroupCard({ group }: { group: ClassGroup }) {
  const [expanded, setExpanded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const qc = useQueryClient();

  const { data: parents } = useQuery<Parent[]>({
    queryKey: ["parents", group.id],
    queryFn: async () => (await api.get(`/groups/${group.id}/parents`)).data,
    enabled: expanded,
  });

  const deleteParent = useMutation({
    mutationFn: (id: string) => api.delete(`/parents/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parents", group.id] });
      qc.invalidateQueries({ queryKey: ["groups"] });
    },
  });

  return (
    <div className="bg-[#18181B] rounded-xl border border-[#27272A] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-[#27272A]/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-950/50 border border-blue-800 flex items-center justify-center">
            <Users size={16} className="text-blue-400" />
          </div>
          <div>
            <p className="font-semibold text-[#F4F4F5] text-sm">{group.name}</p>
            <p className="text-xs text-[#A1A1AA]">{group.parent_count} parents</p>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-[#71717A]" /> : <ChevronDown size={16} className="text-[#71717A]" />}
      </button>

      {expanded && (
        <div className="border-t border-[#27272A] px-4 pb-4 pt-2">
          <div className="flex items-center justify-between mb-2">
            <CSVImportButton groupId={group.id} />
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-900/30 border border-green-800 text-green-400 rounded-xl text-xs font-medium min-h-[40px]"
            >
              <Plus size={13} />
              Add
            </button>
          </div>

          {showAddForm && (
            <div className="mb-3">
              <AddParentForm
                groupId={group.id}
                onSuccess={() => setShowAddForm(false)}
                onCancel={() => setShowAddForm(false)}
              />
            </div>
          )}

          {parents && parents.length > 0 ? (
            <div className="divide-y divide-[#27272A]">
              {parents.map((p) => (
                <ParentItem
                  key={p.id}
                  parent={p}
                  onDelete={(id) => deleteParent.mutate(id)}
                />
              ))}
            </div>
          ) : parents ? (
            <p className="text-xs text-[#71717A] text-center py-4">No parents yet. Add above.</p>
          ) : (
            <div className="flex justify-center py-4">
              <Loader2 size={18} className="animate-spin text-[#A1A1AA]" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function GroupsPage() {
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const qc = useQueryClient();

  const { data: groups, isLoading } = useQuery<ClassGroup[]>({
    queryKey: ["groups"],
    queryFn: async () => (await api.get("/groups")).data,
  });

  const createGroup = useMutation({
    mutationFn: (name: string) =>
      api.post("/groups", { name, school_name: "Seth M R Jaipuria School Bhiwadi" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups"] });
      setNewGroupName("");
      setShowNewGroup(false);
    },
  });

  return (
    <AppShell title="Class Groups">
      <div className="px-4 pt-4 pb-6 space-y-4 max-w-lg mx-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#F4F4F5]">Groups</h2>
          <button
            onClick={() => setShowNewGroup(!showNewGroup)}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-green-600 rounded-xl text-sm font-medium text-white min-h-[44px]"
          >
            <Plus size={15} />
            New Group
          </button>
        </div>

        {showNewGroup && (
          <div className="p-4 bg-[#18181B] border border-[#27272A] rounded-xl space-y-3">
            <p className="text-sm font-semibold text-[#F4F4F5]">New Class Group</p>
            <input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="e.g. Class 3-A"
              className="w-full px-3 py-2.5 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-[#F4F4F5] placeholder-[#52525B] focus:outline-none focus:border-[#52525B]"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowNewGroup(false)}
                className="flex-1 py-2.5 border border-[#27272A] rounded-lg text-sm text-[#A1A1AA] min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={() => newGroupName.trim() && createGroup.mutate(newGroupName.trim())}
                disabled={!newGroupName.trim() || createGroup.isPending}
                className="flex-1 py-2.5 bg-green-600 rounded-lg text-sm font-semibold text-white min-h-[44px] disabled:opacity-60"
              >
                Create
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={24} className="animate-spin text-[#A1A1AA]" />
          </div>
        ) : !groups?.length ? (
          <div className="text-center py-12">
            <Users size={40} className="text-[#27272A] mx-auto mb-3" />
            <p className="text-[#A1A1AA] text-sm">No groups yet</p>
            <p className="text-[#71717A] text-xs mt-1">Create a group to start adding parents</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <GroupCard key={g.id} group={g} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
