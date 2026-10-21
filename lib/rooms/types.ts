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
