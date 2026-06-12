The Full Build Plan
Layer 1 — Study Spaces and PDF Upload (Foundation)
This is the first thing to build because everything else depends on it.
What the user sees:
They land on the app. There's a sidebar. A button says "New Study Space." They click it, name it "Deep Learning," and it appears in the sidebar. They click into it. There's a PDF upload area — drag and drop or click to browse. They upload 3 PDFs. A progress indicator shows each one being processed. Once done, a green checkmark appears and they can see the list of uploaded files. Now they can start chatting.
What's happening technically:
When the user creates a study space, a record gets created in Supabase with a space ID, name, and user ID. When they upload a PDF, FastAPI receives the file, passes it through Krish Naik's existing ingestion pipeline (load → chunk → embed), but adds the space ID as metadata on every chunk before storing in Qdrant. This is the key change — every chunk knows which study space it belongs to.
When the user asks a question, the retrieval query filters by space ID first, then does semantic search within that filtered set. So "what is a neural network" inside the Deep Learning space only searches Deep Learning PDFs, not their Operating Systems PDFs.
Qdrant replaces Chroma here because Chroma's filtering is weaker. Qdrant has first-class metadata filtering and is what production systems use. This is also a resume upgrade — you can say you migrated from a local vector store to Qdrant for production-grade filtered retrieval.
What changes from Krish Naik's code:

Swap Chroma for Qdrant
Add space ID metadata to every chunk at ingestion time
Add filtered retrieval in the query function
Add FastAPI endpoint for file upload
Add Supabase table for study spaces


Layer 2 — The Socratic Response System (Core Feature)
This is your biggest differentiator. Build this second so it works on top of the new ingestion.
What the user sees:
They type a question. The response comes back in two parts. The top part is the explanation — clean, well-structured. Below it, three buttons appear as clickable chips:

"Can you give me a real-world example of this?"
"How does this connect to backpropagation?"
"What happens when this goes wrong?"

They click one. It sends as their message. The cycle continues. The conversation builds depth naturally.
What's happening technically:
You modify the final generation step. Instead of a single LLM call that returns just an answer, you restructure the prompt to return JSON:
json{
  "answer": "...",
  "follow_ups": [
    "clarification question",
    "deeper question", 
    "connection question"
  ],
  "difficulty_signal": "understood / confused / curious"
}
The difficulty signal is the agent's read on whether the user seems to be following. You get this by including the last 2-3 messages in the prompt and asking the LLM to assess. If "confused," the next follow-ups skew simpler. If "understood," they skew harder. This logic lives in a single node in LangGraph called generate_socratic_response.
The LangGraph graph for a query now looks like:
receive question
    → retrieve relevant chunks (filtered by space ID)
    → grade chunk relevance
        → if irrelevant: rewrite query and retry
        → if relevant: continue
    → generate socratic response (answer + follow-ups + difficulty signal)
    → save to conversation history
    → stream back to frontend
The follow-up chips render from the follow_ups array in the JSON response. Clicking one populates the chat input and submits it. One line of frontend code.
System prompt structure:
You are a Socratic tutor. Your job is not just to answer — 
it is to guide the student to deeper understanding.

Student level: {level}
Conversation so far: {history}
Retrieved context: {chunks}

Rules:
- Answer the question clearly and at the student's level
- After answering, generate exactly 3 follow-up questions:
  1. A clarification check ("did you follow this?")
  2. A deeper exploration ("want to go further?")
  3. A connection to related concepts
- Assess whether the student seems confused, understanding, or curious
- Never reveal you are reading from documents. Teach naturally.

Return as JSON: {answer, follow_ups, difficulty_signal}

Layer 3 — Conversation Memory and Session Management
Without this, every question feels disconnected. This is what makes it feel like a real tutor rather than a search engine.
What the user sees:
They can ask follow-up questions that reference previous answers. "You mentioned gradient descent earlier — can you expand on that?" works correctly. They can also see their conversation history in the sidebar under each study space.
What's happening technically:
Each conversation gets a session ID stored in Supabase. Every message pair (user question + assistant response) gets saved with the session ID, timestamp, and which chunks were retrieved. When a new question comes in, the last 6 messages are pulled from Supabase and included in the LangGraph state as conversation history. The LLM sees this history and can reference it.
This is a small addition — one Supabase table, one read before each query, one write after each response.
The sidebar shows past sessions per study space. User can click any past session to resume it.

Layer 4 — Quiz Generation
This is the "wow" feature for demos. One button, tangible output.
What the user sees:
At any point during a session, there's a "Quiz me" button. They click it. A modal opens with 5 multiple choice questions generated from the concepts discussed in that session. They answer all 5. They get a score. A breakdown shows which ones were right/wrong and why. Score gets saved to their profile.
What's happening technically:
When "Quiz me" is clicked, FastAPI pulls the last N retrieved chunks from that session (stored in Supabase). These chunks get passed to a dedicated quiz generation prompt:
Based on these concepts from the study material, 
generate 5 multiple choice questions that test understanding 
(not memorisation). Each question needs 4 options, 
one correct answer, and a brief explanation of why 
the correct answer is right.

Return as JSON array.
Groq generates this in under a second. The frontend renders it as an interactive quiz component. When submitted, the answers get checked client-side against the correct answers in the JSON. Score saved to Supabase.
On the user's profile page, they can see their quiz history — which spaces they've been tested on, scores over time, improving or declining. This is engagement data and makes the product feel complete.

Layer 5 — "What to Study Next" Suggestion
Small lift, high value.
What the user sees:
At the end of a session (or on demand), a button says "What should I explore next?" The agent returns 3 concept suggestions that logically follow from what was covered, with a one-line explanation of why each is relevant.
What's happening technically:
One additional LLM call that takes the session's retrieved chunks and conversation history and asks: "What are 3 related concepts in this material that this student hasn't explored yet but would logically follow from today's session?" Returns a simple list. Renders as suggestion cards. Clicking one starts a new query automatically.

Layer 6 — Frontend (React)
Layout:

Left sidebar: study spaces list, create new space button, past sessions per space
Main area: chat window with streaming responses, follow-up chips below each assistant message
Right panel (collapsible): source citations showing which PDF chunks were used

Key components:

StudySpaceManager — create, list, delete spaces
FileUpload — drag and drop, upload progress, file list per space
ChatWindow — message history, streaming text rendering
FollowUpChips — the 3 clickable follow-up buttons after each response
QuizModal — the 5-question quiz interface
CitationsPanel — shows source chunks with PDF name and page

Streaming:
FastAPI sends Server-Sent Events. The frontend reads the stream and renders tokens as they arrive. This is a small addition to both the FastAPI endpoint and the React component but makes the UX feel 10x better.

What Changes From Krish Naik's Code — Summary
Krish Naik's versionYour versionChroma local vector storeQdrant with metadata filteringSingle namespaceStudy spaces scoped by space IDTerminal / Streamlit inputReact frontendNo file upload UIDrag and drop PDF uploadAnswer onlyAnswer + follow-up chips + difficulty trackingNo memoryConversation history via SupabaseNo quizSession-based quiz generationNo user accountsSupabase auth (Phase 2 if you want)

Build Order

Swap Chroma → Qdrant, add space ID metadata to ingestion — 1 day
FastAPI endpoints for upload and query — 1 day
Modify system prompt for Socratic JSON response — half a day
React frontend: spaces, upload, chat, follow-up chips — 2-3 days
Conversation memory via Supabase — 1 day
Quiz generation + modal — 1 day
"What to study next" suggestions — half a day
Streaming responses — 1 day
Polish, citations panel, Docker — 1-2 days