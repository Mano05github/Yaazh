"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Clapperboard, Heart, Music2, Play, Search, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

import type { CatalogItem, CatalogMode, CatalogResponse } from "@/lib/catalog/types";

function formatDuration(seconds: number | null) {
  if (seconds === null) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
    : `${minutes}:${String(remaining).padStart(2, "0")}`;
}

export function CatalogExperience({ mode }: { mode: CatalogMode }) {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCatalog = useCallback(async (nextQuery: string) => {
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
    const timer = window.setTimeout(() => void loadCatalog(""), 0);
    return () => window.clearTimeout(timer);
  }, [loadCatalog]);

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextQuery = query.trim();
    setSubmittedQuery(nextQuery);
    void loadCatalog(nextQuery);
  };

  const isMusic = mode === "music";
  const hero = catalog?.items[0] ?? null;

  return (
    <main className={`catalog-shell catalog-${mode}`}>
      <header className="catalog-header">
        <Link className="catalog-brand" href="/"><span className="brand-mark">யா</span><strong>Yaazh</strong></Link>
        <nav aria-label="Entertainment modes">
          <Link className={isMusic ? "is-active" : ""} href="/music"><Music2 size={16} /> Music</Link>
          <Link className={!isMusic ? "is-active" : ""} href="/watch"><Clapperboard size={16} /> Watch</Link>
        </nav>
        <Link className="catalog-room-link" href="/"><Heart size={15} /> Start a room</Link>
      </header>

      <section className="catalog-hero">
        {hero && <Image src={hero.thumbnail} alt="" fill priority sizes="100vw" className="catalog-hero-image" />}
        <div className="catalog-hero-shade" />
        <div className="catalog-hero-copy">
          <span>{isMusic ? "MUSIC FOR YOUR SHARED MOMENTS" : "TONIGHT'S SHARED SCREEN"}</span>
          <h1>{submittedQuery ? `Results for “${submittedQuery}”` : isMusic ? "Listen closer." : "Watch together."}</h1>
          <p>{isMusic ? "Discover songs, performances and playlists without leaving Yaazh." : "Explore entertainment, stories and trailers, then bring your favourite person."}</p>
          {hero && <button className="button button-primary" onClick={() => setSelected(hero)}><Play size={17} fill="currentColor" /> Play featured</button>}
        </div>
      </section>

      <section className="catalog-content">
        <div className="catalog-toolbar">
          <div>
            <span className="eyebrow">{submittedQuery ? "Search results" : "Popular in India"}</span>
            <h2>{isMusic ? "Sounds worth sharing" : "Pick tonight's story"}</h2>
          </div>
          <form onSubmit={search} role="search">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isMusic ? "Search songs, artists, moods…" : "Search shows, stories, trailers…"} aria-label={isMusic ? "Search music" : "Search videos"} />
            <button type="submit">Search</button>
          </form>
        </div>

        {error && <div className="catalog-state is-error">{error}</div>}
        {!loading && catalog && !catalog.configured && (
          <div className="catalog-state">
            <span className="eyebrow">One-time setup</span>
            <h3>Connect the YouTube catalogue</h3>
            <p>{catalog.message}</p>
            <code>YOUTUBE_DATA_API_KEY=your_server_key</code>
          </div>
        )}
        {loading && <div className="catalog-grid" aria-label="Loading catalogue">{Array.from({ length: 8 }, (_, index) => <div className="catalog-card-skeleton" key={index} />)}</div>}
        {!loading && catalog?.configured && (
          <div className="catalog-grid">
            {catalog.items.map((item) => (
              <button className="catalog-card" key={item.id} onClick={() => setSelected(item)}>
                <span className="catalog-card-image">
                  <Image src={item.thumbnail} alt="" fill sizes="(max-width: 620px) 82vw, (max-width: 1100px) 40vw, 23vw" />
                  <i><Play size={19} fill="currentColor" /></i>
                  {item.durationSeconds !== null && <small>{formatDuration(item.durationSeconds)}</small>}
                </span>
                <strong>{item.title}</strong>
                <span>{item.channelTitle}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <AnimatePresence>
        {selected && (
          <motion.div className="catalog-preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button className="catalog-preview-backdrop" onClick={() => setSelected(null)} aria-label="Close preview" />
            <motion.div className="catalog-preview-panel" initial={{ y: 35, scale: .97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 35, scale: .97 }}>
              <button className="icon-button catalog-preview-close" onClick={() => setSelected(null)} aria-label="Close"><X size={18} /></button>
              <div className="catalog-embed"><iframe src={`https://www.youtube-nocookie.com/embed/${selected.id}?autoplay=1&rel=0`} title={selected.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div>
              <div className="catalog-preview-copy"><span>{selected.channelTitle}</span><h2>{selected.title}</h2><Link href="/"><ArrowLeft size={15} /> Return to rooms</Link></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
