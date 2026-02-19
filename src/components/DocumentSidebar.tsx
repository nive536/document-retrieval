import { FileText, Plus, Trash2, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import ThemeToggle from "./ThemeToggle";

interface Document {
  id: string;
  name: string;
  created_at: string;
  file_size?: number;
}

interface DocumentSidebarProps {
  documents: Document[];
  selectedDocId: string | null;
  onSelect: (id: string) => void;
  onUploadClick: () => void;
  onDelete: (id: string) => void;
  isLoading: boolean;
}

function formatSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentSidebar({
  documents,
  selectedDocId,
  onSelect,
  onUploadClick,
  onDelete,
  isLoading,
}: DocumentSidebarProps) {
  return (
    <aside className="w-72 h-full flex flex-col bg-sidebar border-r border-sidebar-border">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary-foreground" />
            </div>
            <h1 className="font-display text-lg font-bold text-sidebar-foreground">DocuMind</h1>
          </div>
          <ThemeToggle />
        </div>
        <Button
          onClick={onUploadClick}
          className="w-full gradient-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8 px-4">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-40" />
            <p className="text-sm text-muted-foreground">No documents yet</p>
            <p className="text-xs text-muted-foreground mt-1">Upload a file to get started</p>
          </div>
        ) : (
          <AnimatePresence>
            {documents.map((doc) => (
              <motion.button
                key={doc.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onClick={() => onSelect(doc.id)}
                className={`w-full text-left p-3 rounded-lg mb-1 group transition-colors ${
                  selectedDocId === doc.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <FileText className="w-4 h-4 mt-0.5 flex-shrink-0 text-sidebar-primary" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatSize(doc.file_size)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(doc.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/20 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </button>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        <p className="text-xs text-muted-foreground text-center">DocuMind AI v1.0</p>
      </div>
    </aside>
  );
}
