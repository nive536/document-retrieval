import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import ChatMessage from "./ChatMessage";
import { streamChat } from "@/lib/chat-stream";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatInterfaceProps {
  documentId: string | null;
  documentName: string | null;
}

export default function ChatInterface({ documentId, documentName }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
  }, [documentId]);

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
        documentId: documentId || undefined,
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

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="font-display font-semibold text-foreground">
            {documentName ? `Chat with "${documentName}"` : "DocuMind AI"}
          </h2>
        </div>
        {!documentId && (
          <p className="text-sm text-muted-foreground mt-1">
            Upload a document to ask questions about it, or chat freely
          </p>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full text-center"
          >
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mb-4 glow-primary">
              <Sparkles className="w-8 h-8 text-primary-foreground" />
            </div>
            <h3 className="font-display text-xl font-semibold text-foreground mb-2">
              {documentId ? "Ask anything about your document" : "Welcome to DocuMind"}
            </h3>
            <p className="text-muted-foreground max-w-md text-sm">
              {documentId
                ? "I've analyzed your document. Ask me questions and I'll find the answers."
                : "Upload a document and start asking questions. I'll help you understand your data."}
            </p>
            <div className="flex gap-2 mt-6 flex-wrap justify-center">
              {(documentId
                ? ["Summarize this document", "What are the key points?", "Explain in simple terms"]
                : ["What can you do?", "How does this work?", "Help me get started"]
              ).map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="px-4 py-2 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </motion.div>
        )}
        {messages.map((msg, i) => (
          <ChatMessage key={i} role={msg.role} content={msg.content} />
        ))}
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-primary-foreground animate-spin" />
            </div>
            <div className="bg-card rounded-2xl rounded-tl-md px-4 py-3 shadow-card border border-border">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse-glow [animation-delay:0.2s]" />
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse-glow [animation-delay:0.4s]" />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={documentId ? "Ask about your document..." : "Type a message..."}
            disabled={isLoading}
            className="flex-1 px-4 py-3 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          />
          <Button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="gradient-primary text-primary-foreground rounded-xl px-4 hover:opacity-90 transition-opacity"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
