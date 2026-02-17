import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { documentId, filePath } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download the file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("documents")
      .download(filePath);

    if (downloadError) throw new Error(`Download failed: ${downloadError.message}`);

    // Extract text (for text-based files)
    let extractedText = "";
    const contentType = fileData.type || "";

    if (contentType.includes("text") || contentType.includes("json") || contentType.includes("csv") || contentType.includes("xml")) {
      extractedText = await fileData.text();
    } else if (contentType.includes("pdf")) {
      // For PDFs, use AI to extract/summarize
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      // Convert to base64 for the AI
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
                { type: "text", text: "Extract ALL text content from this PDF document. Return the raw text preserving structure. Do not summarize." },
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
        extractedText = "PDF text extraction failed. You can still ask questions about this document.";
      }
    } else {
      extractedText = `File type: ${contentType}. Direct text extraction not supported for this format. Upload a text, CSV, JSON, or PDF file for best results.`;
    }

    // Update the document with extracted text
    const { error: updateError } = await supabase
      .from("documents")
      .update({ extracted_text: extractedText })
      .eq("id", documentId);

    if (updateError) throw new Error(`Update failed: ${updateError.message}`);

    return new Response(JSON.stringify({ success: true, textLength: extractedText.length }), {
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
