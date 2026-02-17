import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import DocumentSidebar from "@/components/DocumentSidebar";
import ChatInterface from "@/components/ChatInterface";
import UploadDialog from "@/components/UploadDialog";
import { toast } from "sonner";

interface Document {
  id: string;
  name: string;
  created_at: string;
  file_size?: number;
}

const Index = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = useCallback(async () => {
    const { data, error } = await supabase
      .from("documents")
      .select("id, name, created_at, file_size")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load documents");
    } else {
      setDocuments(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleUploaded = (docId: string) => {
    fetchDocuments();
    setSelectedDocId(docId);
  };

  const handleDelete = async (id: string) => {
    const doc = documents.find((d) => d.id === id);
    if (!doc) return;

    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete document");
    } else {
      if (selectedDocId === id) setSelectedDocId(null);
      fetchDocuments();
      toast.success(`"${doc.name}" deleted`);
    }
  };

  const selectedDoc = documents.find((d) => d.id === selectedDocId);

  return (
    <div className="flex h-screen bg-background">
      <DocumentSidebar
        documents={documents}
        selectedDocId={selectedDocId}
        onSelect={setSelectedDocId}
        onUploadClick={() => setUploadOpen(true)}
        onDelete={handleDelete}
        isLoading={loading}
      />
      <ChatInterface
        documentId={selectedDocId}
        documentName={selectedDoc?.name || null}
      />
      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={handleUploaded}
      />
    </div>
  );
};

export default Index;
