# ArchTech RAG v3 🚀

**ArchTech RAG v3** is a specialized Retrieval-Augmented Generation (RAG) platform designed for the rigorous demands of aerospace and defense embedded systems. It transforms raw technical requirements into structured, high-fidelity documentation (SyRS, HRS, SRS, SDD) and synthesizes production-ready C code.

![UI Screenshot](https://raw.githubusercontent.com/MukeshKumar-M-1/ArchTech_AI/main/assets/ui_preview.png) *(Placeholder for actual screenshot)*

## 💎 Premium Design: Notion-Style Experience
The platform features a modern, premium **Notion-inspired interface**.
- **Clean Aesthetics**: Off-white "Notion" paper backgrounds, minimalist gray toolbars, and elegant typography.
- **Dynamic Interactions**: Micro-animations, cascading content reveals, and a real-time streaming "typewriter" effect for LLM output.
- **Responsive Layout**: Designed for high-density technical work without visual clutter.

## 🌟 Key Capabilities

### 1. Requirements Intelligence
- **Automated Extraction**: Scans multi-page PDFs to extract functional and non-functional requirements into structured JSON.
- **Semantic Search**: Powered by ChromaDB, ensuring the LLM has high-precision context from previous documents and external standards.

### 2. Chained Document Flow (Document Hand-off)
The centerpiece of ArchTech RAG. It manages the entire lifecycle of system documentation:
- **Sequential Generation**: SyRS (System Requirements) → HRS (Hardware) → SRS (Software) → SDD (Design).
- **Context Handoff**: Automatically extracts technical context from one phase to ground the next, ensuring perfect architectural consistency.

### 3. Real-Time SSE Streaming
- **Low Latency**: Watch documents being "typed" in real-time.
- **Status Tracking**: Live updates on API status, retry attempts, and rate-limit handling (429 protection).

### 4. Diagrams-as-Code (Mermaid.js)
- **Automatic Visualization**: Generates System Block Diagrams and Flowcharts directly from requirement text using Mermaid syntax.
- **Robustness**: Features built-in sanitization and fallback logic for unparseable LLM output.

### 5. Embedded Code Synthesis
- **C Generation**: Produces ANSI C header and source files for detected protocols (UART, SPI, I2C, PCIe, MIL-STD-1553).
- **Domain Specific**: Focused on high-reliability embedded patterns suitable for avionics.

## 🛠️ Technology Stack
- **Backend**: FastAPI (Python 3.10+)
- **LLM Engine**: DeepSeek-V4-Flash & NVIDIA Integrated API
- **Vector Store**: ChromaDB
- **Frontend**: Vanilla JS (Modern ES6+), Notion-inspired CSS
- **Visualization**: Mermaid.js, Marked.js (GFM)

## 📋 Getting Started

### 1. Prerequisites
- Python 3.10 or higher
- A valid NVIDIA API key (configured in `backend/llm_handler.py`)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/MukeshKumar-M-1/ArchTech_AI.git
cd RAG_v3

# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\activate

choco install tesseract -y

# Install dependencies
pip install -r requirements.txt
```

### 3. Configuration
Currently, API keys and model endpoints are managed in `backend/llm_handler.py`. Ensure your network has access to `integrate.api.nvidia.com`.

### 4. Launch
```bash
python backend/main.py
```
Open your browser and navigate to `http://127.0.0.1:8015`.

## 🤖 For AI Assistants
Refer to `.clinerules/` for detailed agent guidelines and the `workflow_1.md` for current development state.

---
*ArchTech RAG — Bridging the gap between requirements and reality.*
