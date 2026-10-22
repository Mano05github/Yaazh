"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Clapperboard, Music2, Play, Search } from "lucide-react";
import Image from "next/image";
import { FormEvent, useCallback, useEffect, useState } from "react";

import type { CatalogItem, CatalogMode, CatalogResponse } from "@/lib/catalog/types";

export function RoomLibrary({
  roomCode,
  partnerPresent,
  onBack,
  onSelect,
}: {
  roomCode: string;
  partnerPresent: boolean;
  onBack: () => void;
  onSelect: (item: CatalogItem) => void;
}) {
  const [mode, setMode] = useState<CatalogMode>("music");
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextQuery: string) => {
    setLoading(true);
    setError(null);
    try {
      const parameters = new URLSearchParams({ mode });
      if (nextQuery) parameters.set("q", nextQuery);
      const response = await fetch(`/api/catalog/youtube?${parameters}`);
      const payload = (await response.json()) as CatalogResponse & { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "The catalogue could not be loaded.");
      setCatalog(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The catalogue could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(""), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void load(query.trim());
  };

  return (
    <motion.section className="screen room-library-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="room-library-topbar">
        <button className="back-button room-library-back" onClick={onBack}><ArrowLeft size={17} /> Lobby</button>
        <div className="together-indicator">
          <span className="avatar-stack"><i>B</i><i>D</i></span>
          <div><strong>{partnerPresent ? "Together now" : "Waiting for your person"}</strong><span>Room {roomCode}</span></div>
        </div>
      </div>

      <div className="room-library-heading">
        <span className="eyebrow">Your room · your choice</span>
        <h1>What shall we share?</h1>
        <p>Pick something here. It will open for both of you at the same moment.</p>
      </div>

      <div className="room-library-toolbar">
        <div className="room-library-tabs" aria-label="Choose media type">
          <button className={mode === "music" ? "is-active" : ""} onClick={() => setMode("music")}><Music2 size={18} /> Music</button>
          <button className={mode === "watch" ? "is-active" : ""} onClick={() => setMode("watch")}><Clapperboard size={18} /> Watch</button>
        </div>
        <form onSubmit={submit} role="search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={mode === "music" ? "Search songs, artists, moods…" : "Search videos, stories, trailers…"} /><button type="submit">Search</button></form>
      </div>

      {error && <div className="room-catalog-message">{error}</div>}
      {!loading && catalog && !catalog.configured && <div className="room-catalog-message">{catalog.message}</div>}
      <div className="room-library-grid">
        {loading && Array.from({ length: 8 }, (_, index) => <div className="catalog-card-skeleton" key={index} />)}
        {!loading && catalog?.items.map((item) => (
          <button className="catalog-card" key={item.id} onClick={() => onSelect(item)}>
            <span className="catalog-card-image"><Image src={item.thumbnail} alt="" fill sizes="(max-width: 620px) 88vw, (max-width: 920px) 43vw, 23vw" /><i><Play size={19} fill="currentColor" /></i></span>
            <strong>{item.title}</strong><span>{item.channelTitle}</span>
          </button>
        ))}
      </div>
    </motion.section>
  );
}
