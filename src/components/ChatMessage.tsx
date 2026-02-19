import { useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Bot, User, Copy, Check, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

export default function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAudio = () => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };

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
      <div className="max-w-[75%] group">
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
            <div className="prose prose-sm max-w-none text-card-foreground prose-headings:text-card-foreground prose-p:text-card-foreground prose-li:text-card-foreground prose-strong:text-card-foreground prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:rounded">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
        </div>
        {!isUser && (
          <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Copy"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={handleAudio}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title={speaking ? "Stop" : "Listen"}
            >
              {speaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
