import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Plus, Mic, Trash2, Pause, Play, Image, Video, FileText, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';

import EmojiPicker from './EmojiPicker';
import TemplatePicker from './TemplatePicker';
import type { MessageData } from './MessageContextMenu';

interface QuickReply {
  id: string;
  trigger_word: string;
  response_text: string;
}

interface ShortcutMatch {
  trigger_word: string;
  response_text: string;
  media_url?: string | null;
  media_type?: string | null;
  media_filename?: string | null;
}

// Cache quick replies per user
let quickReplyCache: { userId: string; data: QuickReply[] } | null = null;
// Cache shortcuts per chip
const shortcutCache: Record<string, { trigger_word: string; response_text: string; is_active: boolean; media_url?: string | null; media_type?: string | null; media_filename?: string | null }[]> = {};

interface ChatInputProps {
  onSend: (text: string) => void;
  onSendMedia: (mediaBase64: string, mediaType: string, caption: string, fileName?: string) => void;
  disabled?: boolean;
  replyTo?: MessageData | null;
  onCancelReply?: () => void;
  chipId?: string | null;
}

export default function ChatInput({ onSend, onSendMedia, disabled, replyTo, onCancelReply, chipId }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaPreview, setMediaPreview] = useState<{ type: string; name: string; base64: string; previewUrl?: string } | null>(null);
  const [isSendingMedia, setIsSendingMedia] = useState(false);
  const [waveformBars, setWaveformBars] = useState<number[]>(new Array(30).fill(4));
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [quickReplyFilter, setQuickReplyFilter] = useState('');
  const [shortcutSuggestions, setShortcutSuggestions] = useState<ShortcutMatch[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileTypeRef = useRef<string>('image');
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastMatchedTextRef = useRef<string>('');

  // Fetch quick replies from local DB (user-based, not chip-based)
  const loadQuickReplies = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('message_shortcuts')
        .select('id, trigger_word, response_text, user_id, visible_to_list')
        .eq('is_active', true);

      if (error) return;

      // Filter: own shortcuts + admin shortcuts visible to this user
      const filtered = (data as any[] || []).filter((s: any) => {
        if (s.user_id === user.id) return true;
        const list = s.visible_to_list;
        if (list && list.length > 0) return list.includes(user.id);
        // No restriction on visible_to_list means visible to all (admin global)
        return true;
      }).map((s: any) => ({ id: s.id, trigger_word: s.trigger_word, response_text: s.response_text }));

      quickReplyCache = { userId: user.id, data: filtered };
      setQuickReplies(filtered);
    } catch {}
  }, []);

  useEffect(() => {
    if (quickReplyCache) {
      setQuickReplies(quickReplyCache.data);
    } else {
      loadQuickReplies();
    }
  }, [loadQuickReplies]);

  useEffect(() => {
    const handler = () => {
      quickReplyCache = null;
      loadQuickReplies();
    };
    window.addEventListener('quick-replies-updated', handler);
    return () => window.removeEventListener('quick-replies-updated', handler);
  }, [loadQuickReplies]);

  // Fetch templates with trigger_word as shortcuts
  useEffect(() => {
    if (!chipId) return;
    const loadShortcuts = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: templatesData } = await supabase
          .from('message_templates')
          .select('trigger_word,content,is_active,media_url,media_type,media_filename,created_by,visible_to,visible_to_list')
          .eq('is_active', true)
          .not('trigger_word', 'is', null);

        const results = (templatesData as any[] || [])
          .filter(t => {
            if (!t.trigger_word) return false;
            if (t.created_by === user.id) return true;
            const list = t.visible_to_list;
            if (list && list.length > 0) return list.includes(user.id);
            if (!t.visible_to) return true;
            return t.visible_to === user.id;
          })
          .map(t => ({
            trigger_word: t.trigger_word,
            response_text: t.content,
            is_active: true,
            media_url: t.media_url,
            media_type: t.media_type,
            media_filename: t.media_filename,
          }));

        shortcutCache[chipId] = results;
      } catch {}
    };
    if (!shortcutCache[chipId]) loadShortcuts();

    // Listen for cache invalidation (template changes)
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === chipId || detail === 'all') {
        delete shortcutCache[chipId];
        loadShortcuts();
      }
    };
    window.addEventListener('shortcut-cache-invalidate', handler);
    return () => window.removeEventListener('shortcut-cache-invalidate', handler);
  }, [chipId]);

  // Handle "/" trigger for quick replies AND shortcut detection while typing
  const handleMessageChange = (value: string) => {
    setMessage(value);
    if (value.startsWith('/') && quickReplies.length > 0) {
      const filter = value.slice(1).toLowerCase();
      setQuickReplyFilter(filter);
      setShowQuickReplies(true);
    } else {
      setShowQuickReplies(false);
    }

    // Detect trigger words as user types
    if (chipId && value.trim().length >= 2) {
      const shortcuts = shortcutCache[chipId] || [];
      const typed = value.trim().toLowerCase();
      const matches = shortcuts.filter(s => s.is_active && typed.includes(s.trigger_word.toLowerCase()));
      if (matches.length > 0) {
        setShortcutSuggestions(matches.map(m => ({
          trigger_word: m.trigger_word,
          response_text: m.response_text,
          media_url: m.media_url,
          media_type: m.media_type,
          media_filename: m.media_filename,
        })));
      } else {
        setShortcutSuggestions([]);
      }
    } else {
      setShortcutSuggestions([]);
    }
  };

  const selectQuickReply = (reply: QuickReply) => {
    setMessage(reply.text);
    setShowQuickReplies(false);
    inputRef.current?.focus();
  };

  const filteredQuickReplies = quickReplies.filter(qr =>
    qr.shortCut.toLowerCase().includes(quickReplyFilter) ||
    qr.text.toLowerCase().includes(quickReplyFilter)
  );

  const handleSend = () => {
    if (mediaPreview) {
      handleSendMedia();
      return;
    }
    if (!message.trim() || disabled) return;
    onSend(message.trim());
    setMessage('');
  };

  const handleSendMedia = async () => {
    if (!mediaPreview) return;
    setIsSendingMedia(true);
    try {
      await onSendMedia(mediaPreview.base64, mediaPreview.type, message.trim(), mediaPreview.name);
      setMediaPreview(null);
      setMessage('');
    } finally {
      setIsSendingMedia(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Return the full data URL (base64 with prefix)
        resolve(result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const base64 = await fileToBase64(file);
    const type = fileTypeRef.current;
    
    let previewUrl: string | undefined;
    if (type === 'image') {
      previewUrl = URL.createObjectURL(file);
    }

    setMediaPreview({ type, name: file.name, base64, previewUrl });
    
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openFilePicker = (type: string) => {
    fileTypeRef.current = type;
    const input = fileInputRef.current;
    if (!input) return;
    
    switch (type) {
      case 'image':
        input.accept = 'image/*';
        break;
      case 'video':
        input.accept = 'video/mp4,video/*';
        break;
      case 'document':
        input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar';
        break;
      default:
        input.accept = '*/*';
    }
    input.click();
  };

  const updateWaveform = useCallback(() => {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    const bars = [];
    const step = Math.floor(data.length / 30);
    for (let i = 0; i < 30; i++) {
      const val = data[i * step] || 0;
      bars.push(Math.max(4, (val / 255) * 28));
    }
    setWaveformBars(bars);
    animFrameRef.current = requestAnimationFrame(updateWaveform);
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Set up analyser for waveform
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        audioCtx.close();
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        analyserRef.current = null;
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          setMediaPreview({ type: 'ptt', name: 'audio.webm', base64 });
        };
        reader.readAsDataURL(blob);
      };

      recorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      setWaveformBars(new Array(30).fill(4));

      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      updateWaveform();
    } catch (e) {
      console.error('Failed to start recording:', e);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        timerRef.current = window.setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
        updateWaveform();
        setIsPaused(false);
      } else {
        mediaRecorderRef.current.pause();
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
        setIsPaused(true);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      mediaRecorderRef.current = null;
      chunksRef.current = [];
      setIsRecording(false);
      setIsPaused(false);
      setRecordingTime(0);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
      analyserRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const cancelMediaPreview = () => {
    if (mediaPreview?.previewUrl) URL.revokeObjectURL(mediaPreview.previewUrl);
    setMediaPreview(null);
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessage(prev => prev + emoji);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        const previewUrl = URL.createObjectURL(file);
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          setMediaPreview({ type: 'image', name: 'screenshot.png', base64, previewUrl });
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  };

  return (
    <div className="border-t border-border/30 bg-gradient-to-r from-card/60 to-card/40 backdrop-blur-sm">
      {/* Shortcut suggestions — multiple pills side by side */}
      {shortcutSuggestions.length > 0 && (
        <div className="px-4 pt-2 pb-1 flex items-center gap-2 flex-wrap">
          {shortcutSuggestions.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                if (s.media_url) {
                  const mType = s.media_type?.startsWith('audio') ? 'ptt' : s.media_type?.startsWith('image') ? 'image' : s.media_type?.startsWith('video') ? 'video' : 'document';
                  setMediaPreview({ type: mType, name: s.media_filename || 'media', base64: s.media_url, previewUrl: s.media_type?.startsWith('image') ? s.media_url : undefined });
                  if (s.response_text) setMessage(s.response_text);
                } else {
                  setMessage(s.response_text);
                }
                setShortcutSuggestions([]);
                inputRef.current?.focus();
              }}
              className="inline-flex items-center gap-2 max-w-xs rounded-full bg-accent/15 border border-accent/30 px-3 py-1.5 text-sm hover:bg-accent/25 transition-colors cursor-pointer"
            >
              {s.media_url && s.media_type?.startsWith('image') && (
                <img src={s.media_url} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
              )}
              {s.media_url && !s.media_type?.startsWith('image') && (
                s.media_type?.startsWith('audio') ? <Mic className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              )}
              <span className="text-xs text-accent-foreground">⚡</span>
              <span className="font-mono text-xs font-semibold text-foreground">{s.trigger_word}</span>
              {s.media_url && !s.response_text && (
                <span className="text-xs text-muted-foreground truncate">📎 {s.media_filename || 'Mídia'}</span>
              )}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShortcutSuggestions([])}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {/* Reply preview */}
      {replyTo && (
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-primary/10 border-l-4 border-primary">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-primary">{replyTo.fromMe ? 'Você' : 'Contato'}</p>
              <p className="text-sm truncate text-muted-foreground">{replyTo.text || '📎 Mídia'}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onCancelReply} className="shrink-0 h-6 w-6">
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
      {/* Media Preview */}
      {mediaPreview && (
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-secondary/50">
            {mediaPreview.previewUrl ? (
              <img src={mediaPreview.previewUrl} alt="Preview" className="w-16 h-16 rounded object-cover" />
            ) : (mediaPreview.type === 'ptt' || mediaPreview.type === 'audio') ? (
              <div className="flex-1 min-w-0">
                <audio src={mediaPreview.base64} controls className="h-8 w-full max-w-[240px]" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                {mediaPreview.type === 'video' ? (
                  <Video className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <FileText className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            )}
            {(mediaPreview.type !== 'ptt' && mediaPreview.type !== 'audio') && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{mediaPreview.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{mediaPreview.type}</p>
              </div>
            )}
            <Button variant="ghost" size="icon" onClick={cancelMediaPreview} className="shrink-0">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Recording indicator - WhatsApp Web style inline */}
      {isRecording && (
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Trash / Cancel */}
          <Button variant="ghost" size="icon" onClick={cancelRecording} className="text-muted-foreground hover:text-destructive shrink-0">
            <Trash2 className="w-5 h-5" />
          </Button>

          {/* Recording dot + timer */}
          <div className="flex items-center gap-2 min-w-[60px]">
            {!isPaused && <div className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />}
            <span className="text-sm font-mono text-foreground">{formatTime(recordingTime)}</span>
          </div>

          {/* Waveform visualization */}
          <div className="flex-1 flex items-center justify-center gap-[2px] h-8 overflow-hidden">
            {waveformBars.map((h, i) => (
              <div
                key={i}
                className="w-[3px] rounded-full bg-primary/70 transition-all duration-75"
                style={{ height: `${isPaused ? 4 : h}px` }}
              />
            ))}
          </div>

          {/* Pause/Resume */}
          <Button variant="ghost" size="icon" onClick={pauseRecording} className="text-muted-foreground hover:text-foreground shrink-0">
            {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
          </Button>

          {/* Send */}
          <Button size="icon" onClick={stopRecording} className="shrink-0 bg-primary hover:bg-primary/90 rounded-full">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Input bar - hidden during recording */}
      {!isRecording && (
        <div className="relative flex items-center gap-2 px-4 py-3">
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground shrink-0" disabled={disabled}>
                <Plus className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start">
              <DropdownMenuItem onClick={() => openFilePicker('image')}>
                <Image className="w-4 h-4 mr-2" />Imagem
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openFilePicker('video')}>
                <Video className="w-4 h-4 mr-2" />Vídeo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openFilePicker('document')}>
                <FileText className="w-4 h-4 mr-2" />Documento
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <EmojiPicker onSelect={handleEmojiSelect} disabled={disabled} />

          <TemplatePicker
            disabled={disabled}
            onInsertText={(text) => { setMessage(text); inputRef.current?.focus(); }}
            onLoadMedia={(base64, type, caption, fileName) => {
              const mType = type === 'audio' ? 'ptt' : type;
              setMediaPreview({ type: mType, name: fileName || 'media', base64, previewUrl: type === 'image' ? base64 : undefined });
              if (caption) setMessage(caption);
              inputRef.current?.focus();
            }}
          />

          <div className="relative flex-1">
            {/* Quick replies dropdown */}
            {showQuickReplies && filteredQuickReplies.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
                {filteredQuickReplies.map((qr, i) => (
                  <button
                    key={qr.id || i}
                    onClick={() => selectQuickReply(qr)}
                    className="w-full text-left px-3 py-2 hover:bg-secondary/50 transition-colors border-b border-border/30 last:border-0"
                  >
                    <span className="text-xs font-mono text-primary">/{qr.shortCut}</span>
                    <p className="text-sm text-foreground truncate">{qr.text}</p>
                  </button>
                ))}
              </div>
            )}
            <Input
              ref={inputRef}
              placeholder={mediaPreview ? "Adicione uma legenda..." : "Digite / para respostas rápidas..."}
              value={message}
              onChange={(e) => handleMessageChange(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  if (showQuickReplies && filteredQuickReplies.length > 0) {
                    e.preventDefault();
                    selectQuickReply(filteredQuickReplies[0]);
                  } else {
                    handleSend();
                  }
                }
                if (e.key === 'Escape') setShowQuickReplies(false);
              }}
              onBlur={() => setTimeout(() => setShowQuickReplies(false), 200)}
              className="bg-secondary/30 border border-border/20 h-10 rounded-xl focus-visible:ring-primary/30 transition-colors"
              disabled={disabled}
            />
          </div>

          {message.trim() || mediaPreview ? (
            <Button size="icon" onClick={handleSend} className="shrink-0 rounded-full bg-primary hover:bg-primary/90 shadow-md shadow-primary/20 transition-all" disabled={disabled || isSendingMedia}>
              {isSendingMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground hover:text-foreground"
              onClick={startRecording}
              disabled={disabled}
            >
              <Mic className="w-5 h-5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
