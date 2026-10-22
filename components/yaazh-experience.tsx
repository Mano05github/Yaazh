"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  Heart,
  Link2,
  MessageCircle,
  Play,
  Plus,
  Send,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { MascotPair, MascotScene } from "./mascot";
import { RoomCatalogPicker } from "./room-catalog-picker";
import { RoomLibrary } from "./room-library";
import { SharedPlayerControls } from "./shared-player-controls";
import { YouTubeRoomPlayer } from "./youtube-room-player";
import { useDemoRoom } from "@/hooks/use-demo-room";
import { useYaazhRoom } from "@/hooks/use-yaazh-room";
import type {
  PlaybackCommand,
  YaazhMessage,
  YaazhPlaybackState,
} from "@/lib/rooms/types";
import type { CatalogItem } from "@/lib/catalog/types";

export type Screen = "landing" | "invite" | "lobby" | "library" | "player";
type LocalMedia = { name: string; url: string; type: "audio" | "video" } | null;

const demoRoomCode = "MOON-27";
const reactions = ["♥", "🥹", "😂", "🫶"];

export function YaazhExperience({
  initialScreen = "landing",
  initialRoomCode,
}: {
  initialScreen?: Screen;
  initialRoomCode?: string;
}) {
  const liveRoom = useYaazhRoom();
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [joinMode, setJoinMode] = useState(Boolean(initialRoomCode));
  const [joinCode, setJoinCode] = useState(initialRoomCode ?? "");
  const [roomCode, setRoomCode] = useState(initialRoomCode ?? demoRoomCode);
  const [copied, setCopied] = useState(false);
  const [demoReady, setDemoReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [localMedia, setLocalMedia] = useState<LocalMedia>(null);
  const lastBeginSignalRef = useRef<string | null>(null);
  const libraryPlaybackVersionRef = useRef(0);
  const ready = liveRoom.room ? liveRoom.ready : demoReady;
  const partnerPresent = liveRoom.room ? liveRoom.partnerPresent : initialScreen === "lobby";
  const partnerReady = liveRoom.room
    ? liveRoom.partnerPresent && liveRoom.partnerReady
    : initialScreen === "lobby";

  const openLibrary = useCallback(() => {
    libraryPlaybackVersionRef.current = liveRoom.playback?.version ?? 0;
    setScreen("library");
  }, [liveRoom.playback?.version]);

  useEffect(() => {
    return () => {
      if (localMedia?.url) URL.revokeObjectURL(localMedia.url);
    };
  }, [localMedia]);

  const createRoom = async () => {
    try {
      const created = await liveRoom.createRoom();
      setRoomCode(created.code);
      setJoinMode(false);
      window.history.replaceState({}, "", `/?room=${encodeURIComponent(created.code)}`);
      setScreen("invite");
    } catch {
      // The hook exposes the actionable error in the room notice.
    }
  };

  const joinRoom = async () => {
    if (!joinCode.trim()) return;
    try {
      const joined = await liveRoom.joinRoom(joinCode);
      setRoomCode(joined.code);
      window.history.replaceState({}, "", `/?room=${encodeURIComponent(joined.code)}`);
      setScreen("lobby");
    } catch {
      // The hook exposes the actionable error in the room notice.
    }
  };

  const enterLobby = () => {
    setScreen("lobby");
  };

  const copyInvite = async () => {
    const link = `${window.location.origin}/?room=${roomCode}`;
    await navigator.clipboard?.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const beginTogether = () => {
    if (!ready || !partnerReady) return;
    if (liveRoom.room) {
      void liveRoom.beginTogether();
      return;
    }
    setCountdown(3);
  };

  useEffect(() => {
    const signal = liveRoom.beginSignal;
    if (!signal || lastBeginSignalRef.current === signal.id) return;
    lastBeginSignalRef.current = signal.id;
    setCountdown(Math.max(0, Math.ceil((Date.parse(signal.startAt) - Date.now()) / 1000)));
  }, [liveRoom.beginSignal]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      const timeout = window.setTimeout(() => {
        setCountdown(null);
        openLibrary();
      }, 900);
      return () => window.clearTimeout(timeout);
    }
    const timeout = window.setTimeout(() => setCountdown((value) => (value ?? 1) - 1), 900);
    return () => window.clearTimeout(timeout);
  }, [countdown, openLibrary]);

  useEffect(() => {
    const playbackState = liveRoom.playback;
    if (screen !== "library" || !playbackState) return;
    if (playbackState.version <= libraryPlaybackVersionRef.current) return;
    libraryPlaybackVersionRef.current = playbackState.version;
    if (playbackState.updated_by === liveRoom.user?.id) return;
    if (playbackState.media_source !== "youtube" && playbackState.media_source !== "local") return;
    const timer = window.setTimeout(() => setScreen("player"), 0);
    return () => window.clearTimeout(timer);
  }, [liveRoom.playback, liveRoom.user?.id, screen]);

  const selectCatalogItem = (item: CatalogItem) => {
    void liveRoom.updatePlayback({
      mediaId: item.id,
      mediaTitle: item.title,
      mediaSource: "youtube",
      mediaThumbnail: item.thumbnail,
      durationMs: item.durationSeconds === null ? undefined : item.durationSeconds * 1000,
      playing: false,
      positionMs: 0,
    }).then((selected) => {
      if (selected) setScreen("player");
    });
  };

  const chooseMedia = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (localMedia?.url) URL.revokeObjectURL(localMedia.url);
    setLocalMedia({
      name: file.name,
      url: URL.createObjectURL(file),
      type: file.type.startsWith("video") ? "video" : "audio",
    });
    if (liveRoom.room) {
      void liveRoom.updatePlayback({
        mediaId: `local:${file.name}:${file.size}`,
        mediaTitle: file.name,
        mediaSource: "local",
        playing: false,
        positionMs: 0,
      });
    }
  };

  return (
    <main className="app-shell">
      <Atmosphere />
      <Header screen={screen} onLogoClick={() => setScreen("landing")} />

      <AnimatePresence>
        {liveRoom.error && (
          <motion.div className="room-notice" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert">
            <span>{liveRoom.error}</span>
            <button onClick={liveRoom.clearError} aria-label="Dismiss room error"><X size={15} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="sync">
        {screen === "landing" && (
          <Landing
            key="landing"
            joinMode={joinMode}
            joinCode={joinCode}
            onJoinMode={() => setJoinMode(true)}
            onJoinCode={setJoinCode}
            onJoin={joinRoom}
            onCancelJoin={() => setJoinMode(false)}
            onCreate={createRoom}
          />
        )}
        {screen === "invite" && (
          <Invite key="invite" roomCode={roomCode} copied={copied} onCopy={copyInvite} onBack={() => setScreen("landing")} onEnter={enterLobby} />
        )}
        {screen === "lobby" && (
          <Lobby
            key="lobby"
            roomCode={roomCode}
            ready={ready}
            partnerPresent={partnerPresent}
            partnerReady={partnerReady}
            onReady={() => {
              if (liveRoom.room) {
                void liveRoom.setReady(!ready);
              } else {
                setDemoReady((value) => !value);
              }
            }}
            onBegin={beginTogether}
            onBack={() => setScreen("invite")}
          />
        )}
        {screen === "library" && liveRoom.room && (
          <RoomLibrary
            key="library"
            roomId={liveRoom.room.id}
            roomCode={roomCode}
            partnerPresent={liveRoom.partnerPresent}
            onBack={() => setScreen("lobby")}
            onSelect={selectCatalogItem}
          />
        )}
        {screen === "player" && (
          <Player
            key="player"
            localMedia={localMedia}
            onChooseMedia={chooseMedia}
            chatOpen={chatOpen}
            onChat={() => setChatOpen((value) => !value)}
            onLeave={openLibrary}
            roomId={liveRoom.room?.id ?? null}
            roomCode={roomCode}
            roomPartnerPresent={liveRoom.partnerPresent}
            roomPlayback={liveRoom.room && liveRoom.playback ? {
              state: liveRoom.playback,
              update: liveRoom.updatePlayback,
            } : undefined}
            roomChat={liveRoom.room ? {
                messages: liveRoom.messages,
                currentUserId: liveRoom.user?.id ?? null,
                sendMessage: liveRoom.sendMessage,
              } : undefined}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>{countdown !== null && <Countdown value={countdown} />}</AnimatePresence>
    </main>
  );
}

function Atmosphere() {
  return (
    <div className="atmosphere" aria-hidden="true">
      <div className="aurora aurora-one" />
      <div className="aurora aurora-two" />
      <div className="moon-glow" />
      <div className="stars stars-one" />
      <div className="stars stars-two" />
      <div className="grain" />
    </div>
  );
}

function Header({ screen, onLogoClick }: { screen: Screen; onLogoClick: () => void }) {
  return (
    <header className="site-header">
      <button className="brand" onClick={onLogoClick} aria-label="Go home">
        <span className="brand-mark">யா</span>
        <span>Yaazh</span>
      </button>
      <div className="header-status">
        <span className="status-dot" />
        {screen === "landing" ? "A private place for two" : "Private room"}
      </div>
    </header>
  );
}

type LandingProps = {
  joinMode: boolean;
  joinCode: string;
  onJoinMode: () => void;
  onJoinCode: (value: string) => void;
  onJoin: () => void;
  onCancelJoin: () => void;
  onCreate: () => void;
};

function Landing(props: LandingProps) {
  return (
    <motion.section className="screen landing" initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -18 }}>
      <div className="hero-copy">
        <motion.div className="eyebrow" initial={false} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Sparkles size={14} /> Made for your favourite person
        </motion.div>
        <motion.h1 initial={false} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.9 }}>
          Miles apart.
          <span>One moment.</span>
        </motion.h1>
        <motion.p initial={false} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}>
          Listen, watch, laugh and stay in the same second—wherever the two of you are.
        </motion.p>

        <AnimatePresence mode="wait">
          {!props.joinMode ? (
            <motion.div className="hero-actions" key="actions" initial={false} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <button className="button button-primary" onClick={props.onCreate}>
                Create our room <Heart size={17} fill="currentColor" />
              </button>
              <button className="button button-ghost" onClick={props.onJoinMode}>
                I have an invite <ChevronRight size={17} />
              </button>
            </motion.div>
          ) : (
            <motion.div className="join-card" key="join" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <label htmlFor="room-code">Enter your private room code</label>
              <div className="join-row">
                <input
                  id="room-code"
                  value={props.joinCode}
                  onChange={(event) => props.onJoinCode(event.target.value.toUpperCase())}
                  placeholder="MOON-27"
                  autoFocus
                />
                <button className="button button-primary button-square" onClick={props.onJoin} aria-label="Join room">
                  <ChevronRight size={19} />
                </button>
              </div>
              <button className="text-button" onClick={props.onCancelJoin}>Never mind</button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="trust-row">
          <span><UsersRound size={14} /> Only two people</span>
          <span><Link2 size={14} /> Private invite</span>
          <span><Clock3 size={14} /> Always in sync</span>
        </div>
      </div>

      <div className="hero-art">
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <div className="hero-photo-frame">
          <MascotScene scene="sunset" className="hero-main-scene" priority sizes="(max-width: 920px) 72vw, 430px" />
          <span className="hero-photo-label">Bubu + Dudu · our little sky</span>
        </div>
        <MascotScene scene="apart" className="hero-polaroid" priority sizes="(max-width: 620px) 34vw, 170px" />
        <div className="heart-trail" aria-hidden="true"><span>♥</span><span>♥</span><span>♥</span></div>
        <div className="art-caption">Apart for now. Together in the moment.</div>
      </div>
    </motion.section>
  );
}

function Invite({ roomCode, copied, onCopy, onBack, onEnter }: { roomCode: string; copied: boolean; onCopy: () => void; onBack: () => void; onEnter: () => void }) {
  return (
    <motion.section className="screen centered-screen" initial={false} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
      <button className="back-button" onClick={onBack}><ArrowLeft size={17} /> Back</button>
      <div className="invite-layout">
        <div className="letter-wrap">
          <div className="letter-shadow" />
          <motion.div className="love-letter" initial={{ rotate: -3, scale: 0.92 }} animate={{ rotate: -1, scale: 1 }} transition={{ type: "spring", stiffness: 110 }}>
            <span className="letter-kicker">A little invitation</span>
            <h2>Come spend this moment with me.</h2>
            <p>I saved you a seat beneath our sky.</p>
            <div className="room-code"><span>Our room</span><strong>{roomCode}</strong></div>
            <div className="letter-sign">— your person ♥</div>
          </motion.div>
          <MascotScene scene="kiss" className="letter-mascot" sizes="(max-width: 620px) 125px, 170px" />
        </div>
        <div className="invite-copy">
          <div className="eyebrow"><Send size={14} /> Your room is ready</div>
          <h1>Send a little piece of tonight.</h1>
          <p>This link is the key. Share it only with the person you want beside you.</p>
          <button className="button button-primary wide-button" onClick={onCopy}>
            {copied ? <><Check size={18} /> Invite copied</> : <><Copy size={18} /> Copy private invitation</>}
          </button>
          <button className="button button-ghost wide-button" onClick={onEnter}>Enter our room <ChevronRight size={18} /></button>
          <div className="privacy-note"><span className="status-dot" /> Private realtime room · only two participants</div>
        </div>
      </div>
    </motion.section>
  );
}

function Lobby({ roomCode, ready, partnerPresent, partnerReady, onReady, onBegin, onBack }: { roomCode: string; ready: boolean; partnerPresent: boolean; partnerReady: boolean; onReady: () => void; onBegin: () => void; onBack: () => void }) {
  return (
    <motion.section className="screen centered-screen" initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <button className="back-button" onClick={onBack}><ArrowLeft size={17} /> Invitation</button>
      <div className="lobby-heading">
        <div className="eyebrow"><span className="status-dot" /> Room {roomCode}</div>
        <h1>{partnerPresent ? "You found each other." : "Waiting beneath the same sky…"}</h1>
        <p>{partnerPresent ? "When you are both ready, begin the moment together." : "Keep this page open. Your person is on the way."}</p>
      </div>
      <MascotPair joined={partnerPresent} />
      <div className="presence-grid">
        <div className={`presence-card ${ready ? "is-ready" : ""}`}>
          <div className="presence-avatar panda-avatar">B</div>
          <div><strong>You</strong><span>{ready ? "Ready for tonight" : "Take your time"}</span></div>
          <span className="presence-state">{ready ? <Check size={15} /> : "…"}</span>
        </div>
        <div className={`presence-card ${partnerReady ? "is-ready" : ""}`}>
          <div className="presence-avatar bear-avatar">D</div>
          <div><strong>Your person</strong><span>{partnerReady ? "Ready and waiting" : partnerPresent ? "Here, getting ready" : "Joining soon"}</span></div>
          <span className="presence-state">{partnerReady ? <Check size={15} /> : "…"}</span>
        </div>
      </div>
      <div className="lobby-actions">
        <button className={`button ${ready ? "button-ghost" : "button-primary"}`} onClick={onReady}>
          {ready ? <><Check size={18} /> I’m ready</> : <>I’m ready <Heart size={17} /></>}
        </button>
        <button className="button button-primary" onClick={onBegin} disabled={!ready || !partnerReady}>
          Begin together <Play size={17} fill="currentColor" />
        </button>
      </div>
    </motion.section>
  );
}

function Countdown({ value }: { value: number }) {
  return (
    <motion.div className="countdown-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <MascotPair joined />
      <AnimatePresence mode="wait">
        <motion.div
          key={value}
          className={`countdown-value ${value === 0 ? "is-together" : ""}`}
          initial={{ opacity: 0, scale: 0.65, filter: "blur(12px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 1.35, filter: "blur(8px)" }}
          transition={{ duration: 0.45 }}
        >
          {value === 0 ? "Together" : value}
        </motion.div>
      </AnimatePresence>
      <p>One little moment, shared.</p>
    </motion.div>
  );
}

type PlayerProps = {
  localMedia: LocalMedia;
  onChooseMedia: (event: ChangeEvent<HTMLInputElement>) => void;
  chatOpen: boolean;
  onChat: () => void;
  onLeave: () => void;
  roomId: string | null;
  roomCode: string;
  roomPartnerPresent: boolean;
  roomPlayback?: {
    state: YaazhPlaybackState;
    update: (command: PlaybackCommand) => Promise<boolean>;
  };
  roomChat?: {
    messages: YaazhMessage[];
    currentUserId: string | null;
    sendMessage: (body: string) => Promise<boolean>;
  };
};

function Player({ localMedia, onChooseMedia, chatOpen, onChat, onLeave, roomId, roomCode, roomPartnerPresent, roomPlayback, roomChat }: PlayerProps) {
  const { playback: demoPlayback, updatePlayback: updateDemoPlayback, partnerPresent: demoPartnerPresent, incomingReaction, sendReaction } = useDemoRoom(roomCode);
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const playerStageRef = useRef<HTMLDivElement | null>(null);
  const [volume, setVolume] = useState(72);
  const [fullscreen, setFullscreen] = useState(false);
  const [playbackClock, setPlaybackClock] = useState(0);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [demoMessages, setDemoMessages] = useState(["Made it ♥", "This one is ours."]);
  const partnerPresent = roomPartnerPresent || demoPartnerPresent;
  const livePlayback = roomPlayback?.state;
  const effectiveTime = livePlayback?.effective_at ? Date.parse(livePlayback.effective_at) : 0;
  const livePosition = livePlayback
    ? livePlayback.position_ms / 1000 + (livePlayback.playing ? Math.max(0, playbackClock - effectiveTime) / 1000 : 0)
    : null;
  const playback = livePlayback ? {
    playing: livePlayback.playing,
    position: Math.min(livePosition ?? 0, (livePlayback.duration_ms ?? Number.MAX_SAFE_INTEGER) / 1000),
    duration: (livePlayback.duration_ms ?? 0) / 1000,
  } : demoPlayback;
  const youtubeId = livePlayback?.media_source === "youtube" ? livePlayback.media_id : null;

  const updatePlayback = useCallback((next: Partial<Pick<typeof playback, "playing" | "position" | "duration">>) => {
    if (roomPlayback) {
      const command: PlaybackCommand = {};
      if (next.playing !== undefined) command.playing = next.playing;
      if (next.position !== undefined) command.positionMs = Math.max(0, Math.round(next.position * 1000));
      if (next.duration !== undefined) command.durationMs = Math.max(0, Math.round(next.duration * 1000));
      void roomPlayback.update(command);
      return;
    }
    updateDemoPlayback(next);
  }, [roomPlayback, updateDemoPlayback]);

  useEffect(() => {
    if (!livePlayback?.playing) return;
    const timer = window.setInterval(() => setPlaybackClock(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [livePlayback?.playing]);

  useEffect(() => {
    const updateFullscreenState = () => {
      setFullscreen(document.fullscreenElement === playerStageRef.current);
    };
    document.addEventListener("fullscreenchange", updateFullscreenState);
    return () => document.removeEventListener("fullscreenchange", updateFullscreenState);
  }, []);

  useEffect(() => {
    if (roomPlayback) return;
    if (localMedia) return;
    if (!playback.playing) return;
    const timer = window.setInterval(() => {
      updatePlayback({ position: Math.min(playback.duration, playback.position + 1) });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [localMedia, playback.duration, playback.playing, playback.position, roomPlayback, updatePlayback]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !localMedia) return;
    if (Math.abs(media.currentTime - playback.position) > 0.8) media.currentTime = playback.position;
    if (playback.playing && media.paused) media.play().catch(() => updatePlayback({ playing: false }));
    if (!playback.playing && !media.paused) media.pause();
  }, [localMedia, playback.playing, playback.position, updatePlayback]);

  useEffect(() => {
    if (mediaRef.current) mediaRef.current.volume = volume / 100;
  }, [localMedia, volume]);

  const togglePlayback = () => {
    const position = mediaRef.current?.currentTime ?? playback.position;
    updatePlayback({ playing: !playback.playing, position });
  };

  const seek = (position: number) => {
    if (mediaRef.current) mediaRef.current.currentTime = position;
    updatePlayback({ position });
  };

  const toggleFullscreen = async () => {
    const stage = playerStageRef.current;
    if (!stage) return;
    try {
      if (document.fullscreenElement === stage) {
        await document.exitFullscreen();
        return;
      }
      await stage.requestFullscreen();
    } catch {
      setFullscreen(false);
    }
  };

  const changeVolume = (nextVolume: number) => {
    const normalizedVolume = Math.min(Math.max(nextVolume, 0), 100);
    setVolume(normalizedVolume);
    if (mediaRef.current) mediaRef.current.volume = normalizedVolume / 100;
  };

  const title = livePlayback?.media_title ?? localMedia?.name ?? "Until We Meet Again";
  const duration = playback.duration;
  const position = playback.position;

  const sendMessage = async () => {
    const nextMessage = message.trim();
    if (!nextMessage) return;
    if (roomChat) {
      const sent = await roomChat.sendMessage(nextMessage);
      if (sent) setMessage("");
      return;
    }
    setDemoMessages((items) => [...items, nextMessage]);
    setMessage("");
  };

  return (
    <motion.section className="player-screen" initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="player-topbar">
        <button className="icon-button" onClick={onLeave} aria-label="Leave player"><ArrowLeft size={19} /></button>
        <div className="together-indicator">
          <span className="avatar-stack"><i>B</i><i>D</i></span>
          <div><strong>{partnerPresent ? "Together now" : "Together in demo"}</strong><span>{partnerPresent ? "Second tab connected" : "Open another tab to test sync"}</span></div>
        </div>
        <button className="icon-button" onClick={onChat} aria-label="Open chat"><MessageCircle size={19} /></button>
      </div>

      <div className="player-stage" ref={playerStageRef}>
        <div className="ambient-disc disc-one" />
        <div className="ambient-disc disc-two" />
        {youtubeId ? (
          <YouTubeRoomPlayer
            key={youtubeId}
            videoId={youtubeId}
            playing={playback.playing}
            position={playback.position}
            version={livePlayback?.version ?? 0}
            volume={volume}
            onPlaybackChange={(nextPlaying, nextPosition) => updatePlayback({ playing: nextPlaying, position: nextPosition })}
            onDuration={(nextDuration) => {
              if (nextDuration > 0 && Math.abs(nextDuration - playback.duration) > 1) {
                updatePlayback({ duration: nextDuration });
              }
            }}
          />
        ) : localMedia?.type === "video" ? (
          <video
            ref={(element) => { mediaRef.current = element; }}
            className="local-video"
            src={localMedia.url}
            playsInline
            onLoadedMetadata={(event) => updatePlayback({ duration: event.currentTarget.duration })}
            onTimeUpdate={(event) => {
              if (!roomPlayback && Math.floor(event.currentTarget.currentTime) !== Math.floor(playback.position)) {
                updatePlayback({ position: event.currentTarget.currentTime });
              }
            }}
          />
        ) : (
          <div className="album-scene">
            <div className="album-glow" />
            <motion.div className={`album-art ${playback.playing ? "is-playing" : ""}`} animate={{ rotate: playback.playing ? 360 : 0 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }}>
              <MascotScene scene="cuddle" className="album-mascot-scene" sizes="(max-width: 620px) 48vw, 220px" />
              <span>our little sky</span>
            </motion.div>
            {localMedia?.type === "audio" && (
              <audio
                ref={(element) => { mediaRef.current = element; }}
                src={localMedia.url}
                onLoadedMetadata={(event) => updatePlayback({ duration: event.currentTarget.duration })}
              />
            )}
          </div>
        )}

        <AnimatePresence>
          {incomingReaction && (
            <motion.div key={incomingReaction.id} className="floating-reaction" initial={{ opacity: 0, y: 40, scale: 0.6 }} animate={{ opacity: 1, y: -120, scale: 1.25 }} exit={{ opacity: 0 }} transition={{ duration: 2.2 }}>
              {incomingReaction.emoji}
            </motion.div>
          )}
        </AnimatePresence>

        <SharedPlayerControls
          playing={playback.playing}
          position={position}
          duration={duration}
          volume={volume}
          fullscreen={fullscreen}
          reactions={reactions}
          onTogglePlayback={togglePlayback}
          onSeek={seek}
          onVolumeChange={changeVolume}
          onToggleFullscreen={() => void toggleFullscreen()}
          onReaction={sendReaction}
        />
      </div>

      <div className="now-playing">
        <div className="track-copy"><span>PLAYING FOR TWO</span><h2>{title}</h2><p>{youtubeId ? "YouTube · selected for this room" : localMedia ? "From your device" : "Demo soundtrack · Bubu & Dudu"}</p></div>
        <div className="media-actions">
          {roomPlayback && <button className="button button-primary" onClick={() => setCatalogOpen(true)}><Play size={16} /> Browse together</button>}
          <label className="add-media button button-ghost"><Plus size={17} /> Choose media<input type="file" accept="audio/*,video/mp4,video/webm" onChange={onChooseMedia} /></label>
        </div>
      </div>

      <AnimatePresence>
        {chatOpen && (
          <motion.aside className="chat-drawer" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 260 }}>
            <div className="chat-header"><div><span>Just between us</span><strong>Tonight’s whispers</strong></div><button className="icon-button" onClick={onChat}><X size={18} /></button></div>
            <div className="chat-messages">
              <div className="chat-day">Tonight</div>
              {roomChat
                ? roomChat.messages.map((item) => {
                    const mine = item.sender_id === roomChat.currentUserId;
                    return <div key={item.id} className={`chat-message ${mine ? "mine" : "theirs"}`}>{item.body}<span>{mine ? "You" : "Your person"}</span></div>;
                  })
                : demoMessages.map((item, index) => <div key={`${item}-${index}`} className={`chat-message ${index % 2 ? "mine" : "theirs"}`}>{item}<span>{index % 2 ? "You" : "Dudu"}</span></div>)}
            </div>
            <div className="chat-compose"><input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void sendMessage(); }} placeholder="Say something soft…" /><button onClick={() => void sendMessage()}><Send size={17} /></button></div>
          </motion.aside>
        )}
      </AnimatePresence>

      {catalogOpen && roomPlayback && roomId && (
        <RoomCatalogPicker
          roomId={roomId}
          onClose={() => setCatalogOpen(false)}
          onSelect={(item) => {
            void roomPlayback.update({
              mediaId: item.id,
              mediaTitle: item.title,
              mediaSource: "youtube",
              mediaThumbnail: item.thumbnail,
              durationMs: item.durationSeconds === null ? undefined : item.durationSeconds * 1000,
              playing: false,
              positionMs: 0,
            });
            setCatalogOpen(false);
          }}
        />
      )}
    </motion.section>
  );
}
