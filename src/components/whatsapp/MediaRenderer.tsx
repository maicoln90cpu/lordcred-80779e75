import { useState, useCallback, useEffect, useRef } from 'react';
import { Image, Play, Pause, FileText, Download, Loader2, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';

interface MediaRendererProps {
  messageId: string;
  mediaType: string;
  chipId: string;
  caption?: string;
}

function formatTime(seconds: number) {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) { audio.pause(); } else { audio.play(); }
  };

  const cycleSpeed = () => {
    const speeds = [1, 1.5, 2];
    const next = speeds[(speeds.indexOf(playbackRate) + 1) % speeds.length];
    setPlaybackRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  return (
    <div className="flex items-center gap-2 w-full max-w-[280px] min-w-[200px]">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => { setIsPlaying(false); setCurrentTime(0); }}
      />
      <button
        onClick={togglePlay}
        className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 hover:bg-primary/30 flex items-center justify-center transition-colors"
      >
        {isPlaying ? <Pause className="w-3.5 h-3.5 text-primary" /> : <Play className="w-3.5 h-3.5 text-primary ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col gap-0.5 min-w-0">
        <Slider
          value={[currentTime]}
          max={duration || 1}
          step={0.1}
          onValueChange={handleSeek}
          className="h-1.5"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
      <button
        onClick={cycleSpeed}
        className="flex-shrink-0 text-[10px] font-bold rounded px-1.5 py-0.5 bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
      >
        {playbackRate}x
      </button>
    </div>
  );
}

export default function MediaRenderer({ messageId, mediaType, chipId, caption }: MediaRendererProps) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const downloadMedia = useCallback(async () => {
    if (mediaUrl || loading) return;
    setLoading(true);
    setError(false);
    try {
      const response = await supabase.functions.invoke('uazapi-api', {
        body: { action: 'download-media', chipId, messageId },
      });
      if (response.data?.fileURL) {
        setMediaUrl(response.data.fileURL);
      } else {
        setError(true);
      }
    } catch (e) {
      console.error('Error downloading media:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [messageId, chipId, mediaUrl, loading]);

  // Auto-load media on mount
  useEffect(() => {
    downloadMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageId, chipId]);

  const type = (mediaType || '').toLowerCase();

  const LoadingSkeleton = ({ className }: { className?: string }) => (
    <Skeleton className={cn("bg-muted/50", className)} />
  );

  // Image
  if (type === 'image') {
    if (mediaUrl) {
      return (
        <div className="space-y-1">
          <img
            src={mediaUrl}
            alt={caption || 'Imagem'}
            className="max-w-full rounded-md max-h-64 object-contain cursor-pointer"
            onClick={() => window.open(mediaUrl, '_blank')}
          />
          {caption && <p className="text-sm break-words">{caption}</p>}
        </div>
      );
    }
    return loading ? <LoadingSkeleton className="w-48 h-32 rounded-md" /> : (
      <button onClick={downloadMedia} className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 hover:bg-muted text-sm transition-colors">
        <Image className="w-4 h-4" />
        <span>{error ? '⚠️ Erro - clique para tentar' : '📷 Imagem'}</span>
      </button>
    );
  }

  // Video
  if (type === 'video' || type === 'ptv') {
    if (mediaUrl) {
      return (
        <div className="space-y-1">
          <video src={mediaUrl} controls className="max-w-full rounded-md max-h-64" />
          {caption && <p className="text-sm break-words">{caption}</p>}
        </div>
      );
    }
    return loading ? <LoadingSkeleton className="w-48 h-32 rounded-md" /> : (
      <button onClick={downloadMedia} className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 hover:bg-muted text-sm transition-colors">
        <Play className="w-4 h-4" />
        <span>{error ? '⚠️ Erro - clique para tentar' : '🎬 Vídeo'}</span>
      </button>
    );
  }

  // Audio / PTT
  if (type === 'audio' || type === 'ptt' || type === 'myaudio') {
    if (mediaUrl) {
      return <AudioPlayer src={mediaUrl} />;
    }
    if (loading) {
      return (
        <div className="flex items-center gap-2 w-full max-w-[280px]">
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="flex-1 h-2 rounded-full" />
        </div>
      );
    }
    // Friendly unavailable state for old audios
    if (error) {
      return (
        <div className="flex items-center gap-2 w-full max-w-[280px] min-w-[200px] opacity-60">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <Volume2 className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <div className="flex-1 flex flex-col gap-0.5 min-w-0">
            <div className="h-1.5 bg-muted rounded-full w-full" />
            <span className="text-[10px] text-muted-foreground">Áudio indisponível</span>
          </div>
        </div>
      );
    }
    return (
      <button onClick={downloadMedia} className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 hover:bg-muted text-sm transition-colors">
        <Volume2 className="w-4 h-4" />
        <span>🎤 Áudio</span>
      </button>
    );
  }

  // Document
  if (type === 'document') {
    if (mediaUrl) {
      return (
        <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 hover:bg-muted text-sm transition-colors">
          <FileText className="w-4 h-4" />
          <span>{caption || 'Documento'}</span>
          <Download className="w-3.5 h-3.5 ml-auto" />
        </a>
      );
    }
    return loading ? <LoadingSkeleton className="w-48 h-10 rounded-md" /> : (
      <button onClick={downloadMedia} className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 hover:bg-muted text-sm transition-colors">
        <FileText className="w-4 h-4" />
        <span>{error ? '⚠️ Erro' : '📄 Documento'}</span>
      </button>
    );
  }

  // Sticker
  if (type === 'sticker') {
    if (mediaUrl) {
      return <img src={mediaUrl} alt="Sticker" className="max-w-[150px] max-h-[150px]" />;
    }
    return loading ? <LoadingSkeleton className="w-[100px] h-[100px] rounded-md" /> : (
      <button onClick={downloadMedia} className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 hover:bg-muted text-sm transition-colors">
        <span>🎨</span>
        <span>{error ? '⚠️ Erro' : 'Sticker'}</span>
      </button>
    );
  }

  // Unknown
  return loading ? <LoadingSkeleton className="w-32 h-8 rounded-md" /> : (
    <button onClick={downloadMedia} className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 hover:bg-muted text-sm transition-colors">
      <Download className="w-4 h-4" />
      <span>{error ? '📎 Mídia indisponível' : `📎 Mídia (${type})`}</span>
    </button>
  );
}
