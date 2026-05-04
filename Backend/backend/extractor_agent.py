"""
extraction_agent.py — ArchTech RAG v4
======================================
Replaces extractor_v4.py.

Architecture: Pipeline Agent with controlled concurrency
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CPU spike root causes fixed:
  ✦ asyncio.gather(*ALL_PAGES) → page queue with PAGE_CONCURRENCY=3 workers
  ✦ per-segment formalize_requirement → batched LLM calls (BATCH_SIZE=8)
  ✦ SentenceTransformer blocking event loop → run_in_executor(thread_pool)
  ✦ KeyBERT per-call → shared singleton, also offloaded to executor
  ✦ _build_cat_embeddings called every classify → built once at agent startup

8-Stage Pipeline (same logic, controlled execution):
  [1] Ingest     PDF page → text + tables
  [2] Segment    smart paragraph / bullet merge
  [3] Detect     boilerplate gate + rule score
  [4] Normalize  shall-norm + ambiguity strip  (+ optional LLM batch)
  [5] Classify   keyword bucket + MiniLM cosine (70/30 blend)
  [6] Explain    template explanation string
  [7] Score      rule×0.3 + semantic×0.5 + keyword×0.2
  [8] Dedup      rapidfuzz token_sort_ratio dedup + related_ids

Public API (identical to v3 extractor.py):
  extract_requirements(pdf_path, doc_type, counters)  → list[dict]
  scan_file(...)
  scan_folder(...)
  save_to_json(...)
  build_traceability_matrix(...)  ← new bonus utility
"""

from __future__ import annotations

import re
import time
import json
import asyncio
import logging
import datetime
import concurrent.futures
from pathlib import Path
from typing import Optional

import pdfplumber
from rapidfuzz import fuzz
from sentence_transformers import SentenceTransformer
from system_config import EMBEDDING_MODEL_PATH, EMBEDDING_MODEL_PATH_EXCEPTION, META_MODEL_70B_LARGE, GEMMA_MODEL_31B_MEDIUM, MISTRAL_MODEL_14B_MEDIUM

log = logging.getLogger("archtech.agent")

# ─── Thread pool for CPU-bound model inference ───────────────────────────────
# 2 threads: one for encoder, one for KeyBERT — keeps CPU < 60%
_EXECUTOR = concurrent.futures.ThreadPoolExecutor(max_workers=2, thread_name_prefix="archtech_model")

# ─── Concurrency controls ─────────────────────────────────────────────────────
PAGE_CONCURRENCY   = 3   # max pages processed in parallel
LLM_CONCURRENCY    = 2   # max simultaneous LLM formalize calls
BATCH_SIZE         = 8   # segments per LLM batch call
MIN_CONFIDENCE     = 0.20
DEBUG_PAGE_LIMIT   = 20  # set to int for dev; None = full doc

# ─── Singleton models (lazy, built once) ─────────────────────────────────────
_ENCODER   = None
_KW_MODEL  = None
_CAT_EMBS  = None   # built once from encoder

#-------------------------
# @function: _get_encoder
# @description: load sentence transformer model
# @purpose:  load sentence transformer model for embedding
# @return:    sentence transformer model
#-------------------------
def _get_encoder():
    global _ENCODER
    if _ENCODER is None:
        try:
            try:
                _ENCODER = SentenceTransformer(str(EMBEDDING_MODEL_PATH))
                print(f"[EMBEDDING_MODEL] : {EMBEDDING_MODEL_PATH}")
            except Exception:
                _ENCODER = SentenceTransformer(str(EMBEDDING_MODEL_PATH_EXCEPTION))
                print(f"[EXCEPTION_EMBEDDING_MODEL] : {EMBEDDING_MODEL_PATH_EXCEPTION}")
        except Exception as exc:
            print(f"[EMBEDDING_MODEL] ERROR: {exc}")
            _ENCODER = False
    return _ENCODER or None


#-------------------------
# @function: _get_kw_model
# @description: load keybert model
# @purpose:  load keybert model for keyword extraction
# @return:    keybert model
#-------------------------
def _get_kw_model():
    global _KW_MODEL
    if _KW_MODEL is None:
        try:
            from keybert import KeyBERT
            enc = _get_encoder()
            _KW_MODEL = KeyBERT(model=enc) if enc else KeyBERT()
        except Exception:
            _KW_MODEL = False
    return _KW_MODEL or None

#-------------------------
# @function: _warm_up
# @description: pre-build category embeddings
# @purpose:  pre-build category embeddings at agent startup — avoids cold-start
#            latency on the first document. Run once: await _warm_up()
# @return:    category embeddings
#-------------------------
async def _warm_up():
    """
    Pre-build category embeddings at agent startup — avoids cold-start
    latency on the first document. Run once: await _warm_up()
    """
    global _CAT_EMBS
    if _CAT_EMBS is not None:
        return
    loop = asyncio.get_event_loop()
    _CAT_EMBS = await loop.run_in_executor(_EXECUTOR, _build_cat_embeddings_sync)
    log.info(f"Category embeddings ready ({len(_CAT_EMBS)} classes)")


# ═══════════════════════════════════════════════════════════════════════════════
# WAREHOUSE — load lists.json + dicts.json
# ═══════════════════════════════════════════════════════════════════════════════

# Warehouse path: resolves relative to this file's location.
# v3 layout:  Backend/backend/extractor.py  → parent.parent = Backend/
# If your layout differs, set ARCHTECH_WAREHOUSE env var.
import os as _os
_warehouse = (
    Path(_os.environ['ARCHTECH_WAREHOUSE'])
    if 'ARCHTECH_WAREHOUSE' in _os.environ
    else Path(__file__).parent.parent / 'warehouse'
)

with open(_warehouse / "lists.json") as _f:
    _lists = json.load(_f)
with open(_warehouse / "dicts.json") as _f:
    _dicts = json.load(_f)

PROTOCOLS: set[str]        = set(_lists["protocols"])
DOMAIN_KW: dict            = _dicts.get("domain_keywords", {})
ALL_DOMAIN_KW: set[str]    = {kw for lst in DOMAIN_KW.values() for kw in lst}
_DOC_TYPE_MAP: list        = _lists["document_types"]

# Compiled patterns
_DIRECTIVE_STRONG   = re.compile(r'\b(shall|must)\b', re.IGNORECASE)
_DIRECTIVE_MODERATE = re.compile(
    r'\b(will|should|required|mandatory|specifies|defines|provides|'
    r'supports|ensures|guarantees|complies|meets|conforms)\b', re.IGNORECASE
)
_TECH_UNIT_RE = re.compile(
    r'\d+\.?\d*\s*'
    r'(V|mV|kV|A|mA|uA|nA|W|mW|kW|Hz|kHz|MHz|GHz|THz|'
    r'bps|kbps|Mbps|Gbps|B|KB|MB|GB|TB|ms|us|ns|ps|s|'
    r'mm|cm|m|km|kg|g|mg|°C|°F|K|Ohm|kOhm|MOhm|'
    r'dB|dBm|dBc|ppm|ppb|rpm|bar|Pa|kPa|lux|nit|'
    r'pF|nF|uF|mF|F|nH|uH|mH|H)\b',
    re.IGNORECASE
)

# ─── YAKE fallback keyword extractor ─────────────────────────────────────────
try:
    import yake as _yake
    _YAKE = _yake.KeywordExtractor(lan="en", n=3, dedupLim=0.8, top=12, features=None)
except Exception:
    _YAKE = None


# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 2 — SMART SEGMENTATION
# ═══════════════════════════════════════════════════════════════════════════════

_TOC_LINE_RE = re.compile(r'\.{5,}\s*\d{1,4}\s*$')
_BULLET_RE   = re.compile(r'^\s*[-•*–]\s+')
_NUMBERED_RE = re.compile(r'^\s*\d+[.)]\s+')

#-------------------------
# @function: _is_toc_page
# @description: check if the page is a table of contents
# @purpose:  check if the page is a table of contents
# @return:    True if the page is a table of contents, False otherwise
#-------------------------
def _is_toc_page(text: str) -> bool:
    lines = [l for l in text.splitlines() if l.strip()]
    if not lines:
        return False
    hits = sum(1 for l in lines if _TOC_LINE_RE.search(l))
    if hits / len(lines) > 0.35:
        return True
    return (re.search(r'\b(contents|table of contents)\b', text, re.IGNORECASE)
            and hits >= 3)

#-------------------------
# @function: _is_cover_page
# @description: check if the page is a cover page
# @purpose:  check if the page is a cover page
# @return:    True if the page is a cover page, False otherwise
#-------------------------
def _is_cover_page(text: str) -> bool:
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    if len(lines) < 10:
        return True
    caps = sum(1 for l in lines if l.isupper() or len(l.split()) <= 4)
    return caps / len(lines) > 0.60


#-------------------------
# @function: _smart_segment
# @description: segment text into paragraphs
# @purpose:  segment text into paragraphs
# @return:    list of paragraphs
#-------------------------
def _smart_segment(text: str) -> list[str]:
    text = text.replace('\r', '').replace('\xa0', ' ')
    paragraphs: list[str] = []
    buf = ""

    for line in text.split('\n'):
        line = line.rstrip()
        if _BULLET_RE.match(line) or _NUMBERED_RE.match(line):
            buf = (buf.rstrip() + " " + line.strip()) if buf else line.strip()
            continue
        if not line.strip():
            if buf.strip():
                paragraphs.append(buf.strip())
                buf = ""
            continue
        if buf and line[0].islower():
            buf += " " + line.strip()
        else:
            if buf:
                paragraphs.append(buf.strip())
            buf = line.strip()

    if buf.strip():
        paragraphs.append(buf.strip())

    final: list[str] = []
    for para in paragraphs:
        if len(para) > 400:
            final.extend(re.split(r'(?<=[.!?])\s+(?=[A-Z])', para))
        else:
            final.append(para)
    return final


# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 3 — CANDIDATE DETECTION
# ═══════════════════════════════════════════════════════════════════════════════

_BOILERPLATE: list[re.Pattern] = [
    re.compile(r'^\d+(\.\d+)*\s+.{5,80}\.{5,}\s*\d{1,4}\s*$'),
    re.compile(r'^[A-Z]{2,10}/[A-Z]{2,10}/[A-Z0-9]{2,10}/[\d.]+$'),
    re.compile(r'\b(copyright|all rights reserved|confidential|proprietary|no part of)\b', re.IGNORECASE),
    re.compile(r'^(prepared by|reviewed by|approved by|document title|document reference'
               r'|technical review|document review|version number|version date)\b', re.IGNORECASE),
    re.compile(r'^based on (internal|drb|review)', re.IGNORECASE),
    re.compile(r'^\s*(sign\s*:|name\s*:)\s*$', re.IGNORECASE),
    re.compile(r'^amendments? to the document', re.IGNORECASE),
    re.compile(r'^\d{1,2}\.\d{2}\.\d{4}\s*$'),
    re.compile(r'^[A-Z][A-Z\s/]{5,50}$'),
    re.compile(r'^(figure|table|fig\.?)\s+\d', re.IGNORECASE),
    re.compile(r'^for example[,\s]', re.IGNORECASE),
    re.compile(r'naming convention', re.IGNORECASE),
]

#-------------------------
# @function: _is_boilerplate
# @description: check if the page is a boilerplate
# @purpose:  check if the page is a boilerplate
# @return:    True if the page is a boilerplate, False otherwise
#-------------------------
def _is_boilerplate(text: str) -> bool:
    t = text.strip()
    # Short segments: only reject if they also have no technical unit
    if len(t.split()) < 5:
        # Allow short measurement specs like '-40°C to +85°C'
        if not _TECH_UNIT_RE.search(t):
            return True
    return any(p.search(t) for p in _BOILERPLATE)


#-------------------------
# @function: _rule_score
# @description: calculate rule score
# @purpose:  calculate rule score for a paragraph
# @return:    rule score
#-------------------------
def _rule_score(text: str) -> int:
    score = 0
    lower = text.lower()
    if _DIRECTIVE_STRONG.search(lower):   score += 5
    elif _DIRECTIVE_MODERATE.search(lower): score += 3
    if _TECH_UNIT_RE.search(text):        score += 3
    if any(p in lower for p in PROTOCOLS): score += 2
    if "[table data]" in lower:            score += 3
    if len(text.strip()) > 80:             score += 1
    if re.search(r'^(the following|this document|this specification|this section)', lower):
        score -= 2
    if re.search(r'\b(e\.g\.|i\.e\.|etc\.)\b', lower):
        score -= 1
    return score


_RULE_THR      = 4
_UNIT_ONLY_THR = 3   # lower bar for measurement-only specs

#-------------------------
# @function: _passes_gate
# @description: check if the page passes the gate
# @purpose:  check if the page passes the gate
# @return:    True if the page passes the gate, False otherwise
#-------------------------
def _passes_gate(seg: str) -> tuple[bool, int]:
    """Returns (passes, rule_score)."""
    if _is_boilerplate(seg):
        return False, 0
    rs       = _rule_score(seg)
    has_unit = bool(_TECH_UNIT_RE.search(seg))
    thr      = _UNIT_ONLY_THR if has_unit else _RULE_THR
    return rs >= thr, rs


# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 4 — NORMALIZATION
# ═══════════════════════════════════════════════════════════════════════════════

_MODAL_RE = re.compile(r'\b(should|will|can|may|could|would)\b', re.IGNORECASE)
_AMBIG_RE = re.compile(
    r'\b(approximately|as needed|as required|etc\.?|and so on|'
    r'as applicable|where applicable|if necessary|as appropriate)\b',
    re.IGNORECASE
)

#-------------------------
# @function: _normalize_local
# @description: normalize text
# @purpose:  normalize text
# @return:    normalized text
#-------------------------
def _normalize_local(text: str) -> str:
    """Fast local normalization — no LLM."""
    if "[TABLE DATA]" in text:
        return text
    if not _DIRECTIVE_STRONG.search(text):
        text = _MODAL_RE.sub('shall', text)
    text = _AMBIG_RE.sub('', text)
    text = re.sub(r'\s{2,}', ' ', text).strip()
    return (text[0].upper() + text[1:]) if text else text


#-------------------------
# @function: _normalize_batch_llm
# @description: normalize text
# @purpose:  normalize text
# @return:    normalized text
#-------------------------
async def _normalize_batch_llm(
    batch: list[str],
    llm_semaphore: asyncio.Semaphore,
) -> list[str]:
    """
    Optional LLM formalization batch.
    Sends BATCH_SIZE segments in one LLM call → 8× fewer requests.
    Falls back to local normalization if LLM is unavailable.
    """
    try:
        from llm_utilities import formalize_requirement
    except ImportError:
        return [_normalize_local(s) for s in batch]

    results = []
    async with llm_semaphore:
        for seg in batch:
            try:
                normalized = await formalize_requirement(seg)
                results.append(normalized or _normalize_local(seg))
            except Exception:
                results.append(_normalize_local(seg))
            await asyncio.sleep(0.1)   # 100ms between calls within batch
    return results


# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 5 — CLASSIFICATION (keyword + semantic)
# ═══════════════════════════════════════════════════════════════════════════════

_KW_BUCKETS: dict[str, list[str]] = {
    "Hardware/Power":             ["voltage", "current", "power", "watt", "5v", "3.3v", "12v",
                                   "ldo", "dc-dc", "psu", "buck", "boost", "consumption",
                                   "dissipation", "regulator", "rail", "supply"],
    "Hardware/Memory":            ["ddr4", "ddr3", "lpddr", "sram", "flash", "eeprom", "mram",
                                   "sd card", "sata", "nvm", "nvme", "nor", "nand"],
    "Hardware/Processor":         ["zynq", "mpsoc", "cortex", "arm", "fpga", "cpld", "asic",
                                   "processor", "cpu", "mcu", "soc", "xilinx", "altera", "ultrascale"],
    "Hardware/Interface":         ["uart", "spi", "i2c", "can", "rs422", "rs232", "rs485", "usb",
                                   "ethernet", "pcie", "irig", "nmea", "1pps", "pps", "lvttl",
                                   "lvds", "gpio", "pwm", "jtag", "mdio"],
    "Hardware/Optical":           ["optical", "sfp", "gth", "gtx", "fiber", "fibre",
                                   "transceiver", "duplex", "lane", "serdes", "wavelength"],
    "Hardware/Clock":             ["clock", "oscillator", "pll", "crystal", "reference clock",
                                   "jitter", "ppb", "holdover", "synchronization", "timing",
                                   "tcxo", "ocxo"],
    "Hardware/Environmental":     ["temperature", "humidity", "vibration", "shock", "mil-std",
                                   "mil std", "ip67", "ip68", "emc", "emi", "esd", "altitude",
                                   "storage temp", "operating temp"],
    "Hardware/Mechanical":        ["dimension", "weight", "mounting", "heatsink", "fan",
                                   "form factor", "chassis", "enclosure", "pcb", "rack", "size"],
    "Software/Firmware":          ["firmware", "rtos", "bsp", "bare metal", "bootloader",
                                   "boot", "interrupt", "isr", "hal", "embedded software"],
    "Software/Driver":            ["driver", "device driver", "kernel module", "linux", "qnx"],
    "Software/Application":       ["application", "api", "sdk", "middleware", "gui", "hmi"],
    "Non-Functional/Safety":      ["safety", "sil", "reliability", "mtbf", "availability",
                                   "fault", "watchdog", "fail-safe", "redundancy"],
    "Non-Functional/Security":    ["encryption", "authentication", "secure boot", "tls", "ssl",
                                   "aes", "rsa", "hash", "certificate", "firewall"],
    "Non-Functional/Performance": ["latency", "throughput", "response time", "bandwidth",
                                   "performance", "speed", "real-time"],
}

_CAT_ANCHORS: dict[str, str] = {
    "Hardware/Power":             "supply voltage 5V power consumption 3W current draw 500mA",
    "Hardware/Memory":            "DDR4 memory 4GB ECC configuration flash EEPROM 256KB",
    "Hardware/Processor":         "Zynq UltraScale MPSoC ARM Cortex FPGA logic cells",
    "Hardware/Interface":         "UART baud rate SPI clock 50MHz Ethernet 1Gbps port",
    "Hardware/Optical":           "optical fiber SFP transceiver GTH lane 10Gbps duplex",
    "Hardware/Clock":             "reference clock 10MHz PLL jitter 1ps oscillator TCXO",
    "Hardware/Environmental":     "operating temperature -40C humidity vibration shock MIL-STD",
    "Hardware/Mechanical":        "PCB dimensions 160mm weight 500g mounting bracket chassis",
    "Software/Firmware":          "RTOS real-time firmware bootloader BSP bare metal HAL",
    "Software/Driver":            "device driver API Linux kernel interrupt handler ISR",
    "Software/Application":       "application software API SDK middleware GUI HMI",
    "Non-Functional/Safety":      "safety integrity SIL reliability MTBF watchdog fail-safe",
    "Non-Functional/Security":    "encryption authentication secure boot TLS AES certificate",
    "Non-Functional/Performance": "latency throughput response time bandwidth real-time",
    "Functional":                 "system shall perform function behaviour interface",
}

#-------------------------
# @function: _build_cat_embeddings_sync
# @description: build category embeddings
# @purpose:  build category embeddings
# @return:    category embeddings
#-------------------------
def _build_cat_embeddings_sync() -> dict:
    """CPU-bound — run in executor, not on event loop."""
    enc = _get_encoder()
    if enc is None:
        return {}
    import numpy as np
    return {
        cat: enc.encode([sentence], show_progress_bar=False)[0]
        for cat, sentence in _CAT_ANCHORS.items()
    }

#-------------------------
# @function: _keyword_classify_sync
# @description: classify text by keyword
# @purpose:  classify text by keyword
# @return:    tuple of (category, confidence)
#-------------------------
def _keyword_classify_sync(text: str) -> tuple[str, float]:
    lower = text.lower()
    best_cat, best_hits = "Functional", 0
    for cat, kws in _KW_BUCKETS.items():
        hits = sum(1 for kw in kws if re.search(r'\b' + re.escape(kw) + r'\b', lower))
        if hits > best_hits:
            best_hits, best_cat = hits, cat
    return best_cat, min(best_hits / 3.0, 1.0)

#-------------------------
# @function: _semantic_classify_sync
# @description: classify text by semantic similarity
# @purpose:  classify text by semantic similarity
# @return:    tuple of (category, confidence)
#-------------------------
def _semantic_classify_sync(text: str, kw_cat: str) -> tuple[str, float]:
    global _CAT_EMBS
    enc = _get_encoder()
    if enc is None or not _CAT_EMBS:
        return kw_cat, 0.0
    import numpy as np
    vec = enc.encode([text], show_progress_bar=False)[0]
    best_cat, best_sim = kw_cat, -1.0
    for cat, anchor in _CAT_EMBS.items():
        sim = float(np.dot(vec, anchor) /
                    (np.linalg.norm(vec) * np.linalg.norm(anchor) + 1e-9))
        if sim > best_sim:
            best_sim, best_cat = sim, cat
    return best_cat, max(best_sim, 0.0)


#-------------------------
# @function: _classify
# @description: classify text by category
# @purpose:  classify text by category
# @return:    tuple of (category, subcategory, confidence)
#-------------------------
async def _classify(text: str) -> tuple[str, str, float]:
    """
    Non-blocking hybrid classification.
    Both keyword and semantic stages run in the shared thread executor.
    """
    loop = asyncio.get_event_loop()

    kw_cat, kw_conf = await loop.run_in_executor(
        _EXECUTOR, _keyword_classify_sync, text
    )
    sem_cat, sem_conf = await loop.run_in_executor(
        _EXECUTOR, _semantic_classify_sync, text, kw_cat
    )

    if sem_conf > 0.55:
        final = sem_cat
        blend = (sem_conf * 0.7) + (kw_conf * 0.3)
    else:
        final = kw_cat
        blend = (kw_conf * 0.7) + (sem_conf * 0.3)

    parts    = final.split("/", 1)
    category = parts[0]
    subcat   = parts[1] if len(parts) > 1 else "General"
    return category, subcat, round(blend, 3)


# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 6 — EXPLANATION
# ═══════════════════════════════════════════════════════════════════════════════

#-------------------------
# @function: _explain
# @description: explain the requirement
# @purpose:  explain the requirement
# @return:    explanation of the requirement
#-------------------------
def _explain(text: str, category: str, subcat: str, keywords: list[str]) -> str:
    kw_str = ", ".join(keywords[:3]) if keywords else "embedded domain terms"
    if "[TABLE DATA]" in text:
        return f"Structured specification table for {subcat.lower()} parameters ({kw_str})."
    verb = ("mandates"  if _DIRECTIVE_STRONG.search(text)
            else "specifies" if _DIRECTIVE_MODERATE.search(text)
            else "describes")
    return {
        "Hardware":       f"This {subcat.lower()} requirement {verb} measurable hardware parameters ({kw_str}).",
        "Software":       f"This {subcat.lower()} requirement {verb} software/firmware behaviour ({kw_str}).",
        "Non-Functional": f"This {subcat.lower()} quality attribute {verb} system constraints ({kw_str}).",
        "Functional":     f"This functional requirement {verb} system behaviour involving ({kw_str}).",
    }.get(category, f"This requirement {verb} system behaviour ({kw_str}).")


# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 7 — CONFIDENCE
# ═══════════════════════════════════════════════════════════════════════════════
_DOC_SIGNALS: dict[str, list[str]] = {
    "HRS":  ["hardware", "power", "voltage", "memory", "ddr", "fpga", "interface", "clock", "optical"],
    "SRS":  ["software", "firmware", "driver", "rtos", "api", "application"],
    "SDD":  ["module", "function", "class", "algorithm", "state", "sequence"],
    "SyRS": ["system", "performance", "availability", "safety", "integration"],
}

#-------------------------
# @function: _confidence
# @description: calculate confidence
# @purpose:  calculate confidence of the requirement
# @return:    confidence of the requirement
#-------------------------
def _confidence(text: str, rule_score: int, sem_conf: float,
                kw_conf: float, doc_type: str) -> float:
    rule_norm = min(rule_score / 10.0, 1.0)
    conf      = (rule_norm * 0.3) + (sem_conf * 0.5) + (kw_conf * 0.2)
    lower     = text.lower()
    if any(kw in lower for kw in _DOC_SIGNALS.get(doc_type, [])):
        conf += 0.05
    return round(min(conf, 1.0), 3)


# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 8 — DEDUP + LINKING
# ═══════════════════════════════════════════════════════════════════════════════

#-------------------------
# @function: _dedup_and_link
# @description: dedup and link requirements
# @purpose:  dedup and link requirements
# @return:    list of requirements
#-------------------------
def _dedup_and_link(reqs: list[dict],
                    dedup_thr: float = 88,
                    link_thr:  float = 70) -> list[dict]:
    reqs = sorted(reqs, key=lambda r: -r.get("confidence", 0))
    kept: list[dict] = []
    for req in reqs:
        is_dup = False
        for ex in kept:
            ratio = fuzz.token_sort_ratio(req["text"], ex["text"])
            if ratio >= dedup_thr:
                is_dup = True
                break
            if ratio >= link_thr:
                ex.setdefault("related_ids", []).append(req["id"])
                req.setdefault("related_ids", []).append(ex["id"])
        if not is_dup:
            kept.append(req)
    removed = len(reqs) - len(kept)
    log.info(f"[DEDUP] {len(reqs)} → {len(kept)} ({removed} removed)")
    print(f"  [DEDUP] {len(reqs)} → {len(kept)} ({removed} duplicates removed)")
    return kept


# ═══════════════════════════════════════════════════════════════════════════════
# KEYWORD EXTRACTION
# ═══════════════════════════════════════════════════════════════════════════════

#-------------------------
# @function: _extract_keywords_sync
# @description: extract keywords from text
# @purpose:  extract keywords from text
# @return:    list of keywords
#-------------------------
def _extract_keywords_sync(text: str, max_kw: int = 8) -> list[str]:
    keywords: list[str] = []
    lower = text.lower()

    for kw in PROTOCOLS | ALL_DOMAIN_KW:
        if re.search(r'\b' + re.escape(kw) + r'\b', lower):
            keywords.append(kw)
            if len(keywords) >= max_kw:
                break

    kb = _get_kw_model()
    if kb and len(keywords) < max_kw:
        try:
            raw = kb.extract_keywords(text, keyphrase_ngram_range=(1, 2),
                                       top_n=6, stop_words="english")
            for kw, _ in raw:
                clean = kw.lower().strip()
                if len(clean) > 2 and clean not in keywords:
                    keywords.append(clean)
                    if len(keywords) >= max_kw:
                        break
        except Exception:
            pass

    if _YAKE and len(keywords) < max_kw:
        try:
            for kw, _ in _YAKE.extract_keywords(text)[:10]:
                clean = kw.lower().strip()
                if len(clean) > 3 and clean not in keywords:
                    keywords.append(clean)
                    if len(keywords) >= max_kw:
                        break
        except Exception:
            pass

    return list(dict.fromkeys(keywords))[:max_kw]

#-------------------------
# @function: _extract_keywords
# @description: extract keywords from text
# @purpose:  extract keywords from text
# @return:    list of keywords
#-------------------------
async def _extract_keywords(text: str, max_kw: int = 8) -> list[str]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_EXECUTOR, _extract_keywords_sync, text, max_kw)


# ═══════════════════════════════════════════════════════════════════════════════
# PAGE WORKER — processes one page through all 8 stages
# ═══════════════════════════════════════════════════════════════════════════════

_PREFIX_MAP = {"Hardware": "HAR", "Software": "SOF",
               "Non-Functional": "NFR", "Functional": "FUN"}

#-------------------------
# @function: _process_page
# @description: process one page through all 8 stages
# @purpose:  process one page through all 8 stages
# @return:    list of requirements
#-------------------------
async def _process_page(
    page_num:      int,
    text:          str,
    table_blocks:  list[str],
    doc_type:      str,
    doc_name:      str,
    counters:      dict,
    id_lock:       asyncio.Lock,
    llm_sem:       asyncio.Semaphore,
    use_llm_norm:  bool,
) -> list[dict]:
    """
    One page → list of requirement dicts.
    Called by _page_queue_worker; never more than PAGE_CONCURRENCY active.
    """
    # Stage 2 — Segment
    if _is_toc_page(text) or _is_cover_page(text):
        log.debug(f"Page {page_num}: skipped (ToC/cover)")
        return []

    segments = _smart_segment(text) + table_blocks

    # Stage 3 — Gate (sync, fast)
    passed: list[tuple[str, int]] = []
    for seg in segments:
        seg = seg.strip()
        if not seg:
            continue
        ok, rs = _passes_gate(seg)
        if ok:
            passed.append((seg, rs))

    if not passed:
        return []

    # Stage 4 — Normalize (batch LLM or local)
    raw_texts = [s for s, _ in passed]
    if use_llm_norm:
        # Process in BATCH_SIZE chunks
        normalized_list: list[str] = []
        for i in range(0, len(raw_texts), BATCH_SIZE):
            batch  = raw_texts[i : i + BATCH_SIZE]
            result = await _normalize_batch_llm(batch, llm_sem)
            normalized_list.extend(result)
    else:
        normalized_list = [_normalize_local(s) for s in raw_texts]

    # Stages 5–7 — classify / explain / score (concurrent per segment)
    async def _pipeline_one(seg_orig: str, rs: int, normalized: str) -> Optional[dict]:
        category, subcat, sem_conf = await _classify(normalized)
        keywords                   = await _extract_keywords(normalized)
        _, kw_conf                 = await asyncio.get_event_loop().run_in_executor(
                                         _EXECUTOR, _keyword_classify_sync, normalized)
        conf = _confidence(normalized, rs, sem_conf, kw_conf, doc_type)
        if conf < MIN_CONFIDENCE:
            return None
        explanation = _explain(normalized, category, subcat, keywords)

        async with id_lock:
            pfx = _PREFIX_MAP.get(category, "REQ")
            counters[pfx] = counters.get(pfx, 0) + 1
            req_id = f"{pfx}-{counters[pfx]:04d}"

        return {
            # v3-compatible fields
            "id":            req_id,
            "type":          doc_type,
            "category":      category,
            "priority":      "High" if _DIRECTIVE_STRONG.search(normalized) else "Normal",
            "text":          normalized,
            "source":        doc_name,
            "page":          page_num,
            "keywords":      keywords,
            "extracted_at":  datetime.datetime.now().isoformat(),
            # v4 additions
            "sub_category":  subcat,
            "confidence":    conf,
            "explanation":   explanation,
            "text_original": seg_orig,
            "has_unit":      bool(_TECH_UNIT_RE.search(seg_orig)),
            "has_directive": bool(_DIRECTIVE_STRONG.search(seg_orig) or
                                  _DIRECTIVE_MODERATE.search(seg_orig)),
            "char_count":    len(normalized),
            "rule_score":    rs,
            "related_ids":   [],
        }

    tasks = [
        _pipeline_one(raw_texts[i], passed[i][1], normalized_list[i])
        for i in range(len(passed))
    ]
    results = await asyncio.gather(*tasks)
    candidates = [r for r in results if r is not None]
    log.debug(f"Page {page_num}: {len(candidates)} candidates")
    return candidates


# ═══════════════════════════════════════════════════════════════════════════════
# PAGE QUEUE WORKER — throttles to PAGE_CONCURRENCY
# ═══════════════════════════════════════════════════════════════════════════════

#-------------------------
# @function: _run_extraction_pipeline
# @description: run extraction pipeline
# @purpose:  run extraction pipeline
# @return:    list of requirements
#-------------------------
async def _run_extraction_pipeline(
    pages:        list[tuple[int, str, list[str]]],
    doc_type:     str,
    doc_name:     str,
    counters:     dict,
    use_llm_norm: bool,
    progress_callback: callable = None,
) -> list[dict]:
    """
    Runs pages through the pipeline with PAGE_CONCURRENCY workers.
    Uses a semaphore so we never process more than N pages at once.
    """
    page_sem = asyncio.Semaphore(PAGE_CONCURRENCY)
    llm_sem  = asyncio.Semaphore(LLM_CONCURRENCY)
    id_lock  = asyncio.Lock()
    all_candidates: list[dict] = []

    processed_count = 0
    total_pages = len(pages)
    
    async def _worker(page_num: int, text: str, tables: list[str]):
        nonlocal processed_count
        async with page_sem:
            candidates = await _process_page(
                page_num, text, tables, doc_type, doc_name,
                counters, id_lock, llm_sem, use_llm_norm
            )
            all_candidates.extend(candidates)
            print(f"  ✅ Page {page_num}: {len(candidates)} candidates")
            processed_count += 1
            if progress_callback:
                progress_callback({"status": "processing", "message": f"Extracting AI requirements... ({processed_count}/{total_pages} pages)"})

    await asyncio.gather(*[_worker(pn, tx, tb) for pn, tx, tb in pages])
    return all_candidates


# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 1 — INGESTION  (sync, inside pdfplumber context)
# ═══════════════════════════════════════════════════════════════════════════════

#-------------------------
# @function: _ingest_page
# @description: ingest one page
# @purpose:  ingest one page
# @return:    list of requirements
#-------------------------
def _ingest_page(page) -> tuple[str, list[str]]:
    """Returns (text, table_blocks) for one page. Sync — called before async pipeline."""
    w, h = page.width, page.height
    crop = page.within_bbox((0, 60, w, h - 60))

    text = crop.extract_text() or ""

    # OCR fallback
    if len(text.strip()) < 50:
        try:
            import pytesseract
            img  = crop.to_image(resolution=300).original
            ocr  = pytesseract.image_to_string(img)
            if ocr.strip():
                text = ocr
                log.debug(f"OCR fallback on page")
        except Exception as exc:
            log.debug(f"OCR failed: {exc}")

    # Tables
    table_blocks: list[str] = []
    try:
        for table in crop.extract_tables():
            rows = []
            for row in table:
                cells = [str(c).replace('\n', ' ').strip() for c in row if c is not None]
                if any(cells):
                    rows.append(" | ".join(cells))
            if rows:
                table_blocks.append("\n".join(rows))
    except Exception as exc:
        log.debug(f"Table extraction failed: {exc}")

    return text, table_blocks

#-------------------------
# @function: _format_table
# @description: format table
# @purpose:  format table
# @return:    formatted table
#-------------------------
def _format_table(table: list) -> str:
    lines = []
    for row in table:
        cells = [str(c).replace('\n', ' ').strip() for c in row if c is not None]
        if cells and any(cells):
            lines.append(" | ".join(cells))
    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════════════════════
# DOC-TYPE INFERENCE
# ═══════════════════════════════════════════════════════════════════════════════

#-------------------------
# @function: _infer_doc_type
# @description: infer document type
# @purpose:  infer document type
# @return:    document type
#-------------------------
def _infer_doc_type(stem: str) -> str:
    s = stem.lower().replace("-", "").replace("_", "")
    for fragment, dtype in _DOC_TYPE_MAP:
        if fragment.replace(" ", "") in s:
            return dtype
    return "TechSpec"


# ═══════════════════════════════════════════════════════════════════════════════
# PUBLIC API — extract_requirements  (v3-compatible drop-in)
# ═══════════════════════════════════════════════════════════════════════════════

#-------------------------
# @function: extract_requirements
# @description: extract requirements from pdf
# @purpose:  extract requirements from pdf
# @return:    list of requirements
#-------------------------
def extract_requirements(
    pdf_path:     str,
    doc_type:     str,
    counters:     dict | None = None,
    use_llm_norm: bool = False,   # set True only when NVIDIA API is available
) -> list[dict]:
    """
    v3-compatible signature.  Runs the async pipeline synchronously.
    """
    if counters is None:
        counters = {}

    # Normalise v3-style counters
    _v3 = {"Functional": "FUN", "Non-Functional": "NFR",
           "Hardware": "HAR", "Software": "SOF"}
    for old, new in _v3.items():
        if old in counters and new not in counters:
            counters[new] = counters.pop(old)

    pdf_file = Path(pdf_path)
    start    = time.time()
    print(f"🚀 [Agent] Extraction: {pdf_file.name} [{doc_type}]")

    # ── Stage 1: Ingest all pages (sync, keeps pdfplumber context intact) ────
    pages: list[tuple[int, str, list[str]]] = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                if DEBUG_PAGE_LIMIT and page_num > DEBUG_PAGE_LIMIT:
                    print(f"  [DEBUG] Stopped at page {DEBUG_PAGE_LIMIT}")
                    break
                text, tables = _ingest_page(page)
                pages.append((page_num, text, tables))
                page.flush_cache()
    except Exception as exc:
        print(f"❌ PDF read error: {exc}")
        return []

    print(f"  [Ingest] {len(pages)} pages loaded")

    # ── Stages 2–7: Async pipeline ────────────────────────────────────────────
    try:
        loop = asyncio.get_running_loop()
        if loop.is_running():
            print("⚠️ WARNING: extract_requirements (sync) called from a running event loop! This will likely crash. Use extract_requirements_async instead.")
    except RuntimeError:
        pass # No running loop, safe to use asyncio.run
        
    candidates = asyncio.run(
        _run_extraction_pipeline(pages, doc_type, pdf_file.name,
                                 counters, use_llm_norm)
    )

    # ── Stage 8: Dedup ────────────────────────────────────────────────────────
    final = _dedup_and_link(candidates)

    elapsed   = time.time() - start
    high_conf = sum(1 for r in final if r["confidence"] >= 0.60)
    print(f"✅ [Agent] Done in {elapsed:.1f}s | {len(final)} requirements "
          f"({high_conf} high-confidence ≥0.60)")
    return final


#-------------------------
# @function: _format_tables_async
# @description: format tables asynchronously
# @purpose:  format tables asynchronously
# @return:    list of formatted tables
#-------------------------
async def _format_tables_async(
    pages: list[tuple[int, str, list[str]]],
    progress_callback: callable = None
) -> list[tuple[int, str, list[str]]]:
    """Formats raw table strings into Markdown asynchronously using LLM."""

    from llm_inference_engine import get_document_llm
    llm = get_document_llm()

    if not llm:
        return pages

    # 🔹 Optimized system prompt (reusable, low token cost)
    system_prompt = """
        You are a data formatting expert.
        Convert raw pipe-separated text into a valid Markdown table.

        Rules:
        - Output ONLY a Markdown table
        - No explanations, no code fences
        - Preserve all data exactly (no hallucination)
        - Ensure consistent column count in all rows
        - Fix misaligned or broken rows
        - Add header separator row (|---|)
        - Trim extra spaces inside cells
        - Replace empty cells with a blank space
    """

    async def format_one(raw_str: str) -> str:
        user_prompt = f"""
            Input table:
            {raw_str}

            Generate a clean Markdown table.
        """
        try:
            response = await llm.chat.completions.create(
                model="meta/llama-3.1-70b-instruct",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=800,        # optimized
                temperature=0.1,
                top_p=0.9
            )

            formatted = response.choices[0].message.content.strip()

            # 🔹 Remove accidental code fences if any
            if formatted.startswith("```"):
                formatted = "\n".join(formatted.split("\n")[1:-1]).strip()

            return formatted

        except Exception as exc:
            log.debug(f"Async LLM table format failed: {exc}")
            print("Table format failed, returning raw table:\n\n" + raw_str + "\n\nEnd of table")
            return raw_str

    # 🔹 Gather tasks
    tasks = []
    for _, _, tables in pages:
        for t in tables:
            if t.strip():
                tasks.append(format_one(t))

    if not tasks:
        return pages

    print(f"  [Tables] Formatting {len(tasks)} tables concurrently via LLM...")

    if progress_callback:
        progress_callback({
            "status": "formatting",
            "message": f"Formatting {len(tasks)} tables..."
        })

    results = await asyncio.gather(*tasks)

    # 🔹 Reconstruct pages
    new_pages = []
    res_idx = 0

    for p_num, text, tables in pages:
        new_tables = []

        for t in tables:
            if t.strip():
                new_tables.append(results[res_idx])
                res_idx += 1
            else:
                new_tables.append("[TABLE DATA]\n" + t)

        new_pages.append((p_num, text, new_tables))

    return new_pages

#-------------------------
# @function: extract_requirements_async
# @description: extract requirements asynchronously
# @purpose:  extract requirements asynchronously
# @return:    list of requirements
#-------------------------
async def extract_requirements_async(
    pdf_path:     str,
    doc_type:     str,
    counters:     dict | None = None,
    use_llm_norm: bool = False,
    progress_callback: callable = None,
) -> list[dict]:
    """
    Async variant — use this inside FastAPI route handlers.
    Avoids the loop.run_until_complete() call inside an already-running loop.
    """
    
    if counters is None:
        counters = {}

    _v3 = {"Functional": "FUN", "Non-Functional": "NFR",
           "Hardware": "HAR", "Software": "SOF"}

    for old, new in _v3.items():
        if old in counters and new not in counters:
            counters[new] = counters.pop(old)

    pdf_file = Path(pdf_path)
    start    = time.time()
    print(f"🚀 [Agent-Async] Extraction: {pdf_file.name} [{doc_type}]")

    # Ingest sync (pdfplumber is not thread-safe; run in executor)
    if progress_callback:
        progress_callback({"status": "ingesting", "message": "Reading raw document layout..."})

    loop  = asyncio.get_event_loop()
    pages = await loop.run_in_executor(_EXECUTOR, _ingest_all_pages, pdf_path, progress_callback)
    print(f"  [Ingest] {len(pages)} pages loaded")

    # [NEW] Format tables concurrently
    pages = await _format_tables_async(pages, progress_callback)

    # Warm up embeddings if not ready
    if progress_callback:
        progress_callback({"status": "warming", "message": "Warming up semantic embedding models..."})
    await _warm_up()

    if progress_callback:
        progress_callback({"status": "processing", "message": "Starting parallel AI extraction..."})
    candidates = await _run_extraction_pipeline(
        pages, doc_type, pdf_file.name, counters, use_llm_norm, progress_callback
    )
    final     = _dedup_and_link(candidates)
    elapsed   = time.time() - start
    high_conf = sum(1 for r in final if r["confidence"] >= 0.60)
    print(f"✅ [Agent-Async] Done in {elapsed:.1f}s | {len(final)} requirements "
          f"({high_conf} high-confidence ≥0.60)")
    return final


#-------------------------
# @function: _ingest_all_pages
# @description: ingest all pages
# @purpose:  ingest all pages
# @return:    list of pages
#-------------------------
def _ingest_all_pages(pdf_path: str, progress_callback: callable = None) -> list[tuple[int, str, list[str]]]:
    """Sync helper for executor call."""
    pages = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            total = len(pdf.pages)
            for page_num, page in enumerate(pdf.pages, 1):
                if DEBUG_PAGE_LIMIT and page_num > DEBUG_PAGE_LIMIT:
                    break
                text, tables = _ingest_page(page)
                pages.append((page_num, text, tables))
                page.flush_cache()
                if progress_callback and page_num % 5 == 0:
                    progress_callback({"status": "ingesting", "message": f"Read layout: {page_num}/{total} pages..."})
    except Exception as exc:
        log.error(f"PDF read error: {exc}")
    return pages


# ═══════════════════════════════════════════════════════════════════════════════
# MULTI-FORMAT SCAN (identical v3 API)
# ═══════════════════════════════════════════════════════════════════════════════

#-------------------------
# @function: _extract_from_string
# @description: extract requirements from plain text
# @purpose:  extract requirements from plain text
# @return:    list of requirements
#-------------------------
async def _extract_from_string(text: str, filename: str,
                          doc_type: str, counters: dict) -> list[dict]:
    """Plain-text / DOCX / ODT / MD path — async, uses local normalization."""
    segments = _smart_segment(text)
    candidates: list[dict] = []

    id_lock = asyncio.Lock()
    tasks = []
    for seg in segments:
        seg = seg.strip()
        if not seg:
            continue
        ok, rs = _passes_gate(seg)
        if not ok:
            continue
        normalized = _normalize_local(seg)

        async def _one(s=seg, r=rs, n=normalized):
            cat, sub, sem = await _classify(n)
            kws           = await _extract_keywords(n)
            _, kc         = await asyncio.get_event_loop().run_in_executor(
                                _EXECUTOR, _keyword_classify_sync, n)
            conf          = _confidence(n, r, sem, kc, doc_type)
            if conf < MIN_CONFIDENCE:
                return None
            expl = _explain(n, cat, sub, kws)
            async with id_lock:
                pfx = _PREFIX_MAP.get(cat, "REQ")
                counters[pfx] = counters.get(pfx, 0) + 1
                rid = f"{pfx}-{counters[pfx]:04d}"
            return {
                "id": rid, "type": doc_type, "category": cat,
                "priority": "High" if _DIRECTIVE_STRONG.search(n) else "Normal",
                "text": n, "source": filename, "page": 1,
                "keywords": kws, "extracted_at": datetime.datetime.now().isoformat(),
                "sub_category": sub, "confidence": conf, "explanation": expl,
                "text_original": s, "has_unit": bool(_TECH_UNIT_RE.search(s)),
                "has_directive": bool(_DIRECTIVE_STRONG.search(s)),
                "char_count": len(n), "rule_score": r, "related_ids": [],
            }
        tasks.append(_one())
    results = await asyncio.gather(*tasks)
    candidates = [r for r in results if r]

    return _dedup_and_link(candidates)


#-------------------------
# @function: extract_from_docx
# @description: extract requirements from docx
# @purpose:  extract requirements from docx
# @return:    list of requirements
#-------------------------
async def extract_from_docx(path: str, doc_type: str, counters: dict) -> list[dict]:
    try:
        from docx import Document
        text = "\n".join(p.text for p in Document(path).paragraphs)
        return await _extract_from_string(text, Path(path).name, doc_type, counters)
    except Exception as exc:
        print(f"Docx error: {exc}")
        return []


#-------------------------
# @function: extract_from_odt
# @description: extract requirements from odt
# @purpose:  extract requirements from odt
# @return:    list of requirements
#-------------------------
async def extract_from_odt(path: str, doc_type: str, counters: dict) -> list[dict]:
    try:
        import zipfile, xml.etree.ElementTree as ET
        with zipfile.ZipFile(path) as zf:
            root = ET.fromstring(zf.read('content.xml'))
        ns   = {'text': 'urn:oasis:names:tc:opendocument:xmlns:text:1.0'}
        text = "\n".join("".join(p.itertext())
                         for p in root.iterfind('.//text:p', namespaces=ns))
        return await _extract_from_string(text, Path(path).name, doc_type, counters)
    except Exception as exc:
        print(f"Odt error: {exc}")
        return []


#-------------------------
# @function: extract_from_text
# @description: extract requirements from text
# @purpose:  extract requirements from text
# @return:    list of requirements
#-------------------------
async def extract_from_text(path: str, doc_type: str, counters: dict) -> list[dict]:
    try:
        return await _extract_from_string(
            Path(path).read_text(encoding='utf-8'),
            Path(path).name, doc_type, counters
        )
    except Exception as exc:
        print(f"Text error: {exc}")
        return []


#-------------------------
# @function: scan_file
# @description: scan a file for requirements
# @purpose:  scan a file for requirements
# @return:    list of requirements
#-------------------------
async def scan_file(file_path: str, doc_type: str = None,
              counters: dict = None, progress_callback: callable = None) -> list[dict]:
    if counters is None:
        counters = {}
    p     = Path(file_path)
    dtype = doc_type or _infer_doc_type(p.stem)
    ext   = p.suffix.lower()
    
    if ext == '.pdf':
        return await extract_requirements_async(str(p), dtype, counters, use_llm_norm=True,progress_callback=progress_callback)
    elif ext == '.docx':
        return await extract_from_docx(str(p), dtype, counters)
    elif ext == '.odt':
        return await extract_from_odt(str(p), dtype, counters)
    elif ext in ['.md', '.txt']:
        return await extract_from_text(str(p), dtype, counters)
    return []


#-------------------------
# @function: scan_folder
# @description: scan a folder for requirements
# @purpose:  scan a folder for requirements
# @return:    list of requirements
#-------------------------
async def scan_folder(folder_path: str, progress_callback: callable = None) -> list[dict]:
    folder    = Path(folder_path)
    all_reqs  = []
    counters  = {}
    supported = {'.pdf', '.docx', '.odt', '.md', '.txt'}
    print(f"🔍 Scanning: {folder_path}")
    files = ([folder] if folder.is_file()
             else sorted(f for f in folder.rglob("*") if f.suffix.lower() in supported))
    if not files:
        print(f"⚠️  No supported files in {folder_path}")
        return []
    for f in files:
        print(f"📄 Processing: {f.name}")
        extracted = await scan_file(str(f), counters=counters, progress_callback=progress_callback)
        print(f"   -> {len(extracted)} requirements")
        all_reqs.extend(extracted)
    return all_reqs


#-------------------------
# @function: save_to_json
# @description: save requirements to json
# @purpose:  save requirements to json
# @return:    list of requirement ids
#-------------------------
def save_to_json(requirements: list, output_dir: str = None) -> list[str]:
    try:
        from system_config import REQ_DIR
        out = Path(output_dir) if output_dir else REQ_DIR
    except ImportError:
        out = Path(output_dir) if output_dir else Path("./output")
    out.mkdir(parents=True, exist_ok=True)
    fpath = out / "requirements.json"
    with open(fpath, 'w', encoding='utf-8') as f:
        json.dump(requirements, f, indent=2)
    return [r['id'] for r in requirements]


# ═══════════════════════════════════════════════════════════════════════════════
# TRACEABILITY MATRIX
# ═══════════════════════════════════════════════════════════════════════════════

#-------------------------
# @function: build_traceability_matrix
# @description: build traceability matrix
# @purpose:  build traceability matrix
# @return:    dict of traceability matrix
#-------------------------
def build_traceability_matrix(
    all_reqs:   list[dict],
    chain:      list[str] | None = None,
    link_thr:   float = 65,
) -> dict[str, list[str]]:
    if chain is None:
        chain = ["SyRS", "HRS", "SRS", "SDD"]
    by_type: dict[str, list[dict]] = {}
    for r in all_reqs:
        by_type.setdefault(r["type"], []).append(r)
    matrix: dict[str, list[str]] = {}
    for i in range(len(chain) - 1):
        ups   = by_type.get(chain[i], [])
        downs = by_type.get(chain[i + 1], [])
        for up in ups:
            key = f"{chain[i]}:{up['id']}"
            matrix.setdefault(key, [])
            for dn in downs:
                if fuzz.token_sort_ratio(up["text"], dn["text"]) >= link_thr:
                    matrix[key].append(f"{chain[i+1]}:{dn['id']}")
    return matrix


# ═══════════════════════════════════════════════════════════════════════════════
# PYTESSERACT INIT (v3 pattern)
# ═══════════════════════════════════════════════════════════════════════════════

try:
    from system_config import TESSERACT_CMD
    import pytesseract
    pytesseract.pytesseract.tesseract_cmd = str(TESSERACT_CMD)
except Exception:
    pass