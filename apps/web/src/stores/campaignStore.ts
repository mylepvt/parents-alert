import { create } from "zustand";
import type { Campaign, SSEPayload } from "@/types";

interface CampaignDraft {
  groupId: string;
  groupName: string;
  language: "hindi" | "english";
  message: string;
  parentCount: number;
}

interface CampaignState {
  draft: CampaignDraft | null;
  activeCampaign: Campaign | null;
  liveData: SSEPayload | null;
  setDraft: (draft: CampaignDraft | null) => void;
  setActiveCampaign: (campaign: Campaign | null) => void;
  setLiveData: (data: SSEPayload) => void;
  clearLiveData: () => void;
}

export const useCampaignStore = create<CampaignState>((set) => ({
  draft: null,
  activeCampaign: null,
  liveData: null,
  setDraft: (draft) => set({ draft }),
  setActiveCampaign: (campaign) => set({ activeCampaign: campaign }),
  setLiveData: (data) => set({ liveData: data }),
  clearLiveData: () => set({ liveData: null }),
}));
