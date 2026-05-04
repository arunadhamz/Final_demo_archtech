"""
main.py  —  ArchTech RAG v3 (Fixed)
Changes vs v3 original:
  • /scan — explicitly clears both the JSON requirements folder AND ChromaDB
    (rag.index_requirements() now drop-recreates the collection, so old data
    can never bleed into a new scan).
  • /generate-chain-stream — the final done=True sentinel from
    generate_document_sections() is filtered out before it reaches the client;
    only the explicit chain_phase_done + all_done events signal phase/chain end.
  • /generate-diagram — import 're' moved to module level (was inline before).
  • Minor: HTTPException import used correctly everywhere.
"""

from fastapi import FastAPI, HTTPException, File, UploadFile, BackgroundTasks, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pathlib import Path
from typing import Optional, List
import json, os, re, shutil

progress_store: dict[str, dict] = {}

os.environ["TOKENIZERS_PARALLELISM"] = "false"

try:
    from uvicorn.protocols.utils import ClientDisconnected
except ImportError:
    # Fallback for environments where uvicorn is not the driver
    class ClientDisconnected(Exception): pass

from llm_inference_engine import (
    generate_document,
    generate_document_sections,
    get_document_llm,
)
from mermaid_engine import generate_mermaid_block
from code_generation_engine import process_requirement_to_code
from system_config import UPLOAD_DIR, get_req_dir
from extractor_agent import save_to_json, scan_folder
from vector_retrieval_engine import index_requirements


app = FastAPI(
    title="ArchTech RAG",
    version="5.0",
    description="A local-first RAG system for aerospace/defense embedded systems documentation and code generation."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Chain order ──────────────────────────────────────────────────────────────
CHAIN_TYPES = ["SyRS", "HRS", "SRS", "SDD"]



class ScanRequest(BaseModel):
    folder_path: str
    project_id: str = "default_project"

class GenerateRequest(BaseModel):
    requirement_ids:  list[str]
    user_query:       str = ""
    template_type:    str = "SyRS"
    prev_doc_context: Optional[str] = ""
    project_id:       str = "default_project"

class ChainRequest(BaseModel):
    requirement_ids: list[str]
    user_query:      str = ""
    project_id:      str = "default_project"

class DiagramRequest(BaseModel):
    requirement_ids: list[str]
    diagram_heading: str = "System Block Diagram"
    project_id: str = "default_project"

class CodeRequest(BaseModel):
    requirement_ids: list[str]
    project_id:      str = "default_project"

class TraceabilityRequest(BaseModel):
    requirement_ids: list[str] = []
    project_id: str = "default_project"

class RephraseRequest(BaseModel):
    text: str
    requirement_ids: list[str] = []
    style: str = "concise"
    project_id: str = "default_project"

class AIInsightRequest(BaseModel):
    text: str
    requirement_ids: list[str] = []
    action: str = "summarize" # summarize, rephrase, custom
    user_query: Optional[str] = None
    project_id: str = "default_project"

class UpdateRequirementRequest(BaseModel):
    req_id: str
    text: str
    project_id: str = "default_project"

class ExportDocRequest(BaseModel):
    content: str
    doc_type: str


# -------------------------
# @function: _load_selected
# @description: Loads requirement data from the single requirements.json file.
# @purpose:  Loads requirement data from the single requirements.json file
# @return:    List of requirements
# -------------------------
def _load_selected(ids: list[str], project_id: str) -> list[dict]:
    """
    Load requirement data from the single requirements.json file.
    """
    req_dir = get_req_dir(project_id)
    fpath = req_dir / "requirements.json"
    if not fpath.exists():
        return []
    
    try:
        with open(fpath, encoding="utf-8") as fp:
            all_reqs = json.load(fp)
        # Filter by requested IDs
        return [r for r in all_reqs if r['id'] in ids]
    except Exception:
        return []

# -------------------------
# @function: scan_directory
# @description: Scans a directory using a background task to avoid timeouts.
# @purpose:  Scan a directory
# @return:    Progress
# -------------------------
@app.post("/scan")
async def scan_directory(request: ScanRequest, background_tasks: BackgroundTasks) -> dict:
    """
    Scans a directory using a background task to avoid timeouts.
    """
    if not os.path.exists(request.folder_path):
        raise HTTPException(status_code=404, detail="Path does not exist.")
    
    background_tasks.add_task(_background_scan, request.folder_path, request.project_id)
    return {"status": "processing", "message": "Scan started in background"}


# -------------------------
# @function: _background_scan
# @description: Background task to scan a directory.
# @purpose:  Scan a directory
# @return:    None
# -------------------------
async def _background_scan(folder_path: str, project_id: str):
    progress_store[project_id] = {"status": "starting", "message": "Background scan initializing..."}
    
    def progress_callback(update_dict: dict):
        if project_id in progress_store:
            progress_store[project_id].update(update_dict)

    # ── Clean old requirements ──────────────────────────────────
    req_dir = get_req_dir(project_id)
    for f in req_dir.glob("*.json"):
        f.unlink()
    
    # ── Extract ──────────────────────────────────────────
    reqs = await scan_folder(folder_path, progress_callback=progress_callback)
    save_to_json(reqs, str(req_dir))
    index_requirements(project_id)
    progress_store[project_id] = {"status": "complete", "message": "Background scan completed!"}


# -------------------------
# @function: get_extraction_progress
# @description: Gets the progress of an extraction.
# @purpose:  Gets the progress of an extraction
# @return:    Progress
# -------------------------
@app.get("/extraction-progress/{project_id}")
async def get_extraction_progress(project_id: str):
    return progress_store.get(project_id, {"status": "idle", "message": "Waiting..."})


# -------------------------
# @function: list_keywords
# @description: Lists keywords for a project.
# @purpose:  Lists keywords for a project
# @return:    List of keywords
# -------------------------
@app.get("/keywords/{project_id}")
def list_keywords(project_id: str):
    from vector_retrieval_engine import get_global_keywords
    return get_global_keywords(project_id)


# -------------------------
# @function: list_requirements
# @description: Lists requirements for a project.
# @purpose:  Lists requirements for a project
# @return:    List of requirements
# -------------------------
@app.get("/requirements/{project_id}")
def list_requirements(project_id: str):
    req_dir = get_req_dir(project_id)
    fpath = req_dir / "requirements.json"
    if not fpath.exists():
        return []
    try:
        return json.loads(fpath.read_text(encoding="utf-8"))
    except Exception:
        return []


# -------------------------
# @function: list_warehouse_docs
# @description: Lists files in the warehouse/knowledge directory.
# @purpose:  Lists files in the warehouse/knowledge directory
# @return:    List of files
# -------------------------
@app.get("/warehouse-list")
def list_warehouse_docs():
    """Lists files in the warehouse/knowledge directory."""
    from vector_retrieval_engine import list_warehouse_files
    return list_warehouse_files()


# -------------------------
# @function: get_project_knowledge
# @description: Retrieves all documents stored in the MemoryManager for a project.
# @purpose:  Retrieves all documents stored in the MemoryManager for a project
# @return:    List of documents
# -------------------------
@app.get("/project-knowledge/{project_id}")
async def get_project_knowledge(project_id: str) -> list[dict]:
    """Retrieves all documents stored in the MemoryManager for a project."""
    from knowledge_memory_manager import memory_manager
    import json
    p_dir = memory_manager._get_project_dir(project_id)
    docs_dir = p_dir / "documents"
    results = []
    if docs_dir.exists():
        for doc_file in docs_dir.glob("*.json"):
            try:
                with open(doc_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    results.append({
                        "doc_id": data.get("doc_id"),
                        "version": data.get("version"),
                        "source": data.get("source"),
                        "uploaded_at": data.get("uploaded_at"),
                        "tags": data.get("tags", []),
                        "section": data.get("section", "Uncategorized"),
                        "usage_count": data.get("usage_count", 0),
                        "summary": data.get("summary", ""),
                        "content": data.get("content", "")
                    })
            except Exception:
                pass
    return sorted(results, key=lambda x: x.get("uploaded_at", ""), reverse=True)


# -------------------------
# @function: get_document_versions
# @description: Retrieves all archived versions of a specific document.
# @purpose:  Retrieves all archived versions of a specific document
# @return:    List of document versions
# -------------------------
@app.get("/document-versions/{project_id}/{doc_id}")
async def get_document_versions(project_id: str, doc_id: str) -> list[dict]:
    """Retrieves all archived versions of a specific document."""
    from knowledge_memory_manager import memory_manager
    import json
    p_dir = memory_manager._get_project_dir(project_id)
    versions_dir = p_dir / "versions" 
    results = []
    if versions_dir.exists():
        for ver_file in versions_dir.glob(f"{doc_id}_*.json"):
            try:
                with open(ver_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    results.append({
                        "version": data.get("version"),
                        "uploaded_at": data.get("uploaded_at"),
                        "summary": data.get("summary", ""),
                        "tags": data.get("tags", []),
                        "content": data.get("content", ""),
                        "is_current": False
                    })
            except Exception:
                pass
    # Current active version
    current_file = p_dir / "documents" / f"{doc_id}.json"
    if current_file.exists():
        try:
            with open(current_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                results.append({
                    "version": data.get("version"),
                    "uploaded_at": data.get("uploaded_at"),
                    "summary": data.get("summary", ""),
                    "tags": data.get("tags", []),
                    "content": data.get("content", ""),
                    "is_current": True
                })
        except Exception:
            pass
    return sorted(results, key=lambda x: x.get("version", ""), reverse=True)

# -------------------------
# @function: delete_knowledge_document
# @description: Deletes a document from the memory manager.
# @purpose:  Deletes a document from the memory manager
# @return:    Success message
# -------------------------
@app.delete("/knowledge/{project_id}/{doc_id}")
async def delete_knowledge_document(project_id: str, doc_id: str):
    """Deletes a document from the memory manager."""
    from knowledge_memory_manager import memory_manager
    p_dir = memory_manager._get_project_dir(project_id)
    doc_path = p_dir / "documents" / f"{doc_id}.json" 
    
    if doc_path.exists():
        doc_path.unlink()
        # Note: In a full production system, we'd also remove from ChromaDB,
        # but ChromaDB deletion by metadata can be complex depending on version.
        return {"status": "success", "message": f"Deleted {doc_id}"}
    
    raise HTTPException(status_code=404, detail="Document not found")


# -------------------------
# @function: generate_doc
# @description: Generates a document from selected requirements.
# @purpose:  Generates a document from selected requirements
# @return:    Document
# -------------------------
@app.post("/generate-document")
async def generate_doc(request: GenerateRequest) -> dict:
    selected = _load_selected(request.requirement_ids, request.project_id)
    # Directly await the now-async generate_document
    md = await generate_document(selected)
    
    # ── Learning Loop ──
    from knowledge_memory_manager import memory_manager
    memory_manager.store_document(
        content=md,
        source="generated_doc",
        project_id=request.project_id,
        tags=["generated", request.template_type],
        summary=f"Generated {request.template_type} document"
    )
    
    return {"markdown": md}


# -------------------------
# @function: generate_doc_stream
# @description: SSE streaming — single document type.
# @purpose:  SSE streaming — single document type.
# @return:    Streaming response
# -------------------------
@app.post("/generate-document-stream")
async def generate_doc_stream(request: GenerateRequest):
    """SSE streaming — single document type."""
    selected = _load_selected(request.requirement_ids, request.project_id)

    async def event_stream():
        try:
            # Use async for to iterate over the async generator
            async for evt in generate_document_sections(selected):
                yield f"data: {json.dumps(evt)}\n\n"
        except ClientDisconnected:
            print("  ℹ️  Client disconnected during single stream.")

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":     "no-cache",
            "X-Accel-Buffering": "no",
            "Connection":        "keep-alive",
        },
    )

# -------------------------
# @function: rephrase_section
# @description: Rephrases a technical section into 3 high-quality variations.
# @purpose:  Rephrases a technical section into 3 high-quality variations
# @return:    List of 3 rephrased versions
# -------------------------
@app.post("/rephrase")
async def rephrase_section(request: RephraseRequest) -> dict:
    from llm_utilities import rephrase_content
    selected = _load_selected(request.requirement_ids, request.project_id)
    suggestions = await rephrase_content(request.text, selected, request.style)
    return {"suggestions": suggestions}
    

# -------------------------
# @function: get_ai_insight_endpoint
# @description: Generates an AI insight (summary, rephrase, or custom) for a requirement.
# @purpose:  Generates an AI insight (summary, rephrase, or custom) for a requirement
# @return:    AI insight
# -------------------------
@app.post("/ai-insight")
async def get_ai_insight_endpoint(request: AIInsightRequest) -> dict:
    from llm_utilities import get_ai_insight
    selected = _load_selected(request.requirement_ids, request.project_id)
    insight = await get_ai_insight(
        text=request.text, 
        selected_reqs=selected, 
        action=request.action, 
        user_query=request.user_query
    )
    return {"insight": insight}

# -------------------------
# @function: update_requirement_endpoint
# @description: Updates a requirement in the requirements file.
# @purpose:  Updates a requirement in the requirements file
# @return:    Success message
# -------------------------
@app.post("/update-requirement")
async def update_requirement_endpoint(request: UpdateRequirementRequest):
    req_dir = get_req_dir(request.project_id)
    fpath = req_dir / "requirements.json"
    if not fpath.exists():
        raise HTTPException(status_code=404, detail="Requirements file not found.")
    
    try:
        with open(fpath, "r", encoding="utf-8") as fp:
            all_reqs = json.load(fp)
        
        found = False
        for r in all_reqs:
            if r['id'] == request.req_id:
                r['text'] = request.text
                found = True
                break
        
        if not found:
            raise HTTPException(status_code=404, detail="Requirement ID not found.")
            
        with open(fpath, "w", encoding="utf-8") as fp:
            json.dump(all_reqs, fp, indent=4, ensure_ascii=False)
            
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------
# @function: generate_diagram
# @description: Generates a Mermaid block diagram based on technical requirements.
# @purpose:  Generates a Mermaid block diagram based on technical requirements.
# @return:    Mermaid diagram
# -------------------------
@app.post("/generate-diagram")
async def generate_diagram(request: DiagramRequest) -> dict:
    """
    Generates a Mermaid block diagram based on technical requirements.

    Logic:
        1. Loads selected requirement data.
        2. Calls LLM with a specialized Mermaid prompt.
        3. Sanitizes output to ensure compatibility with Mermaid.js.
        4. Provides a fallback diagram if LLM output is unparseable.

    Args:
        request (DiagramRequest): IDs of requirements to visualize and optional heading.

    Returns:
        dict: Contains 'mermaid' key with the raw Mermaid syntax.
    """
    try:
        selected = _load_selected(request.requirement_ids, request.project_id)
        llm      = get_document_llm()
        if not llm:
            return {"mermaid": "graph TD\nA[LLM not loaded] --> B[Check model path]"}

        block   = generate_mermaid_block(llm, request.diagram_heading, selected[:12])
        mermaid = re.sub(r"```mermaid\n?|```", "", block).strip()
        if not mermaid.startswith("graph"):
            mermaid = "graph TD\n" + mermaid
        return {"mermaid": mermaid}
    except Exception as exc:
        return {"mermaid": f"graph TD\nA[Error] --> B[\"{str(exc)[:60]}\"]"}


# -------------------------
# @function: generate_code
# @description: Generates production-quality C header and source code for selected requirements.
# @purpose:  Generates production-quality C header and source code for selected requirements.
# @return:    List of metadata for all generated files
# -------------------------
@app.post("/generate-code")
async def generate_code(request: CodeRequest) -> dict:
    """
    Generates production-quality C header and source code for selected requirements.

    Logic:
        1. Detects communication protocols (e.g., UART, PCIe) within the requirement text.
        2. Generates a .h and .c file pair for EACH detected protocol using a specialized Code LLM.
        3. Persists generated files to the 'generated_code/' directory.

    Args:
        request (CodeRequest): List of requirement IDs to transform into code.

    Returns:
        dict: List of metadata for all generated files under the 'generated' key.
    """
    all_results = []
    for rid in request.requirement_ids:
        pairs = await process_requirement_to_code(rid)
        all_results.extend(pairs)
        
    # ── Learning Loop ──
    from knowledge_memory_manager import memory_manager
    for file_meta in all_results:
        memory_manager.store_document(
            content=file_meta.get("header_content", ""),
            source="generated_code",
            project_id=request.project_id,
            tags=["code", file_meta.get("protocol", "General"), "header"],
            summary=f"Generated header for {file_meta.get('protocol', 'General')}"
        )
        memory_manager.store_document(
            content=file_meta.get("source_content", ""),
            source="generated_code",
            project_id=request.project_id,
            tags=["code", file_meta.get("protocol", "General"), "source"],
            summary=f"Generated source for {file_meta.get('protocol', 'General')}"
        )
        
    return {"generated": all_results}

# -------------------------
# @function: get_traceability_endpoint
# @description: Generates a traceability matrix between requirements.
# @purpose:  Generates a traceability matrix between requirements
# @return:    Traceability matrix
# -------------------------
@app.post("/traceability")
async def get_traceability_endpoint(request: TraceabilityRequest) -> dict:
    from vector_retrieval_engine import get_traceability
    return get_traceability(request.project_id, request.requirement_ids or None)

# -------------------------
# @function: export_document_endpoint
# @description: Exports traceability and requirements to Excel.
# @purpose:  Exports traceability and requirements to Excel
# @return:    Excel file
# -------------------------
@app.post("/export-document")
async def export_document_endpoint(request: ExportDocRequest):
    import subprocess
    import tempfile
    from fastapi.responses import FileResponse
    
    doc_type = request.doc_type.upper()
    reference_docs = {
        "SRS": "warehouse/reference/SRS/DP-SPL-0220-V1-01-SRS-1V00.odt",
        "SDD": "warehouse/reference/SDD/DP-SPL-0220-V1-01-SDD-1V00.odt",
        "HRS": "warehouse/reference/HRS/DP-SPL-0220-000-HRS-0V06.odt",
        "SYRS": "warehouse/reference/SyRS/DP-SPL-0220-V1-01-SyRS-1V00.odt"
    }
    
    ref_path = Path(__file__).parent.parent / reference_docs.get(doc_type, "")
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".md", mode="w", encoding="utf-8") as in_f:
        in_f.write(request.content)
        in_path = in_f.name
        
    out_path = in_path.replace(".md", ".odt")
    
    cmd = ["pandoc", in_path, "-f", "markdown", "-t", "odt", "-o", out_path]
    if ref_path.exists():
        cmd.extend(["--reference-doc", str(ref_path)])
        
    try:
        subprocess.run(cmd, check=True, capture_output=True)
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="Pandoc is not installed or not found in the system PATH. Please install Pandoc (https://pandoc.org/installing.html) to enable document export.")
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"Pandoc export failed: {e.stderr.decode()}")
        
    return FileResponse(out_path, media_type="application/vnd.oasis.opendocument.text", filename=f"export_{doc_type}.odt")

# -------------------------
# @function: export_excel
# @description: Exports traceability and requirements to Excel
# @purpose:  Exports traceability and requirements to Excel
# @return:    Excel file
# -------------------------
@app.post("/export-excel")
async def export_excel(request: TraceabilityRequest):
    from vector_retrieval_engine import get_traceability
    import pandas as pd
    from io import BytesIO
    
    data = get_traceability(request.project_id, request.requirement_ids or None)
    
    # Requirements sheet
    req_df = pd.DataFrame(data["requirements"])
    
    # Traceability sheet
    trace_rows = []
    for upstream, downstreams in data["matrix"].items():
        for ds in downstreams:
            trace_rows.append({
                "Upstream ID": upstream,
                "Downstream ID": ds["linked_to"],
                "Link Type": ds["link_tag"],
                "Keywords": ", ".join(ds["common_keywords"])
            })
    trace_df = pd.DataFrame(trace_rows)
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        req_df.to_excel(writer, sheet_name='Requirements', index=False)
        trace_df.to_excel(writer, sheet_name='Traceability', index=False)
    
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=ArchTech_Traceability.xlsx"}
    )

# -------------------------
# @function: upload_warehouse_files
# @description: Uploads and indexes documents into the Knowledge Warehouse using MemoryManager.
# @purpose:  Uploads and indexes documents into the Knowledge Warehouse using MemoryManager.
# @return:    List of saved documents
# -------------------------
@app.post("/upload-warehouse")
async def upload_warehouse_files(
    files: List[UploadFile] = File(...),
    project_id: str = Form("global_knowledge"),
    section: str = Form("Uncategorized"),
    tags: str = Form("")
):
    """Uploads and indexes documents into the Knowledge Warehouse using MemoryManager."""
    from knowledge_memory_manager import memory_manager
    from vector_retrieval_engine import store_document_memory
    import pdfplumber
    
    saved_count = 0
    print("Files : ", files)
    print("Project ID : ", project_id)
    print("Section : ", section)
    print("Tags : ", tags)

    for file in files:
        print(f"\n[DEBUG] >>> Processing file: {file.filename}")
        try:
            content = ""
            filename_lower = file.filename.lower()
            
            if filename_lower.endswith('.pdf'):
                print(f"[DEBUG] Extracting text from PDF using pdfplumber...")
                with pdfplumber.open(file.file) as pdf:
                    content = "\n".join([p.extract_text() or "" for p in pdf.pages])
            elif filename_lower.endswith('.docx'):
                print(f"[DEBUG] Extracting text from DOCX...")
                import docx
                import io
                file_bytes = await file.read()
                doc = docx.Document(io.BytesIO(file_bytes))
                content = "\n".join([p.text for p in doc.paragraphs])
            elif filename_lower.endswith('.odt'):
                print(f"[DEBUG] Extracting text from ODT...")
                import zipfile
                import io
                import xml.etree.ElementTree as ET
                file_bytes = await file.read()
                with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
                    xml_content = zf.read('content.xml')
                    tree = ET.fromstring(xml_content)
                    texts = []
                    for elem in tree.iter():
                        if elem.tag.endswith('}p') or elem.tag.endswith('}h'):
                            texts.append("".join(elem.itertext()))
                    content = "\n".join(texts)
            elif filename_lower.endswith(('.md', '.txt')):
                print(f"[DEBUG] Reading text/markdown file...")
                content = (await file.read()).decode("utf-8", errors="ignore")
            else:
                raise ValueError(f"Unsupported file format: {file.filename}")
            
            print(f"[DEBUG] Extraction complete. Length: {len(content)} characters.")

            # Parse custom tags
            custom_tags = [t.strip() for t in tags.split(",") if t.strip()]
            final_tags = ["knowledge_base", file.filename.split(".")[-1]] + custom_tags
            
            # Store in persistent memory structure
            print(f"[DEBUG] Storing metadata in MemoryManager (Project: {project_id})...")
            metadata = memory_manager.store_document(
                content=content,
                source=file.filename,
                project_id=project_id,
                tags=final_tags,
                section=section,
                summary=f"Uploaded knowledge file: {file.filename}"
            )
            print(f"[DEBUG] Metadata stored. Assigned Doc ID: {metadata.get('doc_id')}")
            
            # Embed chunks into ChromaDB
            chunks = [content[i:i+1000] for i in range(0, len(content), 800)]
            print(f"[DEBUG] Splitting content into {len(chunks)} chunks for vector indexing...")
            for i, chunk in enumerate(chunks):
                if len(chunk.strip()) < 50: continue
                chunk_id = f"{metadata['doc_id']}_chunk_{i}"
                store_document_memory(chunk, chunk_id, project_id, metadata)
                
            print(f"[DEBUG] <<< Successfully indexed: {file.filename}")
            saved_count += 1
        except Exception as e:
            print(f"[DEBUG] !!! Error saving {file.filename}: {e}")
            
    return {"success": True, "count": saved_count}

# -------------------------
# @function: upload_requirements_files
# @description: Uploads and indexes requirements files directly to UPLOAD_DIR and triggers a scan.
# @purpose:  Uploads and indexes requirements files directly to UPLOAD_DIR and triggers a scan.
# @return:    Success message
# -------------------------
@app.post("/upload-requirements")
async def upload_requirements_files(
    files: List[UploadFile] = File(...),
    project_id: str = Form("default_project")
):
    """Uploads files (.pdf, .odt, .docx, .md, .txt) directly to UPLOAD_DIR and triggers a scan."""
    import uuid
    
    # Create a unique batch directory for this upload to avoid Windows file locks on old files
    batch_id = uuid.uuid4().hex[:8]
    batch_dir = UPLOAD_DIR / f"batch_{batch_id}"
    batch_dir.mkdir(parents=True, exist_ok=True)
    
    for file in files:
        target = batch_dir / file.filename
        with target.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
    # Clear old extracted requirements JSONs
    req_dir = get_req_dir(project_id)
    for f in req_dir.glob("*.json"):
        try:
            f.unlink()
        except FileNotFoundError:
            pass
        except PermissionError:
            pass
            
    progress_store[project_id] = {"status": "starting", "message": f"Processing batch {batch_id}..."}
    
    def progress_callback(update_dict: dict):
        if project_id in progress_store:
            progress_store[project_id].update(update_dict)

    # Scan ONLY the newly uploaded batch directory
    reqs = await scan_folder(str(batch_dir), progress_callback=progress_callback)
    ids  = save_to_json(reqs, str(req_dir))
    index_requirements(project_id)
    
    # Attempt to clean up old batches in the background (ignore if locked)
    try:
        for old_batch in UPLOAD_DIR.iterdir():
            if old_batch.is_dir() and old_batch.name != batch_dir.name:
                shutil.rmtree(old_batch, ignore_errors=True)
    except Exception:
        pass
        
    progress_store[project_id] = {"status": "complete", "message": "Extraction complete!"}
    return {"status": "success", "extracted_count": len(ids), "ids": ids}

# -------------------------
# @function: upload_template
# @description: Uploads a custom .md template to templates/ directory.
# @purpose:  Uploads a custom .md template to templates/ directory.
# @return:    Success message
# -------------------------
@app.post("/upload-template")
async def upload_template(file: UploadFile = File(...)):
    """Uploads a custom .md template to templates/ directory."""
    from system_config import TEMPLATE_DIR
    TEMPLATE_DIR.mkdir(parents=True, exist_ok=True)
    
    if not file.filename.endswith(".md"):
        raise HTTPException(status_code=400, detail="Only .md templates are supported.")
        
    target = TEMPLATE_DIR / file.filename
    with target.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"status": "success", "filename": file.filename}



# -------------------------
# @function: frontend
# @description: Serves static files for the frontend application.
# @purpose:  Serves static files for the frontend application.
# @return:    Static files
# -------------------------
try:
    from system_config import BASE_DIR
    frontend_dist = BASE_DIR.parent / "Frontend"
    if frontend_dist.exists():
        app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
    else:
        print(f"⚠️  Frontend dist folder not found at {frontend_dist}. Proceeding in independent proxy mode.")
except Exception as e:
    print(f"⚠️  Failed to mount frontend: {e}")

# -------------------------
# @function: main
# @description: Main entry point for the ArchTech RAG application.
# @purpose:  Runs the FastAPI application server.
# @return:    N/A
# -------------------------
if __name__ == "__main__":
    import uvicorn
    print("🚀 ArchTech RAG v5.0 (Fixed) — chained document generation active")
    uvicorn.run("main:app", host="127.0.0.1", port=8015, reload=True)