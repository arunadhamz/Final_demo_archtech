import re
import asyncio
from typing import List, Dict
from openai import AsyncOpenAI
import json
from pathlib import Path

# Type alias for OpenAI client
OpenAI_API = AsyncOpenAI

warehouse_path = Path(__file__).parent.parent / "warehouse"
with open(warehouse_path / "dicts.json", "r") as f:
    warehouse_dicts = json.load(f)

# ─── Diagram / flowchart detection ────────────────────────────────────────────

_DIAGRAM_HEADING_KW = warehouse_dicts["diagram_heading_keywords"]["block_diagram"]
_FLOWCHART_HEADING_KW = warehouse_dicts["diagram_heading_keywords"]["flowchart"]

def _is_diagram_section(section: dict) -> bool:
    h = section["heading_text"].lower()
    c = section["content"].lower()
    if any(k in h for k in _DIAGRAM_HEADING_KW):
        return True
    if "figure" in c and ("block diagram" in c or "block level" in c):
        return True
    return False

def _is_flowchart_section(section: dict, template_type: str) -> bool:
    if template_type != "SDD":
        return False
    h = section["heading_text"].lower()
    return any(k in h for k in _FLOWCHART_HEADING_KW)

# ─────────────────────────────────────────────────────────────
# Regex patterns
# ─────────────────────────────────────────────────────────────
_MERMAID_UNSAFE = re.compile(r'[<>"{}|\\]')
_NODE_ID_INVALID = re.compile(r'[^a-zA-Z0-9_]')
_STARTS_WITH_DIGIT = re.compile(r'^(\s*)(\d+)(\w*)\s*(-->|---|==>|-.->)')


# -------------------------
# @function: _sanitize_mermaid
# @description: Sanitizes the Mermaid diagram text.
# @purpose:  Sanitize the Mermaid diagram text
# @return:    Sanitized Mermaid diagram string
# -------------------------
def _sanitize_mermaid(text: str) -> str:   
    if not text or not text.strip():
        return "graph TD\nA[Empty] --> B[Empty]"

    lines = []

    for raw_line in text.split("\n"):
        line = raw_line.strip()

        if not line:
            continue

        # 🔹 Clean labels inside []
        line = re.sub(
            r'\[([^\]]+)\]',
            lambda m: "[" + _clean_label(m.group(1)) + "]",
            line
        )

        # 🔹 Clean labels inside ()
        line = re.sub(
            r'\(([^)]+)\)',
            lambda m: "(" + _clean_label(m.group(1)) + ")",
            line
        )

        # 🔹 Fix node IDs starting with digits
        line = _STARTS_WITH_DIGIT.sub(
            lambda m: f"{m.group(1)}N{m.group(2)}{m.group(3)} {m.group(4)}",
            line
        )

        # 🔹 Normalize node IDs globally (left side of edges)
        line = _normalize_node_ids(line)

        lines.append(line)

    result = "\n".join(lines).strip()

    # 🔹 Ensure valid header
    if not re.match(r"^\s*(graph|flowchart)\s+(TD|LR|TB|BT|RL)", result):
        result = "graph TD\n" + result

    return result


# -------------------------
# @function: _clean_label
# @description: Clean label text inside [] or ().
# @purpose:  Clean label text inside [] or ()
# @return:    Cleaned label text
# -------------------------
def _clean_label(text: str) -> str:
    cleaned = _MERMAID_UNSAFE.sub("", text)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()

    # Limit length
    cleaned = cleaned[:60]

    return cleaned if cleaned else "Node"


# -------------------------
# @function: _normalize_node_ids
# @description: Ensures node IDs are valid (alphanumeric, not starting with digit).
# @purpose:  Ensure node IDs are valid
# @return:    Cleaned node IDs
# -------------------------
def _normalize_node_ids(line: str) -> str:
    def fix_id(match):
        node_id = match.group(1)

        # Remove invalid chars
        node_id = _NODE_ID_INVALID.sub("", node_id)

        # Prevent empty or digit start
        if not node_id or node_id[0].isdigit():
            node_id = "N" + node_id

        return node_id

    # Match node IDs before [ or (
    return re.sub(r'\b([A-Za-z0-9_]+)(?=\[|\()', fix_id, line)


# -------------------------
# @function: _fallback_mermaid
# @description: Generates a safe fallback Mermaid diagram when LLM output fails.
# @purpose:  Generate a safe fallback Mermaid diagram
# @return:    Mermaid diagram string
# -------------------------
def _fallback_mermaid(reqs: List[Dict], heading: str) -> str:
    """
    Generate a safe fallback Mermaid diagram when LLM output fails.
    """

    PROTO_KW = {
        "uart", "spi", "i2c", "can", "rs422", "rs232",
        "pcie", "pci", "adc", "dac", "jtag",
        "ethernet", "usart"
    }

    protocols = []
    for r in reqs[:8]:
        for kw in r.get("keywords", []):
            k = kw.lower()
            if k in PROTO_KW:
                k = k.upper()
                if k not in protocols:
                    protocols.append(k)

    lines = ["graph TD"]

    # 🔹 Core node
    lines.append("    CPU[Processor]")

    # 🔹 Add protocol interfaces
    for i, proto in enumerate(protocols[:6]):
        nid = f"IF{i}"
        lines.append(f"    {nid}[{proto} Interface]")
        lines.append(f"    CPU --> {nid}")

    # 🔹 Generic fallback if nothing found
    if not protocols:
        lines.extend([
            "    SYS[System Core]",
            "    HW[Hardware Interface]",
            "    SW[Software Module]",
            "    SYS --> HW",
            "    SYS --> SW",
        ])

    return "\n".join(lines)

# -------------------------
# @function: _call_llm_raw
# @description: Calls the LLM to generate the Mermaid diagram.
# @purpose:  Call the LLM to generate the Mermaid diagram
# @return:    Mermaid diagram string
# -------------------------
async def _call_llm_raw(llm: OpenAI_API, messages: list, max_tokens: int = 800) -> str:
    for attempt in range(3):
        try:
            if attempt > 0:
                await asyncio.sleep(2 * attempt)

            resp = await llm.chat.completions.create(
                model="google/gemma-4-31b-it",
                messages=messages,
                temperature=0.1,
                top_p=0.9,
                max_tokens=max_tokens,
                stream=False
            )

            return resp.choices[0].message.content.strip()
        except Exception as exc:
            err_msg = str(exc).lower()
            if any(k in err_msg for k in ("429", "rate limit")) and attempt < 2:
                continue

            print(f"  LLM raw call error: {exc}")
            return ""

    return ""


# -------------------------
# @function: generate_mermaid_block
# @description: Generates a Mermaid graph TD diagram.
# @purpose:  Generate a Mermaid graph TD diagram
# @return:    Mermaid diagram string
# -------------------------
async def generate_mermaid_block(llm: OpenAI_API, section_heading: str, reqs: list[dict]) -> str:
    """
        Generate a Mermaid graph TD diagram.

        Rules:
        - Output ONLY Mermaid code starting with: graph TD
        - No explanations, no markdown, no code fences
    """
    req_lines = "\n".join(f"- {r.get('text', '')}" for r in reqs[:8])

    system_prompt = """
        Generate a Mermaid graph TD diagram.

        Rules:
        - Output ONLY Mermaid code starting with: graph TD
        - No explanations, no markdown, no code fences

        Structure:
        - Node IDs: letters only (A, B, CPU, ADC)
        - Labels: ≤6 words, no special characters
        - 6–10 nodes max
        - Show components and connections
        - Use edge labels for interfaces if known

        Styling (STRICT - Monochrome):
        - Background must be white
        - All nodes must use:
            fill:#FFFFFF
            stroke:#000000
            color:#000000

        - Define ONE class only:
            classDef default fill:#FFFFFF,stroke:#000000,stroke-width:1.5px,color:#000000

        - Apply class to ALL nodes:
            class A,B,C,D,E default

        - All edges must be black:
            linkStyle default stroke:#000000,stroke-width:1.5px,color:#000000

        Constraints:
        - Do NOT use any colors other than black (#000000) and white (#FFFFFF)
        - Do NOT create multiple classDefs
        - Keep diagram clean and minimal
    """

    user_prompt = f"""
        Section: {section_heading}

        Requirements:
        {req_lines}
    """

    raw = await _call_llm_raw(
        llm,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        max_tokens=600
    )

    full = raw if raw.startswith("graph TD") else "graph TD\n" + raw
    full = re.sub(r"```[a-zA-Z]*\n?", "", full).strip()

    try:
        mermaid = _sanitize_mermaid(full)
    except Exception:
        mermaid = _fallback_mermaid(reqs, section_heading)

    if "-->" not in mermaid and "---" not in mermaid:
        mermaid = _fallback_mermaid(reqs, section_heading)

    return f"\n```mermaid\n{mermaid}\n```\n"


# -------------------------
# @function: generate_flowchart_block
# @description: Generates a Mermaid flowchart TD.
# @purpose:  Generate a Mermaid flowchart TD
# @return:    Mermaid flowchart string
# -------------------------
async def generate_flowchart_block(llm: OpenAI_API, section_heading: str, reqs: list[dict]) -> str:
    """
        Generate a Mermaid flowchart TD.

        Rules:
        - Output ONLY Mermaid code starting with: flowchart TD
        - No explanations, no markdown, no code fences
    """
    req_lines = "\n".join(f"- {r.get('text', '')}" for r in reqs[:6])

    system_prompt = """
        Generate a Mermaid flowchart TD.

        Rules:
        - Output ONLY Mermaid code starting with: flowchart TD
        - No explanations, no markdown, no code fences

        Structure:
        - Node IDs: letters only (A, B, C, D)
        - Labels ≤8 words, no special characters
        - Structure: Start → Setup → Execute → Decision → End
        - Use diamonds {} for decisions
        - Use rectangles [] for actions
        - Use rounded () for start/end
        - 8–12 nodes max

        Styling (STRICT - Monochrome):
        - Background must be white
        - All nodes must use:
            fill:#FFFFFF
            stroke:#000000
            color:#000000

        - Define ONE class only:
            classDef default fill:#FFFFFF,stroke:#000000,stroke-width:1.5px,color:#000000

        - Apply class to ALL nodes explicitly:
            class A,B,C,D,E,F,G,H default

        - All edges must be black:
            linkStyle default stroke:#000000,stroke-width:1.5px,color:#000000

        Constraints:
        - Do NOT use any colors other than black (#000000) and white (#FFFFFF)
        - Do NOT create multiple classDefs
        - Keep diagram clean, minimal, and readable
    """

    user_prompt = f"""
        Section: {section_heading}

        Requirements:
        {req_lines}
    """

    raw = await _call_llm_raw(
        llm,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        max_tokens=700
    )

    full = raw if raw.startswith("flowchart TD") else "flowchart TD\n" + raw
    full = re.sub(r"```[a-zA-Z]*\n?", "", full).strip()

    try:
        fc = _sanitize_mermaid(full)
    except Exception:
        fc = (
            "flowchart TD\n"
            "A([Start]) --> B[Setup]\n"
            "B --> C[Execute]\n"
            "C --> D{Pass}\n"
            "D -->|Yes| E([End])\n"
            "D -->|No| F([Fail])"
        )

    return f"\n```mermaid\n{fc}\n```\n"
