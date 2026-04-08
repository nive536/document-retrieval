
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
SET search_path = public, extensions
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
