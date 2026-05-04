"""
llm_handler.py — ArchTech SRS Generator

Flow:
  1. Load full template  →  MAIN_SRS_TEMPLATE_PATH
  2. Split into sections by heading
  3. For each section, load its topic knowledge file  →  TOPIC_KNOWLEDGE_DIR_SRS
  4. Fill section content using requirements + topic knowledge via LLM
  5. Stream results back section by section
"""

from openai import AsyncOpenAI
import os, re, asyncio, time
from system_config import MAIN_SRS_TEMPLATE_PATH, TOPIC_KNOWLEDGE_DIR_SRS, GEMMA_MODEL_31B_MEDIUM, API_URL, API_KEY

_llm: AsyncOpenAI | None = None
_code_llm: AsyncOpenAI | None = None

# -------------------------
# @function: get_document_llm
# @description: Gets the LLM for document generation.
# @purpose:  Get the LLM for document generation
# @return:    LLM instance
# -------------------------
def get_document_llm() -> AsyncOpenAI:
    global _llm
    if _llm is None:
        _llm = AsyncOpenAI(
            api_key= str(API_KEY),
            base_url= str(API_URL),
            timeout=120.0,
        )
    return _llm


# -------------------------
# @function: get_code_llm
# @description: Gets the LLM for code generation.
# @purpose:  Get the LLM for code generation
# @return:    LLM instance
# -------------------------
def get_code_llm() -> AsyncOpenAI:
    global _code_llm
    if _code_llm is None:
        _code_llm = AsyncOpenAI(
            api_key=str(API_KEY),
            base_url=str(API_URL),
            timeout=120.0,
        )
    return _code_llm

# -------------------------
# @function: load_template
# @description: Loads the SRS template.
# @purpose:  Load the SRS template
# @return:    Template content
# -------------------------
def load_template() -> str:
    if not MAIN_SRS_TEMPLATE_PATH.exists():
        raise FileNotFoundError(f"Template not found: {MAIN_SRS_TEMPLATE_PATH}")
    return MAIN_SRS_TEMPLATE_PATH.read_text(encoding="utf-8")


# -------------------------
# @function: parse_sections
# @description: Parses the template into sections.
# @purpose:  Parse the template into sections
# @return:    List of sections
# -------------------------
def parse_sections(template: str) -> list[dict]:
    raw = re.split(r"\n(?=#+ )", "\n" + template)
    sections = []
    count  = 0
    for block in raw:
        block = block.strip()
        if not block:
            continue
        lines        = block.split("\n")
        heading      = lines[0].strip()
        heading_text = heading.lstrip("#").strip()
        content      = "\n".join(lines[1:]).strip()
        sections.append({
            "heading":      heading,
            "heading_text": heading_text,
            "content":      content,
        })
        
        # if count >= 1 and count <= 10:
        #     print("\n\n\n Lines : ", lines, "\n\n\n")
        #     print("\n\n\n Block : ", block, "\n\n\n")
        #     print("\n\n\n Heading : ", heading, "\n\n\n")
        #     print("\n\n\n Heading Text : ", heading_text, "\n\n\n")
        #     print("\n\n\n Content : ", content, "\n\n\n")
        #     count += 1
    return sections


# -------------------------
# @function: load_topic_knowledge
# @description: Loads the topic knowledge for a given section heading.
# @purpose:  Load the topic knowledge for a given section heading
# @return:    Topic knowledge content
# -------------------------
def load_topic_knowledge(heading_text: str) -> str:
    """
    Match a section heading to its topic knowledge file in TOPIC_KNOWLEDGE_DIR_SRS.

    Expected file naming:
      01_introduction.md
      02_overall_description.md
      appendix_a_kc_mapping.md
      …

    Match order:
      1. Section number prefix  →  "1.2 Scope"   looks for 01_*.md
      2. Appendix keyword       →  "Appendix A"  looks for appendix_a_*.md
      3. Slug fallback          →  any file whose stem contains the heading slug
    """
    if not TOPIC_KNOWLEDGE_DIR_SRS.exists():
        return ""

    lower = heading_text.lower().strip()

    # 1. Numeric prefix
    m = re.match(r"^(\d+)", heading_text.strip())
    if m:
        prefix = f"{int(m.group(1)):02d}_"
        for f in TOPIC_KNOWLEDGE_DIR_SRS.iterdir():
            if f.name.startswith(prefix) and f.suffix == ".md":
                return f.read_text(encoding="utf-8")

    # 2. Appendix
    app = re.match(r"appendix\s+([a-z])", lower)
    if app:
        letter = app.group(1)
        for f in TOPIC_KNOWLEDGE_DIR_SRS.iterdir():
            if f.name.lower().startswith(f"appendix_{letter}") and f.suffix == ".md":
                return f.read_text(encoding="utf-8")

    # 3. Slug fallback
    slug = re.sub(r"[^\w]+", "_", lower).strip("_")
    for f in TOPIC_KNOWLEDGE_DIR_SRS.iterdir():
        if slug in f.stem.lower() and f.suffix == ".md":
            return f.read_text(encoding="utf-8")

    return ""


# -------------------------
# @function: _build_messages
# @description: Builds the messages for the LLM.
# @purpose:  Build the messages for the LLM
# @return:    List of messages
# -------------------------
def _build_messages(
    heading: str,
    heading_text: str,
    template_content: str,
    req_lines: str,
    topic_knowledge: str,
) -> list[dict]:

    knowledge_block = (
        f"\nSECTION GUIDELINES (follow strictly):\n--- START ---\n{topic_knowledge}\n--- END ---\n"
        if topic_knowledge else ""
    )

    system_msg = f"""You are a Senior Systems Engineer writing a Software Requirements Specification (SRS).

You are filling the **{heading_text}** section.

RULES:
- Use ONLY the provided REQUIREMENTS — do NOT invent or assume any technical detail.
- Follow the TEMPLATE STRUCTURE exactly: preserve tables, lists, bold text, and numbering.
- Replace every HTML comment (<!-- ... -->) and placeholder (<VAR>) with real content derived from the requirements.
- If the template says "use only if …", write "Not Applicable" when the requirements don't warrant it.
- Output ONLY the filled section body — no heading repeat, no preamble, no code fences, no commentary.
{knowledge_block}"""

    user_msg = f"""SECTION HEADING:
{heading}

TEMPLATE STRUCTURE TO FILL:
{template_content}

REQUIREMENTS:
{req_lines}"""

    return [
        {"role": "system", "content": system_msg.strip()},
        {"role": "user",   "content": user_msg.strip()},
    ]


# -------------------------
# @function: _strip_echoed_heading
# @description: Removes the echoed heading from the LLM response.
# @purpose:  Remove the echoed heading from the LLM response
# @return:    Cleaned LLM response
# -------------------------
def _strip_echoed_heading(body: str, heading_text: str) -> str:
    """Remove heading line if the LLM echoes it at the top of its response."""
    lines   = body.lstrip("\n").split("\n")
    target  = heading_text.lower().strip()
    result  = []
    stripped = False
    for i, line in enumerate(lines):
        if i < 4 and not stripped and line.lstrip("#").strip().lower() == target:
            stripped = True
            continue
        result.append(line)
    return "\n".join(result).lstrip("\n").strip()


# -------------------------
# @function: _template_fallback
# @description: Strips HTML comments from raw template as a last-resort fallback.
# @purpose:  Strip HTML comments from raw template as a last-resort fallback
# @return:    Cleaned template
# -------------------------
def _template_fallback(content: str) -> str:
    return re.sub(r"<!--.*?-->", "", content, flags=re.DOTALL).strip()


# -------------------------
# @function: fill_section
# @description: Fills one template section with LLM output.
# @purpose:  Fill one template section with LLM output
# @return:    Dictionary containing the filled section
# -------------------------
async def fill_section(section: dict, reqs: list[dict]) -> dict:
    """
    Fill one template section with LLM output.
    Retries up to 3 times on rate-limit errors.
    Returns {"heading": str, "content": str}.
    """
    heading      = section["heading"]
    heading_text = section["heading_text"]
    content      = section["content"]

    count = 1

    # Nothing to fill for empty container headings
    if not content:
        return {"heading": heading, "content": ""}

    req_lines       = "\n".join(f"[{r.get('id','?')}] {r.get('text','')}" for r in reqs[:5])
    
    if count == 1:
        print("#" * 60)
        print(f"\n\n\n REQ LINES : {req_lines} \n\n\n")
        print("#" * 60)
        count += 1

    topic_knowledge = load_topic_knowledge(heading_text)
    messages        = _build_messages(heading, heading_text, content, req_lines, topic_knowledge)
    llm             = get_document_llm()

    for attempt in range(3):
        print(f"  🔄 '{heading_text}' — attempt {attempt + 1}/3")
        try:
            if attempt > 0:
                await asyncio.sleep(5 * (2 ** attempt))

            stream = await llm.chat.completions.create(
                model=GEMMA_MODEL_31B_MEDIUM,
                messages=messages,
                max_tokens=16384,
                temperature=0.2,
                top_p=0.7,
                stream=True,
            )

            raw = ""
            async for chunk in stream:
                if not getattr(chunk, "choices", None):
                    continue
                delta = chunk.choices[0].delta.content
                if delta:
                    raw += delta

            body = _strip_echoed_heading(raw.strip(), heading_text)
            print(f"  ✅ '{heading_text}' — {len(body)} chars")
            return {"heading": heading, "content": body}

        except Exception as exc:
            print(f"  ⚠️  '{heading_text}' error (attempt {attempt + 1}): {exc}")
            is_rate_limit = any(k in str(exc).lower() for k in ("429", "rate limit", "too many requests"))
            if is_rate_limit and attempt < 2:
                continue
            return {"heading": heading, "content": _template_fallback(content)}

    return {"heading": heading, "content": _template_fallback(content)}


# -------------------------
# @function: generate_document_sections
# @description: Generates SRS sections asynchronously.
# @purpose:  Generate SRS sections asynchronously
# @return:    Async generator yielding section data
# -------------------------
async def generate_document_sections(reqs: list[dict]):
    """
    Async generator — yields SSE-ready dicts for the FastAPI streaming endpoint.

    Yield shapes:
      {"section_num": int, "total": int, "heading": str, "content": str, "done": False}
      {"section_num": int, "total": int, "heading": "",  "content": "",  "done": True}
    """
    t0       = time.time()
    template = load_template()
    sections = parse_sections(template)
    total    = len(sections)
    print(f"   ✓ Template loaded: {len(sections)} sections")
    print(f"{'='*60}\n📄 SRS — {total} sections\n{'='*60}")

    for i, section in enumerate(sections):
        result = await fill_section(section, reqs)
        body   = result["content"]
        final  = f"{result['heading']}\n\n{body}".strip() if body else result["heading"]

        yield {
            "section_num": i + 1,
            "total":       total,
            "heading":     result["heading"],
            "content":     final,
            "done":        False,
        }

    print(f"✅ SRS complete in {time.time() - t0:.1f}s")
    yield {"section_num": total, "total": total, "heading": "", "content": "", "done": True}


# -------------------------
# @function: generate_document
# @description: Generates the complete SRS document.
# @purpose:  Generate the complete SRS document
# @return:    String containing the complete SRS document
# -------------------------
async def generate_document(reqs: list[dict]) -> str:
    t0       = time.time()
    template = load_template()
    sections = parse_sections(template)
    parts    = []

    for section in sections:
        result = await fill_section(section, reqs)
        if result["content"]:
            parts.append(f"{result['heading']}\n\n{result['content']}")
        elif result["heading"]:
            parts.append(result["heading"])

    doc = "\n\n".join(parts)
    print(f"✅ SRS complete in {time.time() - t0:.1f}s — {len(doc)} chars")
    return doc