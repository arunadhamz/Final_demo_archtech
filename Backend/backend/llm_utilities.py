import json
from typing import List, Dict
from llm_inference_engine import get_document_llm
from system_config import MISTRAL_MODEL_14B_MEDIUM, MISTRAL_MODEL_7B_SMALL

#-------------------------
# @function: rephrase_content
# @description: rephrase a technical section into 3 high-quality variations
# @purpose:  rephrase a technical section into 3 high-quality variations
# @return:    list of 3 rephrased versions
#-------------------------
async def rephrase_content(
    text: str,
    selected_reqs: List[Dict],
    style: str = "concise"
) -> List[str]:
    """
    Rephrase a technical section into 3 high-quality variations.

    Args:
        text (str): Input document section
        selected_reqs (list): Relevant extracted requirements
        style (str): concise | detailed | formal | simplified

    Returns:
        List[str]: 3 rephrased versions
    """

    llm = get_document_llm()
    if not llm or not text.strip():
        return [text] * 3

    # Limit context to avoid token explosion
    req_context = "\n".join(
        [f"- {r.get('text', '')}" for r in selected_reqs[:5] if r.get('text')]
    )

    system_prompt = """
        You are a Senior Technical Writer and Systems Engineer.
        Your job is to rephrase technical content with high precision.

        Rules:
        - Preserve exact meaning
        - Maintain technical accuracy
        - Do not hallucinate or add new values
        - Do not remove constraints
        - Ensure clarity and readability
        - Keep engineering terminology consistent

        Output STRICTLY valid JSON:
        ["Version 1...", "Version 2...", "Version 3..."]
    """

    user_prompt = f"""
        Style: {style}

        Interpretation:
        - concise → shorter, precise
        - detailed → slightly expanded
        - formal → strict engineering tone
        - simplified → easy to read

        Context Requirements (for alignment only, do not copy):
        {req_context}

        Input Section:
        {text}

        Diversity requirement:
        - Version 1 → formal technical
        - Version 2 → simplified readable
        - Version 3 → concise engineering

        Generate exactly 3 rephrased versions.
    """

    try:
        response = await llm.chat.completions.create(
            model=str(MISTRAL_MODEL_7B_SMALL),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,      # controlled creativity
            top_p=0.9,
            max_tokens=400,       # sufficient for 3 outputs
            stream=False
        )

        content = response.choices[0].message.content.strip()

        # Parse JSON safely
        try:
            versions = json.loads(content)

            # Validate output
            if isinstance(versions, list) and len(versions) == 3:
                return [v.strip() for v in versions]

        except json.JSONDecodeError:
            pass

        # Fallback if parsing fails
        return [text] * 3

    except Exception as e:
        print(f"[ERROR] [Function: rephrase] : {e}")
        return [text] * 3

# -------------------------
# @function: get_ai_insight
# @description: generate an AI insight (summary, rephrase, or custom) for a requirement
# @purpose:  generate an AI insight (summary, rephrase, or custom) for a requirement
# @return:    AI insight
# -------------------------
async def get_ai_insight(
    text: str,
    selected_reqs: List[Dict],
    action: str = "summarize",
    user_query: str = None
) -> str:
    """
    Generate an AI insight (summary, rephrase, or custom) for a requirement.
    """

    llm = get_document_llm()
    if not llm or not text.strip():
        return "AI model not available or empty text."

    req_context = "\n".join(
        [f"- [{r.get('id','?')}] {r.get('text', '')}" for r in selected_reqs[:3] if r.get('text')]
    )

    # 🔥 STRONG SYSTEM PROMPT
    system_prompt = """
        You are a Senior Systems Engineer (INCOSE aligned).

        Your task is to analyze and refine technical requirements.

        Core Principles:
        - Maintain strict technical accuracy
        - Avoid ambiguity or vague wording
        - Do NOT hallucinate missing values
        - Keep responses concise but information-dense
        - Use professional engineering language

        Output Rules:
        - Format in clean Markdown
        - Use bullet points or short paragraphs
        - Highlight key technical terms using **bold**
        - Avoid unnecessary verbosity
    """

    # 🔥 STRUCTURED USER PROMPTS
    if action == "summarize":
        user_prompt = f"""
            Task: Provide an executive-level summary.

            Requirements:
            - Capture the core purpose
            - Highlight key constraints and interfaces
            - Keep it concise (3–5 bullet points max)

            Input:
            {text}
        """

    elif action == "rephrase":
        user_prompt = f"""
            Task: Rephrase into a formal engineering requirement.

            Requirements:
            - Use clear, precise language
            - Remove ambiguity
            - Preserve original meaning exactly
            - Use "shall" where appropriate

            Input:
            {text}
        """

    elif action == "custom" and user_query:
        user_prompt = f"""
            Task: {user_query}

            Input Requirement:
            {text}
        """

    else:
        user_prompt = f"""
            Task: Provide a technical insight.

            Requirements:
            - Identify purpose
            - Highlight constraints
            - Mention interfaces or dependencies
            - Note potential risks or ambiguities

            Input:
            {text}
        """

    # 🔹 Add context (controlled)
    if req_context:
        user_prompt += f"""
            Context (related requirements):
            {req_context}
        """

    try:
        response = await llm.chat.completions.create(
            model=str(MISTRAL_MODEL_14B_MEDIUM),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.15,   # more deterministic
            top_p=0.9,
            max_tokens=400,     # optimized
            stream=False
        )

        return response.choices[0].message.content.strip()

    except Exception as e:
        print(f"[ERROR] [Function: get_ai_insight] : {e}")
        return f"Error generating insight: {str(e)}"

#-------------------------
# @function: formalize_requirement
# @description: use LLM to convert raw pdf snippet into a formal engineering requirement
# @purpose:  use LLM to convert raw pdf snippet into a formal engineering requirement
# @return:    formal engineering requirement
#-------------------------
async def formalize_requirement(text: str) -> str:
    """
    Uses LLM to convert a raw PDF snippet into a formal engineering requirement.
    Uses Markdown for highlighting technical tokens.
    """
    llm = get_document_llm()

    if not llm:
        return text

    prompt = f"""
        You are a **Senior Systems Engineering Expert (INCOSE Certified)** specializing in:
        - Requirements Engineering
        - EARS (Easy Approach to Requirements Syntax)
        - Safety-critical and embedded systems

        Your task is to transform raw, unstructured, or OCR-extracted text into a **high-quality, formally structured requirement**.

        ---

        ## 🎯 OBJECTIVE
        Convert the given raw snippet into a **clear, atomic, testable, and unambiguous requirement** following:
        - INCOSE guidelines
        - EARS syntax patterns

        ---

        ## 📥 INPUT
        Raw Snippet:
        "{text}"

        ---

        ## ⚙️ PROCESSING RULES

        ### 1. OCR & TEXT CLEANUP
        - Correct spelling, grammar, and OCR errors
        - Normalize units, symbols, and technical terms
        - Expand abbreviations where necessary (but keep standard ones like I2C, UART)

        ---

        ### 2. REQUIREMENT NORMALIZATION
        - Ensure the requirement is:
        - Atomic (single idea)
        - Unambiguous
        - Verifiable/testable
        - Implementation-independent
        - Remove vague terms:
        ❌ fast, user-friendly, efficient  
        ✅ replace with measurable criteria

        ---

        ### 3. EARS STRUCTURE ENFORCEMENT
        Use the correct pattern:

        - **Ubiquitous**: The system shall...
        - **Event-driven**: When <event>, the system shall...
        - **State-driven**: While <state>, the system shall...
        - **Optional feature**: Where <feature>, the system shall...
        - **Unwanted behavior**: If <condition>, the system shall...

        Select the MOST appropriate pattern automatically.

        ---

        ### 4. TECHNICAL ENRICHMENT
        - Infer missing but obvious engineering context (do NOT hallucinate)
        - Standardize:
        - Units (e.g., **5 V**, **100 ms**)
        - Interfaces (**I2C**, **SPI**, **UART**)
        - Add constraints ONLY if clearly implied

        ---

        ### 5. FORMATTING RULES (STRICT)
        - Output MUST be in Markdown
        - Bold all critical elements:
        - **shall**
        - numerical values (**10 ms**, **3.3 V**)
        - protocols/interfaces (**I2C**, **CAN**)
        - Keep sentence professional and concise

        ---

        ### 6. OUTPUT STRUCTURE

        Return ONLY the following:

        #### ✅ Formal Requirement
        <Final requirement sentence>

        #### 🔍 Assumptions (if any)
        - <Only if absolutely necessary>

        ---

        ## 🚫 STRICT PROHIBITIONS
        - Do NOT generate multiple requirements
        - Do NOT add explanations outside the defined structure
        - Do NOT hallucinate unknown values
        - Do NOT keep vague or ambiguous wording

        ---

        ## ✅ QUALITY CHECK (SELF-VALIDATE BEFORE OUTPUT)
        Ensure:
        ✔ Contains **"shall"**  
        ✔ Testable and measurable  
        ✔ No ambiguity  
        ✔ Follows EARS pattern  
        ✔ Technically correct  

        ---

        ## 🎯 FINAL OUTPUT
        Generate the best possible **engineering-grade requirement**.
    """

    try:
        response = await llm.chat.completions.create(
            model=str(MISTRAL_MODEL_14B_MEDIUM),
            messages=[{"role": "user", "content": prompt}],
            max_tokens=512,
            temperature=0.1,
            top_p=1.00,
            stream=False
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"[ERROR] [Function: formalize_requirement] : {e}")
        return text
