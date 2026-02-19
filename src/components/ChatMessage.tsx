import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Bot, User, Volume2, VolumeX, Loader2 } from "lucide-react";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

export default function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === "user";
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  const handleSpeak = useCallback(() => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    setIsLoadingAudio(true);
    // Strip markdown for cleaner speech
    const plainText = content
      .replace(/[#*_~`>\-|]/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\n+/g, ". ");

    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onstart = () => {
      setIsLoadingAudio(false);
      setIsSpeaking(true);
    };
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => {
      setIsLoadingAudio(false);
      setIsSpeaking(false);
    };
    window.speechSynthesis.speak(utterance);
  }, [content, isSpeaking]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "gradient-primary text-primary-foreground"
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className="flex flex-col gap-1 max-w-[75%]">
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-md"
              : "bg-card text-card-foreground shadow-card rounded-tl-md border border-border"
          }`}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed">{content}</p>
          ) : (
            <div className="prose prose-sm max-w-none text-card-foreground prose-headings:text-card-foreground prose-p:text-card-foreground prose-li:text-card-foreground prose-strong:text-card-foreground prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:rounded prose-hr:border-border">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
        </div>
        {!isUser && content && (
          <button
            onClick={handleSpeak}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors self-start ml-1"
            title={isSpeaking ? "Stop speaking" : "Listen to response"}
          >
            {isLoadingAudio ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isSpeaking ? (
              <VolumeX className="w-3.5 h-3.5" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
            {isSpeaking ? "Stop" : "Listen"}
          </button>
        )}
      </div>
    </motion.div>
  );
}
