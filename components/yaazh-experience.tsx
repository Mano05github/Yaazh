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
  Pause,
  Play,
  Plus,
  Send,
  SkipForward,
  Sparkles,
  UsersRound,
  Volume2,
  X,
} from "lucide-react";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { MascotPair, MascotScene } from "./mascot";
import { useDemoRoom } from "@/hooks/use-demo-room";

export type Screen = "landing" | "invite" | "lobby" | "player";
type LocalMedia = { name: string; url: string; type: "audio" | "video" } | null;

const roomCode = "MOON-27";
const reactions = ["♥", "🥹", "😂", "🫶"];

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export function YaazhExperience({ initialScreen = "landing" }: { initialScreen?: Screen }) {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [joinMode, setJoinMode] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [ready, setReady] = useState(false);
  const [partnerReady, setPartnerReady] = useState(initialScreen === "lobby");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [localMedia, setLocalMedia] = useState<LocalMedia>(null);

  useEffect(() => {
    return () => {
      if (localMedia?.url) URL.revokeObjectURL(localMedia.url);
    };
  }, [localMedia]);

  const createRoom = () => {
    setJoinMode(false);
    setScreen("invite");
  };

  const joinRoom = () => {
    if (!joinCode.trim()) return;
    setScreen("lobby");
    window.setTimeout(() => setPartnerReady(true), 1200);
  };

  const enterLobby = () => {
    setScreen("lobby");
    window.setTimeout(() => setPartnerReady(true), 1500);
  };

  const copyInvite = async () => {
    const link = `${window.location.origin}/?room=${roomCode}`;
    await navigator.clipboard?.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const beginTogether = () => {
    if (!ready) return;
    setCountdown(3);
  };

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      const timeout = window.setTimeout(() => {
        setCountdown(null);
        setScreen("player");
      }, 900);
      return () => window.clearTimeout(timeout);
    }
    const timeout = window.setTimeout(() => setCountdown((value) => (value ?? 1) - 1), 900);
    return () => window.clearTimeout(timeout);
  }, [countdown]);

  const chooseMedia = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (localMedia?.url) URL.revokeObjectURL(localMedia.url);
    setLocalMedia({
      name: file.name,
      url: URL.createObjectURL(file),
      type: file.type.startsWith("video") ? "video" : "audio",
    });
  };

  return (
    <main className="app-shell">
      <Atmosphere />
      <Header screen={screen} onLogoClick={() => setScreen("landing")} />

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
          <Invite key="invite" copied={copied} onCopy={copyInvite} onBack={() => setScreen("landing")} onEnter={enterLobby} />
        )}
        {screen === "lobby" && (
          <Lobby
            key="lobby"
            ready={ready}
            partnerReady={partnerReady}
            onReady={() => setReady((value) => !value)}
            onBegin={beginTogether}
            onBack={() => setScreen("invite")}
          />
        )}
        {screen === "player" && (
          <Player
            key="player"
            localMedia={localMedia}
            onChooseMedia={chooseMedia}
            chatOpen={chatOpen}
            onChat={() => setChatOpen((value) => !value)}
            onLeave={() => setScreen("lobby")}
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

function Invite({ copied, onCopy, onBack, onEnter }: { copied: boolean; onCopy: () => void; onBack: () => void; onEnter: () => void }) {
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
          <div className="privacy-note"><span className="status-dot" /> Demo room · realtime credentials not connected yet</div>
        </div>
      </div>
    </motion.section>
  );
}

function Lobby({ ready, partnerReady, onReady, onBegin, onBack }: { ready: boolean; partnerReady: boolean; onReady: () => void; onBegin: () => void; onBack: () => void }) {
  return (
    <motion.section className="screen centered-screen" initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <button className="back-button" onClick={onBack}><ArrowLeft size={17} /> Invitation</button>
      <div className="lobby-heading">
        <div className="eyebrow"><span className="status-dot" /> Room {roomCode}</div>
        <h1>{partnerReady ? "You found each other." : "Waiting beneath the same sky…"}</h1>
        <p>{partnerReady ? "When you are both ready, begin the moment together." : "Keep this page open. Your person is on the way."}</p>
      </div>
      <MascotPair joined={partnerReady} />
      <div className="presence-grid">
        <div className={`presence-card ${ready ? "is-ready" : ""}`}>
          <div className="presence-avatar panda-avatar">B</div>
          <div><strong>You</strong><span>{ready ? "Ready for tonight" : "Take your time"}</span></div>
          <span className="presence-state">{ready ? <Check size={15} /> : "…"}</span>
        </div>
        <div className={`presence-card ${partnerReady ? "is-ready" : ""}`}>
          <div className="presence-avatar bear-avatar">D</div>
          <div><strong>Your person</strong><span>{partnerReady ? "Ready and waiting" : "Joining soon"}</span></div>
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
};

function Player({ localMedia, onChooseMedia, chatOpen, onChat, onLeave }: PlayerProps) {
  const { playback, updatePlayback, partnerPresent, incomingReaction, sendReaction } = useDemoRoom(roomCode);
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const [volume, setVolume] = useState(72);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(["Made it ♥", "This one is ours."]);

  useEffect(() => {
    if (localMedia) return;
    if (!playback.playing) return;
    const timer = window.setInterval(() => {
      updatePlayback({ position: Math.min(playback.duration, playback.position + 1) });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [localMedia, playback.duration, playback.playing, playback.position, updatePlayback]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !localMedia) return;
    if (Math.abs(media.currentTime - playback.position) > 0.8) media.currentTime = playback.position;
    if (playback.playing && media.paused) media.play().catch(() => updatePlayback({ playing: false }));
    if (!playback.playing && !media.paused) media.pause();
  }, [localMedia, playback.playing, playback.position, updatePlayback]);

  const togglePlayback = () => {
    const position = mediaRef.current?.currentTime ?? playback.position;
    updatePlayback({ playing: !playback.playing, position });
  };

  const seek = (position: number) => {
    if (mediaRef.current) mediaRef.current.currentTime = position;
    updatePlayback({ position });
  };

  const title = localMedia?.name ?? "Until We Meet Again";
  const duration = playback.duration;
  const position = playback.position;
  const progress = Math.min(100, (position / Math.max(duration, 1)) * 100);

  const sendMessage = () => {
    if (!message.trim()) return;
    setMessages((items) => [...items, message.trim()]);
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

      <div className="player-stage">
        <div className="ambient-disc disc-one" />
        <div className="ambient-disc disc-two" />
        {localMedia?.type === "video" ? (
          <video
            ref={(element) => { mediaRef.current = element; }}
            className="local-video"
            src={localMedia.url}
            playsInline
            onLoadedMetadata={(event) => updatePlayback({ duration: event.currentTarget.duration, position: 0 })}
            onTimeUpdate={(event) => {
              if (Math.floor(event.currentTarget.currentTime) !== Math.floor(playback.position)) {
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
                onLoadedMetadata={(event) => updatePlayback({ duration: event.currentTarget.duration, position: 0 })}
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
      </div>

      <div className="now-playing">
        <div className="track-copy"><span>PLAYING FOR TWO</span><h2>{title}</h2><p>{localMedia ? "From your device" : "Demo soundtrack · Bubu & Dudu"}</p></div>
        <label className="add-media button button-ghost"><Plus size={17} /> Choose media<input type="file" accept="audio/*,video/mp4,video/webm" onChange={onChooseMedia} /></label>
      </div>

      <div className="timeline">
        <input
          aria-label="Playback position"
          type="range"
          min="0"
          max={Math.max(duration || 0, 1)}
          value={Math.min(position, duration || 1)}
          onChange={(event) => seek(Number(event.target.value))}
          style={{ "--progress": `${progress}%` } as React.CSSProperties}
        />
        <div><span>{formatTime(position)}</span><span>-{formatTime(Math.max(0, duration - position))}</span></div>
      </div>

      <div className="player-controls">
        <div className="volume-control"><Volume2 size={18} /><input aria-label="Volume" type="range" min="0" max="100" value={volume} onChange={(event) => { setVolume(Number(event.target.value)); if (mediaRef.current) mediaRef.current.volume = Number(event.target.value) / 100; }} /></div>
        <div className="transport">
          <button className="transport-side" onClick={() => seek(Math.max(0, position - 10))}>10</button>
          <button className="play-button" onClick={togglePlayback} aria-label={playback.playing ? "Pause" : "Play"}>{playback.playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button>
          <button className="transport-side" onClick={() => seek(Math.min(duration, position + 10))}><SkipForward size={19} /></button>
        </div>
        <div className="reaction-bar">{reactions.map((emoji) => <button key={emoji} onClick={() => sendReaction(emoji)}>{emoji}</button>)}</div>
      </div>

      <AnimatePresence>
        {chatOpen && (
          <motion.aside className="chat-drawer" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 260 }}>
            <div className="chat-header"><div><span>Just between us</span><strong>Tonight’s whispers</strong></div><button className="icon-button" onClick={onChat}><X size={18} /></button></div>
            <div className="chat-messages">
              <div className="chat-day">Tonight</div>
              {messages.map((item, index) => <div key={`${item}-${index}`} className={`chat-message ${index % 2 ? "mine" : "theirs"}`}>{item}<span>{index % 2 ? "You" : "Dudu"}</span></div>)}
            </div>
            <div className="chat-compose"><input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => event.key === "Enter" && sendMessage()} placeholder="Say something soft…" /><button onClick={sendMessage}><Send size={17} /></button></div>
          </motion.aside>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
