## Architecture Reality Check

**ChromaDB** requires a persistent Python server — this project runs on React + Supabase (no persistent backend). The equivalent is **pgvector** (Supabase's built-in vector extension), which provides the same semantic search capability.

## Plan

### 1. Generate Architecture Flowchart
- Create a Mermaid diagram showing the full pipeline with tech stack

### 2. Implement RAG Pipeline with pgvector (replaces ChromaDB)
- Enable `pgvector` extension in Supabase
- Create `document_chunks` table with vector embeddings
- Update `extract-text` edge function to chunk documents and generate embeddings via Gemini
- Update `chat` edge function to do similarity search before answering

### 3. Add Image/Flowchart Generation
- Create a new `generate-image` edge function using Lovable AI's `google/gemini-3.1-flash-image-preview` model
- Detect when AI response suggests generating an image/flowchart
- Render Mermaid diagrams inline for flowcharts
- Display generated images inline in chat

### 4. Enhanced Web Search for Current Trends
- Already partially implemented — improve the web research prompt to handle "current trends" queries better

### 5. Table Generation
- Already supported via Markdown tables in responses — ensure proper rendering

## Tech Stack
| Component | Technology |
|-----------|-----------|
| Frontend | React 18 + Tailwind + Framer Motion |
| AI Model | Google Gemini 3 Flash (chat) + Gemini 3.1 Flash Image (images) |
| Vector DB | Supabase pgvector (replaces ChromaDB) |
| Backend | Supabase Edge Functions (Deno) |
| Database | PostgreSQL (Supabase) |
| Storage | Supabase Storage |

**Note**: The Gemini model is **not trained by us** — it's a pre-trained foundation model by Google. We use it via the Lovable AI Gateway with custom system prompts and RAG context to make answers domain-specific.