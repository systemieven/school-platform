/**
 * HeroMedia
 *
 * Renders a hero background that automatically detects whether the URL
 * points to an image or a video (direct mp4/webm, YouTube, or Vimeo).
 * Used by all internal pages to support both image and video backgrounds
 * from a single `image` field in appearance settings.
 */

/** Detect if a URL is a video */
function isVideoUrl(url: string): boolean {
  // Direct video files
  if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url)) return true;
  // YouTube
  if (/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/.test(url)) return true;
  // Vimeo
  if (/vimeo\.com\/\d+/.test(url)) return true;
  return false;
}

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

interface HeroMediaProps {
  url: string;
  alt?: string;
}

export default function HeroMedia({ url, alt = '' }: HeroMediaProps) {
  if (!url) return null;

  if (!isVideoUrl(url)) {
    return (
      <img
        src={url}
        alt={alt}
        className="w-full h-full object-cover"
      />
    );
  }

  const { type, src } = toEmbedUrl(url);

  if (type === 'embed') {
    return (
      <iframe
        src={src}
        className="absolute inset-0 pointer-events-none"
        style={{
          border: 'none',
          width: '177.78vh',
          height: '100vh',
          minWidth: '100%',
          minHeight: '100%',
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        allow="autoplay; fullscreen"
        tabIndex={-1}
      />
    );
  }

  // Direct video file
  return (
    <video
      key={src}
      autoPlay
      loop
      muted
      playsInline
      className="w-full h-full object-cover"
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}
