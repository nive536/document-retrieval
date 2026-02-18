import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Sparkles, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import ChatMessage from "./ChatMessage";
import { streamChat } from "@/lib/chat-stream";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatInterfaceProps {
  documentIds: string[];
  documentNames: string[];
}

export default function ChatInterface({ documentIds, documentNames }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset chat when document selection changes
  useEffect(() => {
    setMessages([]);
  }, [documentIds.join(",")]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Message = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
          );
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      await streamChat({
        messages: [...messages, userMsg],
        documentIds: documentIds.length > 0 ? documentIds : undefined,
        onDelta: upsertAssistant,
        onDone: () => setIsLoading(false),
        onError: (error) => {
          toast.error(error);
          setIsLoading(false);
        },
      });
    } catch (e) {
      console.error(e);
      toast.error("Failed to send message");
      setIsLoading(false);
    }
  };

  const hasDocuments = documentIds.length > 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center glow-primary">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-foreground">
              {hasDocuments
                ? `Chatting with ${documentNames.length} document${documentNames.length > 1 ? "s" : ""}`
                : "DocuMind AI"}
            </h2>
            {hasDocuments && (
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {documentNames.map((name, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20"
                  >
                    <FileText className="w-2.5 h-2.5" />
                    {name.length > 20 ? name.slice(0, 20) + "…" : name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        {!hasDocuments && (
          <p className="text-sm text-muted-foreground mt-1 ml-10">
            Select documents from the sidebar or chat freely
          </p>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        <AnimatePresence>
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full text-center"
            >
              <div className="w-20 h-20 rounded-3xl gradient-primary flex items-center justify-center mb-6 glow-primary">
                <Sparkles className="w-10 h-10 text-primary-foreground" />
              </div>
              <h3 className="font-display text-2xl font-bold text-foreground mb-2">
                {hasDocuments ? "Ask anything about your documents" : "Welcome to DocuMind"}
              </h3>
              <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
                {hasDocuments
                  ? "I've analyzed your documents. Ask me questions and I'll find the answers with source references."
                  : "Upload documents and select them to start asking questions. I'll help you understand your data with cited sources."}
              </p>
              <div className="flex gap-2 mt-8 flex-wrap justify-center">
                {(hasDocuments
                  ? ["Summarize these documents", "What are the key points?", "Compare the documents"]
                  : ["What can you do?", "How does this work?", "Help me get started"]
                ).map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/5 transition-all"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {messages.map((msg, i) => (
          <ChatMessage key={i} role={msg.role} content={msg.content} />
        ))}
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center glow-primary">
              <Loader2 className="w-4 h-4 text-primary-foreground animate-spin" />
            </div>
            <div className="bg-card rounded-2xl rounded-tl-sm px-4 py-3 shadow-card border border-border">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse-glow [animation-delay:0.2s]" />
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse-glow [animation-delay:0.4s]" />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-4 bg-card/30 backdrop-blur-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex gap-2 max-w-3xl mx-auto"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={hasDocuments ? "Ask about your documents..." : "Type a message..."}
            disabled={isLoading}
            className="flex-1 px-4 py-3 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          />
          <Button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="gradient-primary text-primary-foreground rounded-xl px-4 hover:opacity-90 transition-opacity glow-primary"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
