"use client";

import type { RealtimeChannel, User } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { YaazhMessage, YaazhRoom } from "@/lib/rooms/types";

type RoomStatus =
  | "authenticating"
  | "ready"
  | "creating"
  | "joining"
  | "connected"
  | "error";

type RoomRpcRow = {
  room_id: string;
  room_code: string;
};

type RoomMemberReadiness = {
  user_id: string;
  is_ready: boolean;
};

type BeginSignal = {
  id: string;
  startAt: string;
};

function readableError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return "Something went wrong while connecting to the room.";
}

function sortMessages(messages: YaazhMessage[]) {
  return [...messages].sort((left, right) => {
    const byTime = left.created_at.localeCompare(right.created_at);
    return byTime || left.id.localeCompare(right.id);
  });
}

export function useYaazhRoom() {
  const [status, setStatus] = useState<RoomStatus>("authenticating");
  const [user, setUser] = useState<User | null>(null);
  const [room, setRoom] = useState<YaazhRoom | null>(null);
  const [messages, setMessages] = useState<YaazhMessage[]>([]);
  const [partnerPresent, setPartnerPresent] = useState(false);
  const [ready, setReady] = useState(false);
  const [partnerReady, setPartnerReady] = useState(false);
  const [beginSignal, setBeginSignal] = useState<BeginSignal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const tabIdRef = useRef("");

  const ensureAuthenticated = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (sessionData.session?.user) {
      return sessionData.session.user;
    }

    const { data, error: signInError } = await supabase.auth.signInAnonymously();
    if (signInError) {
      throw new Error(
        `${signInError.message}. Enable Anonymous Sign-Ins in Supabase Authentication settings.`,
      );
    }
    if (!data.user) throw new Error("Supabase did not return an anonymous user.");
    return data.user;
  }, []);

  useEffect(() => {
    let active = true;
    ensureAuthenticated()
      .then((authenticatedUser) => {
        if (active) {
          setUser(authenticatedUser);
          setStatus("ready");
        }
      })
      .catch((cause) => {
        if (!active) return;
        setError(readableError(cause));
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [ensureAuthenticated]);

  useEffect(() => {
    if (!room || !user) return;

    const supabase = getSupabaseBrowserClient();
    tabIdRef.current ||= crypto.randomUUID();
    let active = true;

    const addMessage = (message: YaazhMessage) => {
      setMessages((current) => {
        if (current.some((item) => item.id === message.id)) return current;
        return sortMessages([...current, message]);
      });
    };

    const applyReadiness = (member: RoomMemberReadiness) => {
      if (member.user_id === user.id) {
        setReady(member.is_ready);
      } else {
        setPartnerReady(member.is_ready);
      }
    };

    supabase
      .from("messages")
      .select("id, room_id, sender_id, body, created_at")
      .eq("room_id", room.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error: historyError }) => {
        if (!active) return;
        if (historyError) {
          setError(historyError.message);
          return;
        }
        setMessages(sortMessages((data ?? []) as YaazhMessage[]));
      });

    supabase
      .from("room_members")
      .select("user_id, is_ready")
      .eq("room_id", room.id)
      .then(({ data, error: readinessError }) => {
        if (!active) return;
        if (readinessError) {
          setError(readinessError.message);
          return;
        }
        setPartnerReady(false);
        for (const member of (data ?? []) as RoomMemberReadiness[]) {
          applyReadiness(member);
        }
      });

    const channel = supabase
      .channel(`room:${room.id}`, {
        config: { presence: { key: tabIdRef.current } },
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => addMessage(payload.new as YaazhMessage),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "room_members",
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => applyReadiness(payload.new as RoomMemberReadiness),
      )
      .on("broadcast", { event: "begin_together" }, ({ payload }) => {
        const signal = payload as Partial<BeginSignal>;
        if (signal.id && signal.startAt) {
          setBeginSignal({ id: signal.id, startAt: signal.startAt });
        }
      })
      .on("presence", { event: "sync" }, () => {
        const presences = Object.values(channel.presenceState()).flat() as Array<{
          user_id?: string;
        }>;
        setPartnerPresent(presences.some((presence) => presence.user_id !== user.id));
      })
      .subscribe(async (subscriptionStatus) => {
        if (subscriptionStatus === "SUBSCRIBED") {
          await channel.track({
            user_id: user.id,
            tab_id: tabIdRef.current,
            online_at: new Date().toISOString(),
          });
          setStatus("connected");
        }
        if (subscriptionStatus === "CHANNEL_ERROR") {
          setError("The realtime room connection failed. Please refresh and try again.");
          setStatus("error");
        }
      });

    channelRef.current = channel;
    return () => {
      active = false;
      setPartnerPresent(false);
      setPartnerReady(false);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [room, user]);

  const createRoom = useCallback(async () => {
    setStatus("creating");
    setError(null);
    try {
      const authenticatedUser = await ensureAuthenticated();
      setUser(authenticatedUser);
      const supabase = getSupabaseBrowserClient();
      const { data, error: rpcError } = await supabase.rpc("create_room", {
        p_display_name: "Bubu",
      });
      if (rpcError) throw rpcError;
      const created = (data as RoomRpcRow[] | null)?.[0];
      if (!created) throw new Error("The room was not created.");
      const nextRoom = { id: created.room_id, code: created.room_code };
      setRoom(nextRoom);
      setStatus("connected");
      return nextRoom;
    } catch (cause) {
      const message = readableError(cause);
      setError(message);
      setStatus("error");
      throw new Error(message);
    }
  }, [ensureAuthenticated]);

  const joinRoom = useCallback(
    async (code: string) => {
      setStatus("joining");
      setError(null);
      try {
        const authenticatedUser = await ensureAuthenticated();
        setUser(authenticatedUser);
        const supabase = getSupabaseBrowserClient();
        const { data, error: rpcError } = await supabase.rpc("join_room", {
          p_room_code: code,
          p_display_name: "Dudu",
        });
        if (rpcError) throw rpcError;
        const joined = (data as RoomRpcRow[] | null)?.[0];
        if (!joined) throw new Error("The room could not be joined.");
        const nextRoom = { id: joined.room_id, code: joined.room_code };
        setRoom(nextRoom);
        setStatus("connected");
        return nextRoom;
      } catch (cause) {
        const message = readableError(cause);
        setError(message);
        setStatus("error");
        throw new Error(message);
      }
    },
    [ensureAuthenticated],
  );

  const sendMessage = useCallback(
    async (body: string) => {
      const trimmed = body.trim();
      if (!room || !user || !trimmed) return false;
      const message: YaazhMessage = {
        id: crypto.randomUUID(),
        room_id: room.id,
        sender_id: user.id,
        body: trimmed.slice(0, 1000),
        created_at: new Date().toISOString(),
      };
      setMessages((current) => sortMessages([...current, message]));
      const { data: storedMessage, error: insertError } = await getSupabaseBrowserClient()
        .from("messages")
        .insert({
          id: message.id,
          room_id: message.room_id,
          sender_id: message.sender_id,
          body: message.body,
        })
        .select("id, room_id, sender_id, body, created_at")
        .single();
      if (insertError) {
        setMessages((current) => current.filter((item) => item.id !== message.id));
        setError(insertError.message);
        return false;
      }
      setMessages((current) =>
        sortMessages(
          current.map((item) =>
            item.id === message.id ? (storedMessage as YaazhMessage) : item,
          ),
        ),
      );
      return true;
    },
    [room, user],
  );

  const setRoomReady = useCallback(
    async (nextReady: boolean) => {
      if (!room || !user) return false;

      const previousReady = ready;
      setReady(nextReady);
      const { error: updateError } = await getSupabaseBrowserClient()
        .from("room_members")
        .update({ is_ready: nextReady })
        .eq("room_id", room.id)
        .eq("user_id", user.id);

      if (updateError) {
        setReady(previousReady);
        setError(updateError.message);
        return false;
      }
      return true;
    },
    [ready, room, user],
  );

  const beginTogether = useCallback(async () => {
    const channel = channelRef.current;
    if (!channel || !room || !user || !ready || !partnerReady || !partnerPresent) {
      return false;
    }

    const signal: BeginSignal = {
      id: crypto.randomUUID(),
      startAt: new Date(Date.now() + 3000).toISOString(),
    };
    setBeginSignal(signal);

    const result = await channel.send({
      type: "broadcast",
      event: "begin_together",
      payload: signal,
    });
    if (result !== "ok") {
      setError("The shared start signal could not be sent. Please try again.");
      return false;
    }
    return true;
  }, [partnerPresent, partnerReady, ready, room, user]);

  const clearError = useCallback(() => setError(null), []);

  return {
    status,
    user,
    room,
    messages,
    partnerPresent,
    ready,
    partnerReady,
    beginSignal,
    error,
    createRoom,
    joinRoom,
    sendMessage,
    setReady: setRoomReady,
    beginTogether,
    clearError,
  };
}
