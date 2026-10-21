"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type PlaybackState = {
  playing: boolean;
  position: number;
  duration: number;
  sequence: number;
  updatedAt: number;
  actorId: string;
};

type WireMessage =
  | { type: "playback"; payload: PlaybackState }
  | { type: "presence"; actorId: string; at: number }
  | { type: "reaction"; emoji: string; id: string };

const initialPlayback: PlaybackState = {
  playing: false,
  position: 38,
  duration: 247,
  sequence: 0,
  updatedAt: Date.now(),
  actorId: "local",
};

export function useDemoRoom(roomCode: string) {
  const [playback, setPlayback] = useState(initialPlayback);
  const [partnerPresent, setPartnerPresent] = useState(false);
  const [incomingReaction, setIncomingReaction] = useState<{ emoji: string; id: string } | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const actorIdRef = useRef("");
  const playbackRef = useRef(playback);

  useEffect(() => {
    playbackRef.current = playback;
  }, [playback]);

  useEffect(() => {
    const actorId = sessionStorage.getItem("yaazh-actor") ?? crypto.randomUUID();
    sessionStorage.setItem("yaazh-actor", actorId);
    actorIdRef.current = actorId;

    if (!("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel(`yaazh-demo-${roomCode}`);
    channelRef.current = channel;

    const sendPresence = () => channel.postMessage({ type: "presence", actorId, at: Date.now() } satisfies WireMessage);
    channel.onmessage = (event: MessageEvent<WireMessage>) => {
      const message = event.data;
      if (message.type === "presence" && message.actorId !== actorId) {
        setPartnerPresent(true);
        sendPresence();
      }
      if (message.type === "playback" && message.payload.actorId !== actorId) {
        const current = playbackRef.current;
        if (
          message.payload.sequence > current.sequence ||
          (message.payload.sequence === current.sequence && message.payload.updatedAt > current.updatedAt)
        ) {
          setPlayback(message.payload);
        }
      }
      if (message.type === "reaction") setIncomingReaction({ emoji: message.emoji, id: message.id });
    };

    sendPresence();
    const timer = window.setInterval(sendPresence, 4000);
    return () => {
      window.clearInterval(timer);
      channel.close();
      channelRef.current = null;
    };
  }, [roomCode]);

  const updatePlayback = useCallback((next: Partial<Pick<PlaybackState, "playing" | "position" | "duration">>) => {
    setPlayback((current) => {
      const payload: PlaybackState = {
        ...current,
        ...next,
        sequence: current.sequence + 1,
        updatedAt: Date.now(),
        actorId: actorIdRef.current,
      };
      channelRef.current?.postMessage({ type: "playback", payload } satisfies WireMessage);
      return payload;
    });
  }, []);

  const sendReaction = useCallback((emoji: string) => {
    const reaction = { emoji, id: crypto.randomUUID() };
    setIncomingReaction(reaction);
    channelRef.current?.postMessage({ type: "reaction", ...reaction } satisfies WireMessage);
  }, []);

  return { playback, updatePlayback, partnerPresent, incomingReaction, sendReaction };
}
