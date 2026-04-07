import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, documentId, webSearch } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let documentContext = "";
    let documentName = "";

    if (documentId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: doc } = await supabase
        .from("documents")
        .select("name, extracted_text")
        .eq("id", documentId)
        .single();

      if (doc?.extracted_text) {
        documentName = doc.name;
        documentContext = `\n\nYou have access to the following document:\nDocument Name: ${doc.name}\nDocument Content:\n${doc.extracted_text}\n\nAnswer questions based on this document. If the answer is not in the document, say so clearly.`;
      }
    }

    // If web search is requested, do a preliminary AI call for web knowledge
    let webContext = "";
    if (webSearch) {
      const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user")?.content || "";
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
                content: "You are a research assistant. Provide factual, up-to-date information on the given topic. Include specific facts, statistics, dates, and notable details. Cite general knowledge sources where possible (e.g., Wikipedia, official documentation, research papers). Be concise but comprehensive. Format as bullet points.",
              },
              {
                role: "user",
                content: `Provide additional background information and context on this topic: "${lastUserMsg}"`,
              },
            ],
            stream: false,
          }),
        });
        if (webRes.ok) {
          const webData = await webRes.json();
          const webContent = webData.choices?.[0]?.message?.content;
          if (webContent) {
            webContext = `\n\n--- ADDITIONAL KNOWLEDGE ---\nThe following is supplementary information from general knowledge sources:\n${webContent}\n--- END ADDITIONAL KNOWLEDGE ---\n`;
          }
        }
      } catch (e) {
        console.error("Web knowledge fetch failed:", e);
      }
    }

    const systemPrompt = `You are DocuMind, a professional document intelligence assistant. You provide precise, well-researched, and authoritative answers. Maintain a formal yet accessible tone.${documentContext}${webContext}

RESPONSE FORMAT RULES:
1. Structure every answer with clear markdown: use ## headings, bullet points, numbered lists, bold key terms, and code blocks where relevant.
2. Be precise and factual. Never speculate—if you don't know something, state it clearly.
3. When answering from a document, cite the EXACT section, paragraph, page, or heading where the information was found. Use inline citations like (Section 2.3) or (Page 5, Paragraph 2) within your answer text.
4. After your main answer, ALWAYS include these sections in this exact order:

---
📄 **Sources:**
${documentName ? `- **${documentName}** — cite specific sections/pages/paragraphs referenced (e.g., "Section 3.1: Overview", "Page 2, Paragraph 4")` : "- State if answer is from general knowledge"}
${webSearch ? `\n🌐 **Web Knowledge Sources:**\n- [Specific topic area and type of source, e.g., "WHO Guidelines on X", "IEEE Standard Y"]` : ""}

---
💡 **Follow-up questions:**
- [Question 1]
- [Question 2]
- [Question 3]

5. CRITICAL: Source citations must be SPECIFIC. Never say just "Source: Document". Always reference the exact part of the document (heading, section number, paragraph, page, table, or quote) that supports your answer.
6. If multiple parts of the document are relevant, list each source separately with its specific location.`;

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
