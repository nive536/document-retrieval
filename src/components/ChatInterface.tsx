import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Sparkles, Trash2, Globe } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import ChatMessage from "./ChatMessage";
import { streamChat } from "@/lib/chat-stream";
import { supabase } from "@/integrations/supabase/client";
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
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadHistory = useCallback(async () => {
    setHistoryLoaded(false);
    const query = supabase
      .from("chat_messages")
      .select("role, content")
      .order("created_at", { ascending: true });

    if (documentId) {
      query.eq("document_id", documentId);
    } else {
      query.is("document_id", null);
    }

    const { data } = await query;
    if (data && data.length > 0) {
      setMessages(data.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
    } else {
      setMessages([]);
    }
    setHistoryLoaded(true);
  }, [documentId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const saveMessage = async (role: string, content: string) => {
    await supabase.from("chat_messages").insert({
      role,
      content,
      document_id: documentId || null,
    });
  };

  const handleClearHistory = async () => {
    const query = supabase.from("chat_messages").delete();
    if (documentId) {
      query.eq("document_id", documentId);
    } else {
      query.is("document_id", null);
    }
    await query;
    setMessages([]);
    toast.success("Chat history cleared");
  };

  const handleFollowUp = (question: string) => {
    setInput(question);
  };

  const send = async (overrideInput?: string) => {
    const trimmed = (overrideInput || input).trim();
    if (!trimmed || isLoading) return;

    const userMsg: Message = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    saveMessage("user", trimmed);

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
        webSearch: webSearchEnabled,
        onDelta: upsertAssistant,
        onDone: () => {
          setIsLoading(false);
          if (assistantSoFar) saveMessage("assistant", assistantSoFar);
        },
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="font-display font-semibold text-foreground">
              {documentName ? `Chat with "${documentName}"` : "DocuMind AI"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearHistory}
                className="text-muted-foreground hover:text-destructive gap-1.5 text-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </Button>
            )}
          </div>
        </div>
        {!documentId && (
          <p className="text-sm text-muted-foreground mt-1">
            Upload a document to ask questions about it, or chat freely
          </p>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && historyLoaded && (
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
          <ChatMessage
            key={i}
            role={msg.role}
            content={msg.content}
            onFollowUp={handleFollowUp}
          />
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
          <div className="flex-1 flex items-center gap-2 px-4 py-2 rounded-xl border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={documentId ? "Ask about your document..." : "Type a message..."}
              disabled={isLoading}
              className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-sm"
            />
            <button
              type="button"
              onClick={() => setWebSearchEnabled(!webSearchEnabled)}
              className={`p-1.5 rounded-md transition-colors ${
                webSearchEnabled
                  ? "text-blue-500 bg-blue-500/10"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title={webSearchEnabled ? "Web knowledge enabled" : "Web knowledge disabled"}
            >
              <Globe className="w-4 h-4" />
            </button>
          </div>
          <Button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="gradient-primary text-primary-foreground rounded-xl px-4 hover:opacity-90 transition-opacity"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
          {webSearchEnabled ? "🌐 Web knowledge is ON — answers include additional context" : "Web knowledge is OFF — answers use document only"}
        </p>
      </div>
    </div>
  );
}
