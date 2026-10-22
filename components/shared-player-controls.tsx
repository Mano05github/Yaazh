"use client";

import {
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useRef, useState } from "react";

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainder = String(safe % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${remainder}`
    : `${minutes}:${remainder}`;
}

function clampPosition(position: number, duration: number) {
  return Math.min(Math.max(position, 0), Math.max(duration, 0));
}

const seekKeys = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

export function SharedPlayerControls({
  playing,
  position,
  duration,
  volume,
  fullscreen,
  reactions,
  onTogglePlayback,
  onSeek,
  onVolumeChange,
  onToggleFullscreen,
  onReaction,
}: {
  playing: boolean;
  position: number;
  duration: number;
  volume: number;
  fullscreen: boolean;
  reactions: string[];
  onTogglePlayback: () => void;
  onSeek: (position: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleFullscreen: () => void;
  onReaction: (emoji: string) => void;
}) {
  const [draftPosition, setDraftPosition] = useState<number | null>(null);
  const [hoverProgress, setHoverProgress] = useState<number | null>(null);
  const draftRef = useRef<number | null>(null);
  const previousVolumeRef = useRef(volume || 72);
  const safeDuration = Math.max(duration, 1);
  const visiblePosition = clampPosition(draftPosition ?? position, safeDuration);
  const progress = (visiblePosition / safeDuration) * 100;
  const tooltipProgress = draftPosition === null ? hoverProgress : progress;
  const tooltipTime = tooltipProgress === null
    ? 0
    : (tooltipProgress / 100) * safeDuration;

  const previewSeek = useCallback((nextPosition: number) => {
    const next = clampPosition(nextPosition, safeDuration);
    draftRef.current = next;
    setDraftPosition(next);
  }, [safeDuration]);

  const commitSeek = useCallback((nextPosition?: number) => {
    const pending = nextPosition ?? draftRef.current;
    if (pending === null || !Number.isFinite(pending)) return;
    const next = clampPosition(pending, safeDuration);
    draftRef.current = null;
    setDraftPosition(null);
    onSeek(next);
  }, [onSeek, safeDuration]);

  const updateHover = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const next = ((event.clientX - bounds.left) / Math.max(bounds.width, 1)) * 100;
    setHoverProgress(Math.min(Math.max(next, 0), 100));
  };

  const toggleMute = () => {
    if (volume > 0) {
      previousVolumeRef.current = volume;
      onVolumeChange(0);
      return;
    }
    onVolumeChange(previousVolumeRef.current || 72);
  };

  return (
    <div className="yaazh-player-controls">
      <div
        className={`yaazh-seek-track ${draftPosition !== null ? "is-seeking" : ""}`}
        onPointerMove={updateHover}
        onPointerLeave={() => setHoverProgress(null)}
      >
        {tooltipProgress !== null && (
          <output
            className="yaazh-seek-tooltip"
            style={{ "--seek-tooltip": `${tooltipProgress}%` } as CSSProperties}
          >
            {formatTime(tooltipTime)}
          </output>
        )}
        <input
          className="yaazh-seek-range"
          aria-label="Shared playback position"
          aria-valuetext={`${formatTime(visiblePosition)} of ${formatTime(duration)}`}
          type="range"
          min="0"
          max={safeDuration}
          step="0.1"
          value={visiblePosition}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            previewSeek(Number(event.currentTarget.value));
          }}
          onChange={(event) => previewSeek(Number(event.currentTarget.value))}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
            commitSeek(Number(event.currentTarget.value));
          }}
          onPointerCancel={() => commitSeek()}
          onKeyUp={(event) => {
            if (seekKeys.has(event.key)) commitSeek(Number(event.currentTarget.value));
          }}
          onBlur={() => commitSeek()}
          style={{ "--seek-progress": `${progress}%` } as CSSProperties}
        />
      </div>

      <div className="yaazh-control-row">
        <div className="yaazh-control-cluster yaazh-transport-controls">
          <button type="button" className="yaazh-control-button" onClick={() => onSeek(Math.max(0, position - 10))} aria-label="Rewind 10 seconds" title="Rewind 10 seconds">
            <RotateCcw size={18} />
            <small>10</small>
          </button>
          <button type="button" className="yaazh-control-button is-primary" onClick={onTogglePlayback} aria-label={playing ? "Pause for both" : "Play for both"} title={playing ? "Pause for both" : "Play for both"}>
            {playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
          </button>
          <button type="button" className="yaazh-control-button" onClick={() => onSeek(Math.min(duration, position + 10))} aria-label="Forward 10 seconds" title="Forward 10 seconds">
            <RotateCw size={18} />
            <small>10</small>
          </button>
        </div>

        <div className="yaazh-volume-control">
          <button type="button" className="yaazh-control-button" onClick={toggleMute} aria-label={volume > 0 ? "Mute" : "Unmute"} title={volume > 0 ? "Mute" : "Unmute"}>
            {volume > 0 ? <Volume2 size={19} /> : <VolumeX size={19} />}
          </button>
          <input
            aria-label="Volume"
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(event) => {
              const nextVolume = Number(event.target.value);
              if (nextVolume > 0) previousVolumeRef.current = nextVolume;
              onVolumeChange(nextVolume);
            }}
            style={{ "--volume-progress": `${volume}%` } as CSSProperties}
          />
        </div>

        <div className="yaazh-time-readout" aria-live="off">
          <strong>{formatTime(visiblePosition)}</strong>
          <span>/</span>
          <span>{formatTime(duration)}</span>
        </div>

        <div className="yaazh-sync-state" title="Playback is synchronized through this room">
          <i />
          Together
        </div>

        <div className="yaazh-control-spacer" />

        <div className="yaazh-inline-reactions" aria-label="Send a reaction">
          {reactions.map((emoji) => (
            <button key={emoji} type="button" onClick={() => onReaction(emoji)} aria-label={`Send ${emoji} reaction`}>
              {emoji}
            </button>
          ))}
        </div>

        <button type="button" className="yaazh-control-button" onClick={onToggleFullscreen} aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"} title={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
          {fullscreen ? <Minimize2 size={19} /> : <Maximize2 size={19} />}
        </button>
      </div>
    </div>
  );
}
