"use client";

import { useRef, useState } from "react";
import styles from "./AdminPanel.module.css";

type Props = {
  urls: string[];
  onChange: (urls: string[]) => void;
  onToast?: (m: string, isError?: boolean) => void;
  folder?: string;
  /** If true, only one image is kept (used for size chart). */
  single?: boolean;
  label?: string;
};

export default function ImageUploader({
  urls, onChange, onToast, folder = "products", single = false, label,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState<number | null>(null);

  async function uploadFiles(files: FileList | File[]) {
    setUploading(true);
    const uploaded: string[] = [];
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          onToast?.(`Skipped ${file.name}: not an image`, true);
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          onToast?.(`Skipped ${file.name}: over 5 MB`, true);
          continue;
        }
        const res = await fetch(
          `/api/upload?filename=${encodeURIComponent(file.name)}&folder=${folder}`,
          {
            method: "POST",
            headers: { "Content-Type": file.type },
            body: file,
          },
        );
        const data = await res.json();
        if (!res.ok) {
          onToast?.(data.error ?? "Upload failed", true);
          continue;
        }
        uploaded.push(data.url);
      }
      if (uploaded.length) {
        onChange(single ? [uploaded[0]] : [...urls, ...uploaded]);
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function removeAt(index: number) {
    const url = urls[index];
    onChange(urls.filter((_, i) => i !== index));
    // best-effort delete from blob storage
    try {
      await fetch(`/api/upload?url=${encodeURIComponent(url)}`, { method: "DELETE" });
    } catch {
      // silent — file already removed from product; orphan blob is minor
    }
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= urls.length) return;
    const next = [...urls];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  function onDragStart(e: React.DragEvent, index: number) {
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
  }
  function onDropReorder(e: React.DragEvent, to: number) {
    e.preventDefault();
    const from = Number(e.dataTransfer.getData("text/plain"));
    if (!isNaN(from) && from !== to) move(from, to);
    setDragOver(null);
  }

  return (
    <div className={styles.uploader}>
      {label && <div className={styles.uploaderLabel}>{label}</div>}

      {urls.length > 0 && (
        <div className={styles.uploaderThumbs}>
          {urls.map((url, i) => (
            <div
              key={url}
              className={`${styles.uploaderThumb} ${dragOver === i ? styles.uploaderThumbDragOver : ""}`}
              draggable={!single}
              onDragStart={(e) => onDragStart(e, i)}
              onDragOver={(e) => { e.preventDefault(); if (!single) setDragOver(i); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => onDropReorder(e, i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" />
              {!single && i === 0 && <span className={styles.uploaderPrimary}>Primary</span>}
              <div className={styles.uploaderThumbActions}>
                {!single && i > 0 && (
                  <button
                    type="button"
                    className={styles.uploaderMini}
                    onClick={() => move(i, i - 1)}
                    aria-label="Move left"
                    title="Move left"
                  >←</button>
                )}
                {!single && i < urls.length - 1 && (
                  <button
                    type="button"
                    className={styles.uploaderMini}
                    onClick={() => move(i, i + 1)}
                    aria-label="Move right"
                    title="Move right"
                  >→</button>
                )}
                <button
                  type="button"
                  className={`${styles.uploaderMini} ${styles.uploaderMiniDanger}`}
                  onClick={() => removeAt(i)}
                  aria-label="Remove"
                  title="Remove"
                >×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <label className={styles.uploaderDrop}>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple={!single}
          disabled={uploading}
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
          style={{ display: "none" }}
        />
        <span>
          {uploading
            ? "Uploading…"
            : single
              ? (urls.length ? "Replace image" : "Upload image")
              : "Click to upload · JPG/PNG/WebP · up to 5 MB"}
        </span>
      </label>
    </div>
  );
}
