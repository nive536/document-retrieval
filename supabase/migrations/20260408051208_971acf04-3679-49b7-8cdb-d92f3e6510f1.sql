
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Create document_chunks table
CREATE TABLE public.document_chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding extensions.vector(768),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for vector similarity search
CREATE INDEX idx_document_chunks_embedding ON public.document_chunks
USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists = 100);

-- Create index for document_id lookups
CREATE INDEX idx_document_chunks_document_id ON public.document_chunks(document_id);

-- Enable RLS
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view document chunks"
ON public.document_chunks FOR SELECT USING (true);

CREATE POLICY "Anyone can create document chunks"
ON public.document_chunks FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can delete document chunks"
ON public.document_chunks FOR DELETE USING (true);

-- Create match_chunks function for similarity search
CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding extensions.vector(768),
  match_document_id UUID,
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  chunk_text TEXT,
  chunk_index INTEGER,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    dc.id,
    dc.chunk_text,
    dc.chunk_index,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks dc
  WHERE dc.document_id = match_document_id
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
$$;
