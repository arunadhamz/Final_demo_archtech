"""
codegen.py  —  ArchTech RAG v3
Changes vs v2:
  • detect_all_protocols() — finds ALL protocols in a requirement (not just first match)
  • generate_for_protocol() — generates one .h / .c pair per interface
  • process_requirement_to_code() now returns a list of file pairs (one per protocol)
  • Markdown fences still stripped from output
  • import re at top
"""

import re
import json
from pathlib import Path
from llm_inference_engine import get_code_llm

from system_config import CODE_DIR

# ─── Protocol detection ───────────────────────────────────────────────────────
# Load dictionaries from warehouse
warehouse_path = Path(__file__).parent.parent / "warehouse"

with open(warehouse_path / "dicts.json", "r") as f:
    warehouse_dicts = json.load(f)

_PROTOCOL_MAP = warehouse_dicts["protocol_map"]

def detect_protocol(text: str) -> str:
    """Return the first matched protocol or 'General'."""
    t = text.lower()
    for proto, variants in _PROTOCOL_MAP.items():
        if any(v in t for v in variants):
            return proto
    return "General"


def detect_all_protocols(text: str) -> list[str]:
    """Return ALL matched protocols.  Falls back to ['General'] if none found."""
    t = text.lower()
    found = []
    for proto, variants in _PROTOCOL_MAP.items():
        if any(v in t for v in variants):
            found.append(proto)
    return found if found else ["General"]


# ─── Code generator ───────────────────────────────────────────────────────────

_HEADER_MARKER = "=== HEADER (.h) ==="
_SOURCE_MARKER = "=== SOURCE (.c) ==="


def _strip_fences(code: str) -> str:
    """Remove ```c ... ``` Markdown fences from LLM output."""
    return re.sub(r"```[a-zA-Z]*\n?", "", code).strip()


class CodeGenerator:
    def __init__(self):
        self.llm = get_code_llm()

    async def generate(self, requirement_text: str, protocol: str) -> dict:
        """
        Generates C code for a specific requirement and protocol using the Code LLM.
        """
        if not self.llm:
            return {"error": "Code LLM not loaded — check model path in llm_handler.py"}

        prompt = (
            "<|im_start|>system\n"
            "You are an expert embedded C programmer specializing in safety-critical systems. "
            "Your task is to generate clean, portable, and MISRA C (2012/2023) compliant code. "
            f"Generate production-quality C code for a {protocol} driver/interface.\n"
            "STRICT RULES:\n"
            "- Strictly follow MISRA C guidelines (e.g., no unreachable code, no goto, no dynamic memory allocation).\n"
            "- Include Doxygen-style comments for all functions and structs.\n"
            "- Use explicit width types from stdint.h (e.g., uint32_t instead of unsigned int).\n"
            "Output format — use these EXACT markers (no other text before/after):\n\n"
            f"{_HEADER_MARKER}\n"
            "```c\n"
            "/* .h file: include guard, typedefs, structs, function declarations */\n"
            "```\n\n"
            f"{_SOURCE_MARKER}\n"
            "```c\n"
            "/* .c file: #include, static vars, all function implementations with inline comments */\n"
            "```\n"
            "<|im_end|>\n"
            "<|im_start|>user\n"
            f"Requirement: {requirement_text}\n"
            f"Communication protocol / interface: {protocol}\n"
            "<|im_end|>\n"
            "<|im_start|>assistant\n"
        )

        try:
            resp = await self.llm.chat.completions.create(
                model="deepseek-ai/deepseek-v4-flash",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=2500,
                temperature=0.05,
                stop=["<|im_end|>"]
            )
            output = resp.choices[0].message.content.strip()

            if _SOURCE_MARKER in output:
                parts  = output.split(_SOURCE_MARKER)
                header = _strip_fences(parts[0].replace(_HEADER_MARKER, "").strip())
                source = _strip_fences(parts[1].strip())
            else:
                header = (
                    f"/* Auto-generated header — {protocol} interface */\n"
                    f"#ifndef {protocol.upper()}_DRV_H\n"
                    f"#define {protocol.upper()}_DRV_H\n\n"
                    "/* See .c file for implementation */\n\n"
                    f"#endif /* {protocol.upper()}_DRV_H */\n"
                )
                source = _strip_fences(output)

            return {"protocol": protocol, "header": header, "source": source}

        except Exception as exc:
            print(f"Code generation error ({protocol}): {exc}")
            return {"error": str(exc)}


# ─── Public entry point ───────────────────────────────────────────────────────

async def process_requirement_to_code(rid: str) -> list[dict]:
    """
    Orchestrates the transformation of a stored requirement into C source files.
    """
    req_file = Path(f"requirements/{rid}.json")
    if not req_file.exists():
        print(f"⚠️  Requirement file not found: {req_file}")
        return []

    data      = json.loads(req_file.read_text(encoding="utf-8"))
    text      = data.get("text", "")
    protocols = detect_all_protocols(text)

    gen     = CodeGenerator()
    results = []

    for protocol in protocols:
        result = await gen.generate(text, protocol)

        if "error" in result:
            print(f"Code gen failed for {rid} / {protocol}: {result['error']}")
            continue

        safe_proto = protocol.lower().replace(" ", "_")
        base       = f"{rid}_{safe_proto}"
        h_path     = CODE_DIR / f"{base}.h"
        c_path     = CODE_DIR / f"{base}.c"

        h_path.write_text(result["header"], encoding="utf-8")
        c_path.write_text(result["source"], encoding="utf-8")

        results.append({
            "requirement_id": rid,
            "protocol":       protocol,
            "header_file":    h_path.name,
            "source_file":    c_path.name,
            "header_content": result["header"],
            "source_content": result["source"],
        })
        print(f"  ✅  {rid} / {protocol} → {h_path.name}, {c_path.name}")

    return results