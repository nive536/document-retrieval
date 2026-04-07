import { useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Bot, User, Copy, Check, Volume2, VolumeX, Globe, FileText } from "lucide-react";
import { toast } from "sonner";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  onFollowUp?: (question: string) => void;
}

export default function ChatMessage({ role, content, onFollowUp }: ChatMessageProps) {
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
      .replace(/💡/g, "")
      .replace(/🌐/g, "")
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

  // Parse content sections
  const sourceMatch = content.match(/📄\s?\*\*Sources?:\*\*\n([\s\S]*?)(?=\n---|🌐|💡|$)/);
  const followUpMatch = content.match(/💡\s?\*\*Follow-up questions:\*\*\n([\s\S]*?)(?=\n---|$)/);
  const webSourceMatch = content.match(/🌐\s?\*\*Web Knowledge Sources:\*\*\n([\s\S]*?)(?=\n---|💡|$)/);

  // Extract follow-up questions
  const followUpQuestions: string[] = [];
  if (followUpMatch) {
    const lines = followUpMatch[1].split("\n");
    for (const line of lines) {
      const q = line.replace(/^-\s*/, "").trim();
      if (q) followUpQuestions.push(q);
    }
  }

  // Extract document sources
  const docSources: string[] = [];
  if (sourceMatch) {
    const lines = sourceMatch[1].split("\n");
    for (const line of lines) {
      const s = line.replace(/^-\s*/, "").trim();
      if (s) docSources.push(s);
    }
  }

  // Extract web sources
  const webSources: string[] = [];
  if (webSourceMatch) {
    const lines = webSourceMatch[1].split("\n");
    for (const line of lines) {
      const s = line.replace(/^-\s*/, "").trim();
      if (s) webSources.push(s);
    }
  }

  // Clean main content
  let mainContent = content;
  for (const marker of ["---\n📄", "📄 **Source", "🌐 **Web", "---\n💡", "💡 **Follow"]) {
    const idx = mainContent.indexOf(marker);
    if (idx !== -1) mainContent = mainContent.slice(0, idx);
  }
  mainContent = mainContent.replace(/\n---\s*$/, "").trim();

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

        {/* Source attribution tags */}
        {!isUser && (sourceMatch || webSources.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {sourceMatch && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 w-fit"
              >
                <FileText className="w-3 h-3 text-primary" />
                <span className="text-xs font-medium text-primary">
                  {sourceMatch[0].replace(/---\n/, "").replace(/\*\*/g, "").replace(/📄\s?/, "").trim()}
                </span>
              </motion.div>
            )}
            {webSources.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 w-fit"
              >
                <Globe className="w-3 h-3 text-blue-500" />
                <span className="text-xs font-medium text-blue-500">Web Knowledge</span>
              </motion.div>
            )}
          </div>
        )}

        {/* Follow-up suggestion chips */}
        {!isUser && followUpQuestions.length > 0 && onFollowUp && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap gap-2"
          >
            {followUpQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => onFollowUp(q)}
                className="px-3 py-1.5 rounded-full border border-border bg-background text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/5 transition-all duration-200"
              >
                💡 {q}
              </button>
            ))}
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
