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

  const handleSpeak = () => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    const cleanText = content
      .replace(/#{1,6}\s/g, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/`{1,3}[^`]*`{1,3}/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/---+/g, "")
      .replace(/📄/g, "Source: ")
      .replace(/\n{2,}/g, ". ")
      .replace(/\n/g, " ")
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Split content into main body and source attribution
  const sourceMatch = content.match(/---\n📄\s?\*\*Source:\*\*.*/s);
  const mainContent = sourceMatch ? content.slice(0, sourceMatch.index).trim() : content;
  const sourceBlock = sourceMatch ? sourceMatch[0] : null;

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
      <div className="max-w-[75%] space-y-2">
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
              <ReactMarkdown>{mainContent}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Source attribution tag */}
        {!isUser && sourceBlock && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 w-fit"
          >
            <span className="text-xs font-medium text-primary">
              {sourceBlock.replace(/---\n/, "").replace(/\*\*/g, "").trim()}
            </span>
          </motion.div>
        )}

        {/* Action buttons for assistant messages */}
        {!isUser && (
          <div className="flex items-center gap-1 pl-1">
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-md hover:bg-muted transition-colors group"
              title="Copy response"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-primary" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground" />
              )}
            </button>
            <button
              onClick={handleSpeak}
              className="p-1.5 rounded-md hover:bg-muted transition-colors group"
              title={speaking ? "Stop speaking" : "Read aloud"}
            >
              {speaking ? (
                <VolumeX className="w-3.5 h-3.5 text-primary" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground" />
              )}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
