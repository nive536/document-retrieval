import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, User, Copy, Check, Volume2, VolumeX } from "lucide-react";
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

  const mainContent = content;

  // Extract mermaid blocks and images, render them separately
  const parts: { type: "text" | "mermaid" | "image"; content: string }[] = [];
  // Match both mermaid blocks and markdown images
  const blockRegex = /```mermaid\n([\s\S]*?)```|!\[([^\]]*)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match;

  while ((match = blockRegex.exec(mainContent)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: mainContent.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      // Mermaid block
      parts.push({ type: "mermaid", content: match[1].trim() });
    } else if (match[3]) {
      // Image
      parts.push({ type: "image", content: match[3] });
    }
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
            <div className="prose prose-sm max-w-none text-card-foreground prose-headings:text-card-foreground prose-p:text-card-foreground prose-li:text-card-foreground prose-strong:text-card-foreground prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:rounded prose-img:rounded-xl prose-img:shadow-lg prose-img:max-w-full prose-table:border-collapse prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-2 prose-th:bg-muted prose-th:text-left prose-th:font-semibold prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-2">
              {parts.map((part, i) =>
                part.type === "mermaid" ? (
                  <MermaidDiagram key={i} chart={part.content} />
                ) : part.type === "image" ? (
                  <div key={i} className="my-4">
                    <img
                      src={part.content}
                      alt="Generated image"
                      className="rounded-xl shadow-lg max-w-full"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>{part.content}</ReactMarkdown>
                )
              )}
            </div>
          )}
        </div>




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
