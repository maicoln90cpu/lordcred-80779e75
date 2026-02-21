import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Plus, Mic, Trash2, Pause, Play, Image, Video, FileText, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import EmojiPicker from './EmojiPicker';
import type { MessageData } from './MessageContextMenu';

interface ChatInputProps {
  onSend: (text: string) => void;
  onSendMedia: (mediaBase64: string, mediaType: string, caption: string, fileName?: string) => void;
  disabled?: boolean;
  replyTo?: MessageData | null;
  onCancelReply?: () => void;
}

export default function ChatInput({ onSend, onSendMedia, disabled, replyTo, onCancelReply }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaPreview, setMediaPreview] = useState<{ type: string; name: string; base64: string; previewUrl?: string } | null>(null);
  const [isSendingMedia, setIsSendingMedia] = useState(false);
  const [waveformBars, setWaveformBars] = useState<number[]>(new Array(30).fill(4));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileTypeRef = useRef<string>('image');
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

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

  return (
    <div className="border-t border-border/50 bg-card/50">
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
            ) : (
              <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                {mediaPreview.type === 'ptt' || mediaPreview.type === 'audio' ? (
                  <Mic className="w-5 h-5 text-muted-foreground" />
                ) : mediaPreview.type === 'video' ? (
                  <Video className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <FileText className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{mediaPreview.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{mediaPreview.type}</p>
            </div>
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
        <div className="flex items-center gap-2 px-4 py-3">
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

          <Input
            placeholder={mediaPreview ? "Adicione uma legenda..." : "Digite uma mensagem..."}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            className="bg-secondary/50 border-0 h-10"
            disabled={disabled}
          />

          {message.trim() || mediaPreview ? (
            <Button size="icon" onClick={handleSend} className="shrink-0" disabled={disabled || isSendingMedia}>
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
