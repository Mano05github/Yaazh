"use client";

import { Clapperboard, Music2, Play, Search, X } from "lucide-react";
import Image from "next/image";
import { FormEvent, useCallback, useEffect, useState } from "react";

import type { CatalogItem, CatalogMode, CatalogResponse } from "@/lib/catalog/types";
import { fetchRoomCatalog } from "@/lib/catalog/client";

export function RoomCatalogPicker({
  roomId,
  onClose,
  onSelect,
}: {
  roomId: string;
  onClose: () => void;
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
      setCatalog(await fetchRoomCatalog({ roomId, mode, query: nextQuery }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The catalogue could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [mode, roomId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(""), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void load(query.trim());
  };

  return (
    <div className="room-catalog" role="dialog" aria-modal="true" aria-label="Choose from YouTube">
      <button className="room-catalog-backdrop" onClick={onClose} aria-label="Close catalogue" />
      <section className="room-catalog-panel">
        <div className="room-catalog-header">
          <div><span>Choose for both of you</span><strong>Yaazh catalogue</strong></div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="room-catalog-tools">
          <div className="room-catalog-tabs">
            <button className={mode === "music" ? "is-active" : ""} onClick={() => setMode("music")}><Music2 size={15} /> Music</button>
            <button className={mode === "watch" ? "is-active" : ""} onClick={() => setMode("watch")}><Clapperboard size={15} /> Watch</button>
          </div>
          <form onSubmit={submit}><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search YouTube…" /><button type="submit">Go</button></form>
        </div>
        {error && <div className="room-catalog-message">{error}</div>}
        {!loading && catalog && !catalog.configured && <div className="room-catalog-message">{catalog.message}</div>}
        <div className="room-catalog-grid">
          {loading && Array.from({ length: 8 }, (_, index) => <div className="catalog-card-skeleton" key={index} />)}
          {!loading && catalog?.items.map((item) => (
            <button key={item.id} onClick={() => onSelect(item)}>
              <span><Image src={item.thumbnail} alt="" fill sizes="(max-width: 620px) 42vw, 190px" /><i><Play size={16} fill="currentColor" /></i></span>
              <strong>{item.title}</strong><small>{item.channelTitle}</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
