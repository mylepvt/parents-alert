export interface User {
  id: string;
  username: string;
  role: "admin" | "staff";
  created_at: string;
}

export interface ClassGroup {
  id: string;
  name: string;
  school_name: string;
  is_active: boolean;
  created_at: string;
  parent_count: number;
}

export interface Parent {
  id: string;
  class_group_id: string;
  child_name: string;
  parent_name: string;
  phone_number: string;
  is_active: boolean;
  created_at: string;
}

export type Language = "hindi" | "english";

export type CampaignStatus = "pending" | "running" | "done" | "stopped" | "failed";

export type CallStatus =
  | "queued"
  | "generating_script"
  | "ringing"
  | "busy"
  | "connected"
  | "done"
  | "failed"
  | "skipped";

export interface Campaign {
  id: string;
  class_group_id: string;
  created_by: string;
  message_text: string;
  language: Language;
  status: CampaignStatus;
  total_parents: number;
  done_count: number;
  failed_count: number;
  skipped_count: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  group_name: string | null;
}

export interface CallLog {
  id: string;
  campaign_id: string;
  parent_id: string;
  status: CallStatus;
  attempt_number: number;
  max_attempts: number;
  ai_script: string | null;
  twilio_call_sid: string | null;
  failure_reason: string | null;
  next_retry_at: string | null;
  started_at: string | null;
  connected_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  parent_name: string | null;
  child_name: string | null;
  phone_number: string | null;
}

export interface Report {
  campaign_id: string;
  group_name: string;
  message_text: string;
  language: Language;
  status: CampaignStatus;
  total_parents: number;
  done_count: number;
  failed_count: number;
  skipped_count: number;
  success_rate: number;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  logs: CallLog[];
}

export interface SSELog {
  id: string;
  parent_name: string;
  child_name: string;
  phone: string;
  status: CallStatus;
  attempt_number: number;
  max_attempts: number;
  next_retry_at: string | null;
  duration_seconds: number | null;
  ai_script: string | null;
}

export interface SSEPayload {
  campaign: {
    status: CampaignStatus;
    total: number;
    done: number;
    failed: number;
    skipped: number;
  };
  logs: SSELog[];
}

export interface ApiError {
  error: string;
  detail: string;
}

export const STATUS_COLORS: Record<CallStatus, string> = {
  queued: "text-zinc-400",
  generating_script: "text-blue-400",
  ringing: "text-blue-400",
  busy: "text-amber-400",
  connected: "text-green-400",
  done: "text-green-500",
  failed: "text-red-500",
  skipped: "text-zinc-500",
};

export const STATUS_LABELS: Record<CallStatus, string> = {
  queued: "Queued",
  generating_script: "Generating...",
  ringing: "Ringing",
  busy: "Busy",
  connected: "Connected",
  done: "Done",
  failed: "Failed",
  skipped: "Skipped",
};

export const CAMPAIGN_STATUS_COLORS: Record<CampaignStatus, string> = {
  pending: "bg-zinc-700 text-zinc-300",
  running: "bg-blue-900 text-blue-300",
  done: "bg-green-900 text-green-300",
  stopped: "bg-amber-900 text-amber-300",
  failed: "bg-red-900 text-red-300",
};
