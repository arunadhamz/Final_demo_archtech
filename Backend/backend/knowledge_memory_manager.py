"""
memory_manager.py — ArchTech RAG v5
Handles persistent knowledge storage, document versioning, and context lifecycle.
"""

import json
import uuid
import hashlib
from datetime import datetime
from pathlib import Path
from system_config import KB_PROJECTS_DIR, KB_GLOBAL_DIR

class MemoryManager:
    def __init__(self):
        self.projects_dir = KB_PROJECTS_DIR
        self.global_dir = KB_GLOBAL_DIR
        
        # Ensure base directories exist
        self.projects_dir.mkdir(parents=True, exist_ok=True)
        self.global_dir.mkdir(parents=True, exist_ok=True)

    def _get_project_dir(self, project_id: str) -> Path:
        """Returns the project directory, creating necessary subfolders."""
        p_dir = self.projects_dir / project_id
        for subdir in ["documents", "embeddings", "versions", "generated_code", "generated_docs"]:
            (p_dir / subdir).mkdir(parents=True, exist_ok=True)
        return p_dir

    def _compute_hash(self, content: str) -> str:
        return hashlib.sha256(content.encode('utf-8')).hexdigest()

    def store_document(self, content: str, source: str, project_id: str, tags: list = None, section: str = "Uncategorized", summary: str = "", doc_id: str = None) -> dict:
        """Stores a document with metadata and handles versioning based on content hash."""
        print(f"[DEBUG] MemoryManager.store_document(source='{source}', project='{project_id}')")
        p_dir = self._get_project_dir(project_id)
        content_hash = self._compute_hash(content)
        
        if not doc_id:
            doc_id = str(uuid.uuid4())
            
        doc_path = p_dir / "documents" / f"{doc_id}.json"
        
        # Handle Versioning
        current_version = "v1.0"
        if doc_path.exists():
            with open(doc_path, 'r', encoding='utf-8') as f:
                old_data = json.load(f)
            
            if old_data.get('hash') == content_hash:
                print(f"[DEBUG]   No content change detected for {source} ({doc_id}). Returning existing metadata.")
                return old_data # No change detected
            
            # Change detected, create a new version
            old_version = old_data.get('version', 'v1.0')
            try:
                major, minor = old_version.lstrip('v').split('.')
                current_version = f"v{major}.{int(minor) + 1}"
            except Exception:
                current_version = "v1.1"
            
            print(f"[DEBUG]   Content change detected. Versioning: {old_version} -> {current_version}")
            self.version_document(old_data, project_id)
        
        metadata = {
            "doc_id": doc_id,
            "project_id": project_id,
            "version": current_version,
            "source": source,
            "uploaded_at": datetime.utcnow().isoformat() + "Z",
            "tags": tags or [],
            "section": section,
            "embedding_ids": [], # To be populated by RAG engine
            "summary": summary,
            "hash": content_hash,
            "content": content,
            "usage_count": 0,
            "usage_history": []
        }
        
        with open(doc_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2)
        
        print(f"[DEBUG]   Document metadata saved to {doc_path}")
        return metadata

    def version_document(self, old_data: dict, project_id: str):
        """Moves the old document state to the versions/ directory."""
        p_dir = self._get_project_dir(project_id)
        doc_id = old_data.get('doc_id')
        version = old_data.get('version', 'v1.0')
        print(f"[DEBUG]   Archiving version {version} for doc {doc_id} to versions/ folder.")
        
        version_path = p_dir / "versions" / f"{doc_id}_{version}.json"
        with open(version_path, 'w', encoding='utf-8') as f:
            json.dump(old_data, f, indent=2)

    def retrieve_context(self, query: str):
        """Placeholder for multi-source retrieval logic"""
        pass

    def link_documents(self):
        """Placeholder for building relational memory (traceability)"""
        pass

    def track_usage(self, doc_id: str, project_id: str, context: str):
        """Tracks RAG usage for a document."""
        p_dir = self._get_project_dir(project_id)
        doc_path = p_dir / "documents" / f"{doc_id}.json"
        
        if doc_path.exists():
            with open(doc_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            data["usage_count"] = data.get("usage_count", 0) + 1
            if "usage_history" not in data:
                data["usage_history"] = []
                
            data["usage_history"].append({
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "context": context
            })
            
            with open(doc_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)

# Global Singleton
memory_manager = MemoryManager()
