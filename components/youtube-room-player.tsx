"use client";

import { useEffect, useRef, useState } from "react";

type PlayerStateChange = { data: number };

type YouTubePlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (volume: number) => void;
};

type YouTubeApi = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      playerVars: Record<string, number | string>;
      events: {
        onReady: () => void;
        onStateChange: (event: PlayerStateChange) => void;
      };
    },
  ) => YouTubePlayer;
  PlayerState: {
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
  };
};

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<YouTubeApi> | null = null;

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise<YouTubeApi>((resolve) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      if (window.YT) resolve(window.YT);
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }
  });
  return youtubeApiPromise;
}

export function YouTubeRoomPlayer({
  videoId,
  playing,
  position,
  version,
  volume,
  onPlaybackChange,
  onDuration,
}: {
  videoId: string;
  playing: boolean;
  position: number;
  version: number;
  volume: number;
  onPlaybackChange: (playing: boolean, position: number) => void;
  onDuration: (duration: number) => void;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const suppressEventsUntilRef = useRef(0);
  const positionRef = useRef(position);
  const latestRef = useRef({ playing, onPlaybackChange, onDuration });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    latestRef.current = { playing, onPlaybackChange, onDuration };
  }, [onDuration, onPlaybackChange, playing]);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    let active = true;
    const mount = mountRef.current;
    if (!mount) return;

    loadYouTubeApi().then((api) => {
      if (!active) return;
      playerRef.current = new api.Player(mount, {
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          enablejsapi: 1,
          fs: 0,
          playsinline: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            if (!active) return;
            setReady(true);
            const player = playerRef.current;
            if (player) latestRef.current.onDuration(player.getDuration());
          },
          onStateChange: (event) => {
            const player = playerRef.current;
            if (!player || Date.now() < suppressEventsUntilRef.current) return;
            const isPlaying = event.data === api.PlayerState.PLAYING;
            const isPaused = event.data === api.PlayerState.PAUSED || event.data === api.PlayerState.ENDED;
            if ((isPlaying || isPaused) && isPlaying !== latestRef.current.playing) {
              latestRef.current.onPlaybackChange(isPlaying, player.getCurrentTime());
            }
          },
        },
      });
    });

    return () => {
      active = false;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [videoId]);

  useEffect(() => {
    const player = playerRef.current;
    if (!ready || !player) return;

    suppressEventsUntilRef.current = Date.now() + 900;
    const targetPosition = positionRef.current;
    if (Math.abs(player.getCurrentTime() - targetPosition) > 1.25) {
      player.seekTo(targetPosition, true);
    }
    const playerState = player.getPlayerState();
    if (playing && playerState !== window.YT?.PlayerState.PLAYING) player.playVideo();
    if (!playing && playerState === window.YT?.PlayerState.PLAYING) player.pauseVideo();
  }, [playing, ready, version]);

  useEffect(() => {
    if (!ready) return;

    const timer = window.setInterval(() => {
      const player = playerRef.current;
      if (!player || Date.now() < suppressEventsUntilRef.current) return;

      const targetPosition = positionRef.current;
      const drift = Math.abs(player.getCurrentTime() - targetPosition);
      const tolerance = latestRef.current.playing ? 1.75 : 0.65;
      if (drift <= tolerance) return;

      suppressEventsUntilRef.current = Date.now() + 900;
      player.seekTo(targetPosition, true);
    }, 800);

    return () => window.clearInterval(timer);
  }, [ready]);

  useEffect(() => {
    if (ready) playerRef.current?.setVolume(volume);
  }, [ready, volume]);

  return <div className="youtube-room-player" ref={mountRef} />;
}
