import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    if (!response.ok) return null;
    const data = await response.json();
    return data.data?.[0]?.embedding || null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, documentId, webSearch } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let documentContext = "";
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user")?.content || "";

    // --- RAG: Search across ALL documents globally ---
    const queryEmbedding = await generateEmbedding(lastUserMsg, LOVABLE_API_KEY);
    const sourceDocNames = new Set<string>();

    if (queryEmbedding) {
      // If a specific document is selected, search within it first
      if (documentId) {
        const { data: chunks } = await supabase.rpc("match_chunks", {
          query_embedding: JSON.stringify(queryEmbedding),
          match_document_id: documentId,
          match_threshold: 0.2,
          match_count: 8,
        });

        if (chunks && chunks.length > 0) {
          // Get document name
          const { data: doc } = await supabase
            .from("documents")
            .select("name")
            .eq("id", documentId)
            .single();

          if (doc) sourceDocNames.add(doc.name);

          const relevantText = chunks
            .map((c: any) => `[${doc?.name || "Document"} — Chunk ${c.chunk_index + 1}]\n${c.chunk_text}`)
            .join("\n\n---\n\n");
          documentContext += `\n\nRelevant sections from selected document:\n${relevantText}`;
        }
      }

      // Also search globally across ALL documents
      const { data: globalChunks } = await supabase.rpc("match_chunks_global", {
        query_embedding: JSON.stringify(queryEmbedding),
        match_threshold: 0.25,
        match_count: 10,
      });

      if (globalChunks && globalChunks.length > 0) {
        // Filter out chunks already included from the selected document
        const additionalChunks = documentId
          ? globalChunks.filter((c: any) => c.document_id !== documentId)
          : globalChunks;

        if (additionalChunks.length > 0) {
          for (const c of additionalChunks) {
            sourceDocNames.add(c.document_name);
          }
          const additionalText = additionalChunks
            .map((c: any) => `[${c.document_name} — Chunk ${c.chunk_index + 1}, Relevance: ${(c.similarity * 100).toFixed(1)}%]\n${c.chunk_text}`)
            .join("\n\n---\n\n");
          documentContext += `\n\nAdditional relevant sections from other documents in the knowledge base:\n${additionalText}`;
        }
      }
    } else if (documentId) {
      // Fallback: load full text of selected document
      const { data: doc } = await supabase
        .from("documents")
        .select("name, extracted_text")
        .eq("id", documentId)
        .single();

      if (doc?.extracted_text) {
        sourceDocNames.add(doc.name);
        documentContext = `\n\nDocument: ${doc.name}\nContent:\n${doc.extracted_text}`;
      }
    }

    if (documentContext) {
      documentContext = `\n\nYou have access to a knowledge base of uploaded documents. The following are the MOST RELEVANT sections retrieved via semantic search (RAG pipeline):${documentContext}`;
    }

    const docNamesList = Array.from(sourceDocNames);

    // --- Web search ---
    let webContext = "";
    if (webSearch) {
      try {
        const webRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: "You are a research assistant. Provide current, factual, comprehensive information with specific facts, statistics, dates, and URLs of notable sources.",
              },
              {
                role: "user",
                content: `Provide detailed, up-to-date information on: "${lastUserMsg}". Include recent developments, statistics, and cite specific sources with URLs.`,
              },
            ],
            stream: false,
          }),
        });
        if (webRes.ok) {
          const webData = await webRes.json();
          const webContent = webData.choices?.[0]?.message?.content;
          if (webContent) {
            webContext = `\n\n--- ADDITIONAL WEB KNOWLEDGE ---\n${webContent}\n--- END ---\n`;
          }
        }
      } catch (e) {
        console.error("Web knowledge fetch failed:", e);
      }
    }

    const systemPrompt = `You are DocuMind, a professional document intelligence assistant.${documentContext}${webContext}

CAPABILITIES:
- Analyze documents using RAG with semantic vector search across ALL uploaded documents
- Provide information from web sources when enabled
- Generate visual diagrams using Mermaid syntax
- Generate images when asked
- Create well-formatted markdown tables

CRITICAL INSTRUCTIONS FOR VISUAL CONTENT:
1. **Flowcharts & Diagrams**: When the user asks for a flowchart, diagram, process flow, architecture, mind map, or any visual representation — ALWAYS generate it as a Mermaid code block. Use \`\`\`mermaid syntax. Make diagrams detailed, well-structured, and visually organized with proper node shapes and connections.
2. **Image Generation**: When the user explicitly asks for an IMAGE, a picture, a visual illustration, or says "generate an image of..." — respond with the tag [GENERATE_IMAGE: detailed visual description]. Be very specific in the description for best results.
3. **Tables**: When the user asks for tabular data, ALWAYS use proper markdown table syntax with headers and alignment.

RESPONSE FORMAT:
- Use ## headings, bullet points, numbered lists, bold key terms, and code blocks
- Be precise and factual. Never speculate.
- When answering from documents, cite the document name and chunk/section

MANDATORY END SECTIONS (always include these at the end):

---
📄 **Sources:**
${docNamesList.length > 0 ? docNamesList.map(n => `- **${n}**`).join("\n") : "- General knowledge (no documents matched)"}
${webSearch ? `\n🌐 **Web Sources:**\n- [Cite specific URLs from web knowledge above]` : ""}

---
💡 **Follow-up questions:**
- [Question 1]
- [Question 2]
- [Question 3]`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage limit reached. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
