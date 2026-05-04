"""
config.py  —  ArchTech RAG v3 Centralized Configuration

This module centralizes all directory paths, model paths, and operational settings
to facilitate easy environment configuration for agents and developers.
"""

from pathlib import Path
import os

# ─── Base Directories ────────────────────────────────────────────────────────
BASE_DIR    = Path(__file__).parent.parent
UPLOAD_DIR  = BASE_DIR / "uploads"
REQ_DIR     = BASE_DIR / "output" / "requirements" # Retained as fallback for backwards compatibility

def get_req_dir(project_id: str) -> Path:
    """Returns the project-specific requirements directory."""
    d = BASE_DIR / "output" / "requirements" / project_id
    d.mkdir(parents=True, exist_ok=True)
    return d
    
CODE_DIR    = BASE_DIR / "output" / "generated_code"
TEMPLATE_DIR = BASE_DIR / "templates"
CHROMA_DIR  = BASE_DIR / "chroma_db"

MAIN_SRS_TEMPLATE_PATH = BASE_DIR / "Document_Section" / "SRS_Section" / "Main_Template" / "SRS_Template.md"
TOPIC_KNOWLEDGE_DIR_SRS = BASE_DIR / "Document_Section" / "SRS_Section" / "Topic_Template"

# ─── Knowledge Base Directories ──────────────────────────────────────────────
KNOWLEDGE_BASE_DIR = BASE_DIR / "knowledge_base"
KB_PROJECTS_DIR    = KNOWLEDGE_BASE_DIR / "projects"
KB_GLOBAL_DIR      = KNOWLEDGE_BASE_DIR / "global_library"

# ─── Model Paths ─────────────────────────────────────────────────────────────
MODEL_BASE_DIR = BASE_DIR / "models"

"""
    1. all-MiniLM-L6-v2 (Default)
    2. BAAI/bge-large-en-v1.5 (Best)
    3. intfloat/e5-large-v2 (Best)
"""
EMBEDDING_MODEL_PATH = "Embedding_model/e5-large-v2" #"BAAI/bge-large-en-v1.5"
EMBEDDING_MODEL_PATH_EXCEPTION =  "all-MiniLM-L6-v2"

# ─── Local Model Names ────────────────────────────────────────────────────────
"""
    1. LARGE MODEL (for tasks requiring deep reasoning and context understanding)
    2. MEDIUM MODEL (for tasks requiring fast inference and moderate context understanding)
    3. SMALL MODEL (for tasks requiring fast inference and minimal context understanding)
"""
META_MODEL_70B_LARGE = r"""claude-opus-4-6"""
MISTRAL_MODEL_128B_LARGE = r"""claude-opus-4-6"""
GEMMA_MODEL_31B_MEDIUM= r"""'claude-opus-4-6"""
MISTRAL_MODEL_14B_MEDIUM = r"""claude-opus-4-6"""
MISTRAL_MODEL_7B_SMALL = r"""claude-opus-4-6"""
GEMMA_MODEL_4B_SMALL   = r"""claude-opus-4-6"""


# ─── Operational Settings ────────────────────────────────────────────────────
API_HOST = "127.0.0.1"
API_PORT = 8015
API_URL = "https://llmapi05.datapatterns.co.in/v1"
API_KEY = "sk-hO8-SuEZkNdMzl3110bgpA"

# OCR Configuration (Tesseract)
TESSERACT_CMD = BASE_DIR / "tesseract"  / "Tesseract-OCR" / "tesseract.exe"

# Ensure critical directories exist
for _d in (UPLOAD_DIR, REQ_DIR, CODE_DIR, TEMPLATE_DIR, KNOWLEDGE_BASE_DIR, KB_PROJECTS_DIR, KB_GLOBAL_DIR):
    _d.mkdir(parents=True, exist_ok=True)
