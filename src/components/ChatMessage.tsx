import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Bot, User, Copy, Check, Volume2, VolumeX, Globe, FileText } from "lucide-react";
import { toast } from "sonner";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  onFollowUp?: (question: string) => void;
}

function MermaidDiagram({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "loose" });
        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        const { svg: rendered } = await mermaid.render(id, chart);
        if (!cancelled) setSvg(rendered);
      } catch (e) {
        console.error("Mermaid render error:", e);
        if (!cancelled) setSvg(`<pre style="color:red">Diagram render failed</pre>`);
      }
    })();
    return () => { cancelled = true; };
  }, [chart]);

  return (
    <div
      ref={containerRef}
      className="my-4 p-4 bg-muted/50 rounded-xl border border-border overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
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

  const followUpQuestions: string[] = [];
  if (followUpMatch) {
    for (const line of followUpMatch[1].split("\n")) {
      const q = line.replace(/^-\s*/, "").trim();
      if (q) followUpQuestions.push(q);
    }
  }

  const docSources: string[] = [];
  if (sourceMatch) {
    for (const line of sourceMatch[1].split("\n")) {
      const s = line.replace(/^-\s*/, "").trim();
      if (s) docSources.push(s);
    }
  }

  const webSources: string[] = [];
  if (webSourceMatch) {
    for (const line of webSourceMatch[1].split("\n")) {
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

  // Extract mermaid blocks and render them separately
  const parts: { type: "text" | "mermaid" | "image"; content: string }[] = [];
  const mermaidRegex = /```mermaid\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = mermaidRegex.exec(mainContent)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: mainContent.slice(lastIndex, match.index) });
    }
    parts.push({ type: "mermaid", content: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < mainContent.length) {
    parts.push({ type: "text", content: mainContent.slice(lastIndex) });
  }
  if (parts.length === 0) {
    parts.push({ type: "text", content: mainContent });
  }

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
            <div className="prose prose-sm max-w-none text-card-foreground prose-headings:text-card-foreground prose-p:text-card-foreground prose-li:text-card-foreground prose-strong:text-card-foreground prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:rounded prose-img:rounded-xl prose-img:shadow-lg prose-img:max-w-full">
              {parts.map((part, i) =>
                part.type === "mermaid" ? (
                  <MermaidDiagram key={i} chart={part.content} />
                ) : (
                  <ReactMarkdown key={i}>{part.content}</ReactMarkdown>
                )
              )}
            </div>
          )}
        </div>

        {/* Source attribution tags */}
        {!isUser && (docSources.length > 0 || webSources.length > 0) && (
          <div className="flex flex-col gap-2">
            {docSources.map((src, i) => (
              <motion.div
                key={`doc-${i}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20"
              >
                <FileText className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-xs font-medium text-primary">
                  {src.replace(/\*\*/g, "")}
                </span>
              </motion.div>
            ))}
            {webSources.map((src, i) => (
              <motion.div
                key={`web-${i}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="flex items-start gap-1.5 px-3 py-1.5 rounded-lg bg-accent/50 border border-border"
              >
                <Globe className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                <span className="text-xs font-medium text-muted-foreground">
                  {src.replace(/\*\*/g, "")}
                </span>
              </motion.div>
            ))}
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

        {/* Action buttons */}
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
