# ArchTech RAG v3: Agent Understanding Document

This document provides a comprehensive map of the **ArchTech RAG v3** system, designed to help AI agents understand the architecture, data flow, and key components of this RAG-based documentation and code generation platform.

## 🏗️ Project Architecture

ArchTech RAG v3 is a local-first RAG (Retrieval-Augmented Generation) system built for aerospace/defense embedded systems documentation. It follows a decoupled Backend/Frontend architecture.

### 📁 Core Directory Map

- **`backend/`**: Python logic (FastAPI, ChromaDB, LLM integration).
- **`frontend/`**: Single-file SPA (`index.html`) + modern "Notion-style" CSS and JS components.
- **`templates/`**: Markdown templates for standard documents (SyRS, HRS, SRS, SDD).
- **`requirements/`**: JSON storage for extracted technical requirements.
- **`generated_code/`**: C/H files generated from requirements.
- **`warehouse/`**: Knowledge base containing prompts, dictionaries, and domain-specific guidance.
- **`backend/config.py`**: Centralized configuration for paths and API settings.
- **`chroma_db/`**: Persistent vector database storage.

---

## ⚙️ Backend Components

### 1. API Entry Point: `backend/main.py`
The FastAPI server exposes several key functional areas:
- **Scanning**: `/scan` reset the requirements store and re-indexes the warehouse.
- **Streaming Generation**:
    - `/generate-document-stream`: SSE stream for a single document type.
    - `/generate-chain-stream`: SSE stream for the full documentation chain (SyRS → HRS → SRS → SDD) with automated context handoff.
- **Diagrams**: `/generate-diagram` produces Mermaid diagrams with robust fallback logic.
- **Code**: `/generate-code` (Note: Currently optimized for C synthesis).

### 2. RAG & Indexing: `backend/rag.py`
- **Vector Store**: ChromaDB with `sentence-transformers` embeddings.
- **Search Logic**: Multi-stage retrieval using heading text and content snippets.
- **Traceability**: Builds relationships between requirements based on shared technical keywords.

### 3. LLM Integration: `backend/llm_handler.py`
- **Client**: `AsyncOpenAI` targeting NVIDIA Integrated API / DeepSeek endpoints.
- **Primary Model**: `deepseek-ai/deepseek-v4-flash`.
- **Key Logic**:
    - **Streaming Logic**: Real-time delta delivery with `[DONE]` sentinels.
    - **Robust Error Handling**: Automatic 3-retry logic for 429 Rate Limits, with graceful fallback to template content to prevent system crashes.
    - **Aesthetics**: Delivers "typewriter" style token streams to the frontend for a premium feel.

### 4. Extraction & Code Gen
- **`extractor.py`**: Heuristic-based PDF parsing for embedded requirements.
- **`codegen.py`**: Protocol-aware C code synthesis (UART, PCIe, etc.).

---

## 📡 API Reference (Key Endpoints)

| Endpoint | Method | Payload | Description |
| :--- | :--- | :--- | :--- |
| `/scan` | POST | `{folder_path: str}` | Extracts requirements and indexes the system. |
| `/generate-document-stream` | POST | `GenerateRequest` | SSE stream for a single document. |
| `/generate-chain-stream` | POST | `ChainRequest` | Full document lifecycle chain with context handoff. |
| `/traceability` | POST | `TraceabilityRequest` | Returns upstream/downstream link matrix. |

---

## 📑 Data Flow: The Generation Chain

The system supports a sequential document generation chain:
1.  **SyRS** → 2. **HRS** → 3. **SRS** → 4. **SDD**

**Context Handoff**: Each document's output is analyzed by `extract_context_for_next()`. The resulting context block is injected into the next phase's prompt, ensuring that software designs are grounded in hardware specs, which are grounded in system reqs.

---

## 🎨 Frontend: The "Notion" Evolution
The UI has transitioned from a basic dashboard to a **premium document editor experience**:
- **Notion Style**: Minimalist typography, off-white "paper" sheets, and subtle shadows.
- **Live Preview**: Real-time rendering of Markdown and Mermaid diagrams as they stream from the backend.
- **Status Toasts**: Interactive notifications for API status, retries, and generation success.

## 💡 Important Rationale for Agents
- **Consistency**: Always refer to `warehouse/prompts.json` for the base logic used in LLM tasks.
- **Robustness**: The backend is designed to *never* crash on LLM failure. It will always fall back to original content if the API is unreachable.
- **Indentation**: Be extremely careful with indentation in `llm_handler.py` generators; the streaming logic depends on precise block placement for `yield` and `print` statements.

---
*(Current as of April 2026)*
