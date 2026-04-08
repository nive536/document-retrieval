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
    let documentName = "";
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user")?.content || "";

    // --- RAG: Semantic search for relevant chunks ---
    if (documentId) {
      const { data: doc } = await supabase
        .from("documents")
        .select("name, extracted_text")
        .eq("id", documentId)
        .single();

      if (doc) {
        documentName = doc.name;

        // Try vector search first
        const queryEmbedding = await generateEmbedding(lastUserMsg, LOVABLE_API_KEY);
        if (queryEmbedding) {
          const { data: chunks, error: matchError } = await supabase.rpc("match_chunks", {
            query_embedding: JSON.stringify(queryEmbedding),
            match_document_id: documentId,
            match_threshold: 0.2,
            match_count: 8,
          });

          if (!matchError && chunks && chunks.length > 0) {
            const relevantText = chunks
              .map((c: any, i: number) => `[Chunk ${c.chunk_index + 1}, Relevance: ${(c.similarity * 100).toFixed(1)}%]\n${c.chunk_text}`)
              .join("\n\n---\n\n");
            documentContext = `\n\nYou have access to the following document:\nDocument Name: ${doc.name}\n\nThe following are the MOST RELEVANT sections retrieved via semantic search (RAG pipeline):\n\n${relevantText}\n\nFull document is also available for reference. Answer based on these relevant sections primarily. Cite the chunk numbers in your response.`;
          } else {
            // Fallback to full text
            if (doc.extracted_text) {
              documentContext = `\n\nYou have access to the following document:\nDocument Name: ${doc.name}\nDocument Content:\n${doc.extracted_text}\n\nAnswer questions based on this document.`;
            }
          }
        } else if (doc.extracted_text) {
          documentContext = `\n\nYou have access to the following document:\nDocument Name: ${doc.name}\nDocument Content:\n${doc.extracted_text}\n\nAnswer questions based on this document.`;
        }
      }
    }

    // --- Web search for current trends/information ---
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
                content: "You are a research assistant specializing in providing current, factual, and comprehensive information. Include specific facts, statistics, dates, URLs of notable sources, and recent developments. Be thorough and cite sources.",
              },
              {
                role: "user",
                content: `Provide detailed, up-to-date information and current trends on this topic: "${lastUserMsg}". Include recent developments, statistics, and cite specific sources (websites, papers, reports).`,
              },
            ],
            stream: false,
          }),
        });
        if (webRes.ok) {
          const webData = await webRes.json();
          const webContent = webData.choices?.[0]?.message?.content;
          if (webContent) {
            webContext = `\n\n--- ADDITIONAL WEB KNOWLEDGE ---\nThe following is supplementary information from web sources:\n${webContent}\n--- END ADDITIONAL WEB KNOWLEDGE ---\n`;
          }
        }
      } catch (e) {
        console.error("Web knowledge fetch failed:", e);
      }
    }

    const systemPrompt = `You are DocuMind, a professional document intelligence assistant with advanced capabilities. You provide precise, well-researched, and authoritative answers.${documentContext}${webContext}

CAPABILITIES:
- You can analyze documents using RAG (Retrieval-Augmented Generation) with semantic vector search
- You can provide information from web sources when enabled
- When the user asks for a flowchart, diagram, or visual representation, generate it using Mermaid syntax wrapped in a mermaid code block
- When the user asks for a table, create well-formatted markdown tables
- When the user asks for an image, flowchart image, or visual diagram to be GENERATED as an image, respond with the tag [GENERATE_IMAGE: detailed description of the image to generate]

RESPONSE FORMAT RULES:
1. Structure every answer with clear markdown: use ## headings, bullet points, numbered lists, bold key terms, and code blocks where relevant.
2. Be precise and factual. Never speculate—if you don't know something, state it clearly.
3. When answering from a document, cite the specific chunk number, section, or paragraph where the information was found.
4. For flowcharts and diagrams, use Mermaid syntax in a \`\`\`mermaid code block.
5. For tables, use proper markdown table syntax with headers.
6. After your main answer, ALWAYS include these sections:

---
📄 **Sources:**
${documentName ? `- **${documentName}** — cite specific chunks/sections referenced` : "- State if answer is from general knowledge"}
${webSearch ? `\n🌐 **Web Knowledge Sources:**\n- [Cite specific web sources with URLs where possible]` : ""}

---
💡 **Follow-up questions:**
- [Question 1]
- [Question 2]
- [Question 3]

7. CRITICAL: Source citations must be SPECIFIC. Reference exact chunk numbers, sections, or web sources.`;

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
