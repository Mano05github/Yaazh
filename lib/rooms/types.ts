export type YaazhRoom = {
  id: string;
  code: string;
};

export type YaazhMessage = {
  id: string;
  room_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type RoomMember = {
  room_id: string;
  user_id: string;
  display_name: string;
  role: "owner" | "member";
  joined_at: string;
};

export type YaazhPlaybackState = {
  room_id: string;
  media_id: string | null;
  media_title: string | null;
  media_source: "demo" | "youtube" | "local";
  media_thumbnail: string | null;
  playing: boolean;
  position_ms: number;
  duration_ms: number | null;
  version: number;
  effective_at: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type PlaybackCommand = {
  mediaId?: string;
  mediaTitle?: string;
  mediaSource?: YaazhPlaybackState["media_source"];
  mediaThumbnail?: string;
  playing?: boolean;
  positionMs?: number;
  durationMs?: number;
};
