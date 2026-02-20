import { useState, useRef, useCallback } from 'react';
import { Send, Plus, Mic, MicOff, Image, Video, FileText, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
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
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaPreview, setMediaPreview] = useState<{ type: string; name: string; base64: string; previewUrl?: string } | null>(null);
  const [isSendingMedia, setIsSendingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileTypeRef = useRef<string>('image');

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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
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
      setRecordingTime(0);

      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (e) {
      console.error('Failed to start recording:', e);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      mediaRecorderRef.current = null;
      chunksRef.current = [];
      setIsRecording(false);
      setRecordingTime(0);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

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

      {/* Recording indicator */}
      {isRecording && (
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-destructive/10">
            <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
            <span className="text-sm font-medium text-destructive">Gravando {formatTime(recordingTime)}</span>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={cancelRecording} className="text-destructive">
              <X className="w-4 h-4 mr-1" />Cancelar
            </Button>
            <Button size="sm" onClick={stopRecording} className="bg-destructive text-destructive-foreground">
              <MicOff className="w-4 h-4 mr-1" />Parar
            </Button>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="flex items-center gap-2 px-4 py-3">
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground shrink-0" disabled={disabled || isRecording}>
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

        <EmojiPicker onSelect={handleEmojiSelect} disabled={disabled || isRecording} />

        <Input
          placeholder={mediaPreview ? "Adicione uma legenda..." : "Digite uma mensagem..."}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          className="bg-secondary/50 border-0 h-10"
          disabled={disabled || isRecording}
        />

        {message.trim() || mediaPreview ? (
          <Button size="icon" onClick={handleSend} className="shrink-0" disabled={disabled || isSendingMedia}>
            {isSendingMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className={cn("shrink-0", isRecording ? "text-destructive" : "text-muted-foreground hover:text-foreground")}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={disabled}
          >
            <Mic className="w-5 h-5" />
          </Button>
        )}
      </div>
    </div>
  );
}
