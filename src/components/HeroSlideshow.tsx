/**
 * HeroSlideshow
 *
 * Renders a full-screen hero background slideshow with multiple transition effects.
 * Used by the public Home page. When no scenes are configured, falls back to
 * a single video background (backward compat with the existing `video_url` field).
 *
 * Supported transitions: crossfade, slide, zoom, blur, flip.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ── Types (mirrored from AppearanceSettingsPanel) ────────────────────────────

export type TransitionEffect = 'crossfade' | 'slide' | 'zoom' | 'blur' | 'flip';

export interface HeroScene {
  id: string;
  media_type: 'image' | 'video';
  media_url: string;
  duration: number;
  blue_mask: boolean;
}

export interface HeroSlideshowConfig {
  default_duration: number;
  order: 'sequential' | 'random';
  transition: TransitionEffect;
  transition_duration: number;
}

interface HeroSlideshowProps {
  scenes: HeroScene[];
  config: HeroSlideshowConfig;
  fallbackVideoUrl: string;
}

const DEFAULT_CONFIG: HeroSlideshowConfig = {
  default_duration: 8,
  order: 'sequential',
  transition: 'crossfade',
  transition_duration: 1200,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert YouTube/Vimeo URLs to embeddable format, or return as-is for direct links */
function toEmbedUrl(url: string): { type: 'embed' | 'direct'; src: string } {
  // YouTube
  let m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (m) return { type: 'embed', src: `https://www.youtube.com/embed/${m[1]}?autoplay=1&mute=1&loop=1&playlist=${m[1]}&controls=0&showinfo=0&modestbranding=1&rel=0` };
  // Vimeo
  m = url.match(/vimeo\.com\/(\d+)/);
  if (m) return { type: 'embed', src: `https://player.vimeo.com/video/${m[1]}?autoplay=1&muted=1&loop=1&background=1` };
  // Direct video
  return { type: 'direct', src: url };
}

/** Shuffle an array (Fisher-Yates) */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Scene Media Renderer ─────────────────────────────────────────────────────

function SceneMedia({ scene, active }: { scene: HeroScene; active: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    if (active) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [active]);

  if (scene.media_type === 'video') {
    const { type, src } = toEmbedUrl(scene.media_url);
    if (type === 'embed') {
      return (
        <iframe
          src={active ? src : undefined}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ border: 'none', width: '177.78vh', height: '100vh', minWidth: '100%', minHeight: '100%', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
          allow="autoplay; fullscreen"
          tabIndex={-1}
        />
      );
    }
    return (
      <video
        ref={videoRef}
        autoPlay={active}
        loop
        muted
        playsInline
        className="hero-video w-full h-full object-cover"
      >
        <source src={src} type="video/mp4" />
      </video>
    );
  }

  // Image
  return (
    <img
      src={scene.media_url}
      alt=""
      className="w-full h-full object-cover hero-video"
    />
  );
}

// ── Transition styles ────────────────────────────────────────────────────────

function getTransitionStyles(
  effect: TransitionEffect,
  state: 'enter' | 'active' | 'exit',
  durationMs: number,
): React.CSSProperties {
  const t = `${durationMs}ms cubic-bezier(0.4, 0, 0.2, 1)`;

  switch (effect) {
    case 'crossfade':
      return {
        opacity: state === 'active' ? 1 : 0,
        transition: `opacity ${t}`,
      };

    case 'slide':
      return {
        opacity: state === 'exit' ? 0 : 1,
        transform: state === 'enter' ? 'translateX(100%)' : state === 'exit' ? 'translateX(-100%)' : 'translateX(0)',
        transition: `transform ${t}, opacity ${t}`,
      };

    case 'zoom':
      return {
        opacity: state === 'active' ? 1 : 0,
        transform: state === 'enter' ? 'scale(1.3)' : state === 'active' ? 'scale(1)' : 'scale(0.8)',
        transition: `transform ${t}, opacity ${t}`,
      };

    case 'blur':
      return {
        opacity: state === 'active' ? 1 : 0,
        filter: state === 'active' ? 'blur(0px)' : 'blur(20px)',
        transition: `opacity ${t}, filter ${t}`,
      };

    case 'flip':
      return {
        opacity: state === 'active' ? 1 : 0,
        transform: state === 'enter' ? 'perspective(1200px) rotateY(90deg)' : state === 'exit' ? 'perspective(1200px) rotateY(-90deg)' : 'perspective(1200px) rotateY(0deg)',
        transition: `transform ${t}, opacity ${t}`,
        backfaceVisibility: 'hidden',
      };

    default:
      return { opacity: state === 'active' ? 1 : 0, transition: `opacity ${t}` };
  }
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function HeroSlideshow({ scenes, config: rawConfig, fallbackVideoUrl }: HeroSlideshowProps) {
  const config = { ...DEFAULT_CONFIG, ...rawConfig };
  const validScenes = useMemo(() => (scenes ?? []).filter((s) => s.media_url), [scenes]);

  // If no scenes, render the fallback single video
  if (validScenes.length === 0) {
    return (
      <div className="absolute inset-0">
        {fallbackVideoUrl ? (
          <video key={fallbackVideoUrl} autoPlay loop muted playsInline className="hero-video w-full h-full object-cover">
            <source src={fallbackVideoUrl} type="video/mp4" />
          </video>
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/95 via-brand-primary/80 to-brand-primary-dark/70" />
      </div>
    );
  }

  return <SlideshowEngine scenes={validScenes} config={config} />;
}

function SlideshowEngine({ scenes, config }: { scenes: HeroScene[]; config: HeroSlideshowConfig }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [prevIdx, setPrevIdx] = useState<number | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Build play order
  const playOrder = useMemo(() => {
    const indices = scenes.map((_, i) => i);
    return config.order === 'random' ? shuffle(indices) : indices;
  }, [scenes, config.order]);

  const [orderPos, setOrderPos] = useState(0);

  // Reset when scenes change
  useEffect(() => {
    setCurrentIdx(playOrder[0] ?? 0);
    setOrderPos(0);
    setPrevIdx(null);
    setTransitioning(false);
  }, [scenes.length]);

  // Advance timer
  const advance = useCallback(() => {
    if (scenes.length <= 1) return;

    const nextOrderPos = (orderPos + 1) % playOrder.length;
    const nextIdx = playOrder[nextOrderPos];

    setPrevIdx(currentIdx);
    setTransitioning(true);

    // After transition completes, clean up prev
    setTimeout(() => {
      setPrevIdx(null);
      setTransitioning(false);
    }, config.transition_duration);

    setCurrentIdx(nextIdx);
    setOrderPos(nextOrderPos);
  }, [currentIdx, orderPos, playOrder, scenes.length, config.transition_duration]);

  useEffect(() => {
    if (scenes.length <= 1) return;
    const scene = scenes[currentIdx];
    if (!scene) return;
    const dur = (scene.duration || config.default_duration) * 1000;
    timerRef.current = setTimeout(advance, dur);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [currentIdx, transitioning, advance, scenes, config.default_duration]);

  const currentScene = scenes[currentIdx];
  const prevScene = prevIdx !== null ? scenes[prevIdx] : null;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Previous scene (exiting) */}
      {prevScene && (
        <div
          key={`prev-${prevScene.id}`}
          className="absolute inset-0"
          style={getTransitionStyles(config.transition, 'exit', config.transition_duration)}
        >
          <SceneMedia scene={prevScene} active={false} />
          {prevScene.blue_mask && (
            <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/95 via-brand-primary/80 to-brand-primary-dark/70" />
          )}
        </div>
      )}

      {/* Current scene (entering / active) */}
      {currentScene && (
        <div
          key={`curr-${currentScene.id}-${currentIdx}`}
          className="absolute inset-0"
          style={getTransitionStyles(config.transition, transitioning ? 'enter' : 'active', config.transition_duration)}
          // Force re-paint on mount so the enter→active transition fires
          ref={(el) => {
            if (el && transitioning) {
              // Force reflow
              void el.offsetHeight;
              requestAnimationFrame(() => {
                Object.assign(el.style, getTransitionStyles(config.transition, 'active', config.transition_duration));
              });
            }
          }}
        >
          <SceneMedia scene={currentScene} active={true} />
          {currentScene.blue_mask && (
            <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/95 via-brand-primary/80 to-brand-primary-dark/70" />
          )}
        </div>
      )}

      {/* Fallback mask if no scene has one */}
      {currentScene && !currentScene.blue_mask && !prevScene && (
        <div className="absolute inset-0 bg-gradient-to-br from-black/30 to-black/10 pointer-events-none" />
      )}
    </div>
  );
}
