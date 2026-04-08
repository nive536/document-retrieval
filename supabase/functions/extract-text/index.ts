import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    if (chunk.trim()) chunks.push(chunk.trim());
    i += chunkSize - overlap;
  }
  return chunks;
}

async function generateEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/text-embedding-004",
        input: text,
      }),
    });
    if (!response.ok) {
      console.error("Embedding API error:", response.status, await response.text());
      return null;
    }
    const data = await response.json();
    return data.data?.[0]?.embedding || null;
  } catch (e) {
    console.error("Embedding generation failed:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { documentId, filePath } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download the file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("documents")
      .download(filePath);

    if (downloadError) throw new Error(`Download failed: ${downloadError.message}`);

    // Extract text
    let extractedText = "";
    const contentType = fileData.type || "";

    if (contentType.includes("text") || contentType.includes("json") || contentType.includes("csv") || contentType.includes("xml")) {
      extractedText = await fileData.text();
    } else if (contentType.includes("pdf")) {
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const arrayBuffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "Extract ALL text content from this PDF document. Return the raw text preserving structure, headings, paragraphs, and page breaks. Do not summarize." },
                { type: "image_url", image_url: { url: `data:application/pdf;base64,${base64}` } }
              ]
            }
          ],
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        extractedText = aiData.choices?.[0]?.message?.content || "Could not extract text from PDF.";
      } else {
        extractedText = "PDF text extraction failed.";
      }
    } else {
      extractedText = `File type: ${contentType}. Direct text extraction not supported.`;
    }

    // Update document with extracted text
    const { error: updateError } = await supabase
      .from("documents")
      .update({ extracted_text: extractedText })
      .eq("id", documentId);

    if (updateError) throw new Error(`Update failed: ${updateError.message}`);

    // --- RAG: Chunk text and generate embeddings ---
    let chunksCreated = 0;
    if (LOVABLE_API_KEY && extractedText.length > 50) {
      // Delete existing chunks for this document
      await supabase.from("document_chunks").delete().eq("document_id", documentId);

      const chunks = chunkText(extractedText, 500, 50);
      console.log(`Created ${chunks.length} chunks for document ${documentId}`);

      // Process chunks in batches of 5
      for (let i = 0; i < chunks.length; i += 5) {
        const batch = chunks.slice(i, i + 5);
        const embeddings = await Promise.all(
          batch.map((chunk) => generateEmbedding(chunk, LOVABLE_API_KEY))
        );

        const rows = batch
          .map((chunk, j) => ({
            document_id: documentId,
            chunk_text: chunk,
            chunk_index: i + j,
            embedding: embeddings[j] ? JSON.stringify(embeddings[j]) : null,
          }))
          .filter((row) => row.embedding !== null);

        if (rows.length > 0) {
          const { error: insertError } = await supabase
            .from("document_chunks")
            .insert(rows);
          if (insertError) {
            console.error("Chunk insert error:", insertError);
          } else {
            chunksCreated += rows.length;
          }
        }
      }
      console.log(`Successfully stored ${chunksCreated} chunks with embeddings`);
    }

    return new Response(JSON.stringify({ success: true, textLength: extractedText.length, chunksCreated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-text error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
