import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  FolderTree, FileCode, Play, Terminal as TerminalIcon,
  ChevronRight, ChevronDown, Download, Zap, Activity,
  Maximize2, Minimize2, FileText, Folder, FolderOpen,
  X, ChevronUp, Circle, CheckCircle2, AlertTriangle,
  LayoutTemplate, Code2, BookOpen, Cpu, Hash, ArrowRight,
  RefreshCw, PanelRightClose, PanelRightOpen, Sparkles,
  ClipboardList, ShieldCheck, Tag
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import TiptapEditor from '../components/TiptapEditor';
import CustomSelect from '../components/ui/CustomSelect';
import { getApiUrl } from '../utils/apiConfig';

// ─── Tokens ──────────────────────────────────────────────────────────────────
const C = {
  bg: '#f8f9fb',
  surface: '#ffffff',
  surfaceHover: '#f4f5f8',
  border: '#e5e8ef',
  borderLight: '#f0f2f6',
  text: '#0f1117',
  textMuted: '#6b7280',
  textFaint: '#9ca3af',
  accent: '#2563eb',
  accentLight: '#eff6ff',
  accentMuted: '#bfdbfe',
  green: '#059669',
  greenLight: '#ecfdf5',
  amber: '#d97706',
  amberLight: '#fffbeb',
  red: '#dc2626',
  redLight: '#fef2f2',
};

// ─── File icons by extension ──────────────────────────────────────────────────
function fileIcon(name) {
  const ext = name.split('.').pop();
  const map = { c: '#3b82f6', h: '#8b5cf6', md: '#059669', py: '#f59e0b', mk: '#6366f1', makefile: '#6366f1' };
  const color = map[ext?.toLowerCase()] || '#6b7280';
  return <FileCode size={13} style={{ color }} />;
}

// ─── FileNode ─────────────────────────────────────────────────────────────────
function FileNode({ node, activeFile, onSelect, depth = 0 }) {
  const [open, setOpen] = useState(depth < 2);
  const isDir = node.type === 'dir';
  const active = !isDir && activeFile === node.path;

  return (
    <div>
      <button
        onClick={() => isDir ? setOpen(o => !o) : onSelect(node.path)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          gap: 6, padding: `5px 8px 5px ${10 + depth * 14}px`,
          borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left',
          background: active ? C.accentLight : 'transparent',
          color: active ? C.accent : C.text,
          fontWeight: active ? 600 : 400,
          fontSize: 13,
          transition: 'all .12s',
        }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.surfaceHover; }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
      >
        {isDir
          ? open
            ? <FolderOpen size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
            : <Folder size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
          : <span style={{ flexShrink: 0 }}>{fileIcon(node.name)}</span>
        }
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
        {isDir && (
          <span style={{ color: C.textFaint, flexShrink: 0 }}>
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        )}
      </button>
      {isDir && open && node.children && (
        <div>
          {node.children.map((child, i) => (
            <FileNode key={i} node={child} activeFile={activeFile} onSelect={onSelect} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Terminal Line ────────────────────────────────────────────────────────────
function TermLine({ line, idx }) {
  const isErr = line.includes('[ERROR]');
  const isOk = line.includes('successfully') || line.includes('Successfully');
  const isProc = line.includes('[PROCESS]') || line.includes('[INFO]');
  const color = isErr ? C.red : isOk ? C.green : isProc ? C.accent : C.textMuted;
  const icon = isErr
    ? <AlertTriangle size={10} />
    : isOk
      ? <CheckCircle2 size={10} />
      : isProc
        ? <Circle size={10} />
        : null;

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      padding: '4px 0', borderBottom: `1px solid ${C.borderLight}`,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    }}>
      <span style={{ color: C.textFaint, fontSize: 10, minWidth: 28, paddingTop: 2 }}>
        {String(idx + 1).padStart(3, '0')}
      </span>
      {icon && <span style={{ color, paddingTop: 2, flexShrink: 0 }}>{icon}</span>}
      <span style={{ color, fontSize: 12, lineHeight: 1.6, flex: 1 }}>{line}</span>
    </div>
  );
}

// ─── Tab Pill ─────────────────────────────────────────────────────────────────
function TabPill({ label, icon, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '7px 16px', borderRadius: 10, border: 'none',
        cursor: 'pointer', fontSize: 12, fontWeight: 600,
        letterSpacing: '0.02em', transition: 'all .15s',
        background: active ? C.surface : 'transparent',
        color: active ? C.text : C.textMuted,
        boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08), 0 0 0 1px #e5e8ef' : 'none',
      }}
    >
      <span style={{ color: active ? C.accent : C.textFaint }}>{icon}</span>
      {label}
      {badge && (
        <span style={{
          background: C.accentLight, color: C.accent,
          fontSize: 10, fontWeight: 700, padding: '1px 6px',
          borderRadius: 999, border: `1px solid ${C.accentMuted}`,
        }}>{badge}</span>
      )}
    </button>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle, action }) {
  return (
    <div style={{
      padding: '12px 20px', borderBottom: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: C.surface,
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: C.textFaint, marginTop: 1 }}>{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function StatusDot({ active }) {
  return (
    <span style={{
      width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
      background: active ? C.green : C.textFaint,
      boxShadow: active ? `0 0 0 3px ${C.greenLight}` : 'none',
      animation: active ? 'pulse 2s infinite' : 'none',
    }} />
  );
}

// ─── TOC ──────────────────────────────────────────────────────────────────────
function TableOfContents({ doc }) {
  const headings = doc.split('\n').filter(l => l.startsWith('#'));
  if (!headings.length) return (
    <div style={{ padding: '24px 16px', textAlign: 'center', color: C.textFaint, fontSize: 12 }}>
      No headings yet
    </div>
  );
  return (
    <div style={{ padding: '12px 0' }}>
      {headings.map((line, idx) => {
        const level = line.match(/^#+/)[0].length;
        const title = line.replace(/^#+\s*/, '').trim();
        const id = title.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w-]/g, '');
        return (
          <button
            key={idx}
            onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              gap: 6, padding: `5px 16px 5px ${12 + (level - 1) * 12}px`,
              border: 'none', background: 'transparent', cursor: 'pointer',
              textAlign: 'left', color: level === 1 ? C.text : C.textMuted,
              fontSize: level === 1 ? 12 : 11,
              fontWeight: level === 1 ? 600 : 400,
              transition: 'color .12s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = C.accent}
            onMouseLeave={e => e.currentTarget.style.color = level === 1 ? C.text : C.textMuted}
          >
            <Hash size={10} style={{ color: C.textFaint, flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ value, total }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ padding: '0 20px 12px' }}>
      <div style={{
        height: 3, borderRadius: 999,
        background: C.borderLight, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: 999,
          background: `linear-gradient(90deg, ${C.accent}, #60a5fa)`,
          width: `${pct}%`, transition: 'width .3s ease',
          boxShadow: '0 0 8px rgba(37,99,235,0.4)',
        }} />
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        marginTop: 6, fontSize: 10, color: C.textFaint,
      }}>
        <span>Section {value} of {total}</span>
        <span style={{ color: C.accent, fontWeight: 600 }}>{pct}%</span>
      </div>
    </div>
  );
}

// ─── Mermaid Renderer ─────────────────────────────────────────────────────────
function MermaidRenderer({ code }) {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  const id = useRef(`mermaid-${Math.random().toString(36).substr(2, 9)}`).current;

  useEffect(() => {
    let isCancelled = false;

    const renderDiagram = async () => {
      // Wait for Mermaid CDN to load
      if (!window.mermaid) {
        setTimeout(renderDiagram, 300);
        return;
      }
      try {
        window.mermaid.initialize({ startOnLoad: false, theme: 'default' });
        const { svg: renderedSvg } = await window.mermaid.render(id, code);
        if (!isCancelled) {
          setSvg(renderedSvg);
          setError('');
        }
      } catch (err) {
        console.error('Mermaid render error:', err);
        if (!isCancelled) setError(err.message || 'Syntax Error');
      }
    };

    renderDiagram();

    return () => { isCancelled = true; };
  }, [code, id]);

  if (error) {
    return (
      <div style={{ color: '#dc2626', fontSize: 12, padding: 12, background: '#fef2f2', borderRadius: 8, margin: '16px 0', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
        Failed to render diagram: {error}
      </div>
    );
  }

  if (svg) {
    return (
      <div 
        dangerouslySetInnerHTML={{ __html: svg }} 
        style={{ display: 'flex', justifyContent: 'center', margin: '24px 0', background: 'transparent' }} 
      />
    );
  }

  return (
    <div style={{ padding: 16, color: '#9ca3af', fontStyle: 'italic', fontSize: 12, textAlign: 'center' }}>
      Rendering diagram...
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SoftwareWorkspace({ project: activeProject }) {
  const { srsDoc, setSrsDoc, sddDoc, setSddDoc, isGenerating, setIsGenerating } = useOutletContext();
  const [activeTab, setActiveTab] = useState('requirements');
  const [requirements, setRequirements] = useState([]);
  const [filterCategory, setFilterCategory] = useState('All');
  const [selectedIds, setSelectedIds] = useState([]);
  const [expandedIds, setExpandedIds] = useState([]);
  const [loadingReqs, setLoadingReqs] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [exportFormat, setExportFormat] = useState('md');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 1 });
  const terminalRef = useRef(null);

  useEffect(() => {
    // Load Mermaid CDN
    if (!document.getElementById('mermaid-cdn')) {
      const script = document.createElement('script');
      script.id = 'mermaid-cdn';
      script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
      script.async = true;
      script.onload = () => {
        if (window.mermaid) {
          window.mermaid.initialize({ startOnLoad: false, theme: 'default' });
        }
      };
      document.body.appendChild(script);
    }
  }, []);

  const [codeFiles, setCodeFiles] = useState({
    'driver/uart/src/uart.c': `/* MISRA C 2012 Compliant UART Driver */\n#include "uart.h"\n\nvoid uart_init(void) {\n    /* Hardware initialization */\n}\n\nvoid uart_transmit(const uint8_t* data, uint16_t len) {\n    /* Transmit implementation */\n}`,
    'driver/uart/include/uart.h': `/* UART Interface */\n#ifndef UART_H\n#define UART_H\n\n#include <stdint.h>\n\nvoid uart_init(void);\nvoid uart_transmit(const uint8_t* data, uint16_t len);\n\n#endif`,
    'driver/uart/Makefile': `CC=gcc\nCFLAGS=-Wall -Wextra\n\nall: uart.o\n\nuart.o: src/uart.c\n\t$(CC) $(CFLAGS) -Iinclude -c src/uart.c -o build/uart.o`,
    'driver/README.md': `# Hardware Drivers\n\nContains all low-level hardware abstraction layers compliant with MISRA C.`,
    'library/math_lib/src/math_lib.c': `/* MISRA C Compliant Math Library */\n#include "math_lib.h"\n\nuint16_t calculate_checksum(const uint8_t* data, uint16_t len) {\n    uint16_t sum = 0U;\n    for(uint16_t i=0U; i<len; i++) sum += data[i];\n    return sum;\n}`,
    'library/math_lib/include/math_lib.h': `/* Math Library Headers */\n#ifndef MATH_LIB_H\n#define MATH_LIB_H\n\n#include <stdint.h>\n\nuint16_t calculate_checksum(const uint8_t* data, uint16_t len);\n\n#endif`,
    'library/math_lib/Makefile': `CC=gcc\nCFLAGS=-Wall -Wextra\n\nall: math_lib.o\n\nmath_lib.o: src/math_lib.c\n\t$(CC) $(CFLAGS) -Iinclude -c src/math_lib.c -o build/math_lib.o`,
    'library/README.md': `# Software Libraries\n\nReusable algorithmic components and processing libraries.`,
    'atp/src/main.c': `/* Application Test Program (ATP) */\n#include "app_headers.h"\n#include "uart.h"\n#include "math_lib.h"\n\nint main(void) {\n    uint8_t payload[4] = {0x01U, 0x02U, 0x03U, 0x04U};\n    uart_init();\n    uint16_t crc = calculate_checksum(payload, 4U);\n    if (crc == 0x000AU) uart_transmit(payload, 4U);\n    return 0;\n}`,
    'atp/include/app_headers.h': `/* ATP Headers */\n#ifndef APP_HEADERS_H\n#define APP_HEADERS_H\n\n#include <stdint.h>\n#include <stdbool.h>\n\n#define MAX_PAYLOAD_SIZE 1024U\n\n#endif`,
    'atp/Makefile': `CC=gcc\nCFLAGS=-Wall -Wextra -Iinclude -I../driver/uart/include -I../library/math_lib/include\n\nall: main\n\nmain: src/main.c\n\t$(CC) $(CFLAGS) src/main.c -o bin/atp_exec`,
  });
  const [activeFile, setActiveFile] = useState('atp/src/main.c');
  const [terminalOutput, setTerminalOutput] = useState([
    '$ archtech-sys --v3-engine initialized',
    '[INFO] Workspace ready. Select a tab to begin.',
  ]);

  const fileTree = (() => {
    const root = { name: 'ArchTech_Project', type: 'dir', children: [] };
    Object.keys(codeFiles).forEach(path => {
      const parts = path.split('/');
      let cur = root;
      parts.forEach((part, i) => {
        const isFile = i === parts.length - 1;
        let node = cur.children.find(c => c.name === part);
        if (!node) { node = { name: part, type: isFile ? 'file' : 'dir', children: [], path: isFile ? path : '' }; cur.children.push(node); }
        cur = node;
      });
    });
    return root;
  })();

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [terminalOutput]);

  useEffect(() => {
    const fetchReqs = async () => {
      if (!activeProject?.id) return;
      setLoadingReqs(true);
      try {
        const res = await fetch(getApiUrl(`/requirements/${activeProject.id}`));
        const data = await res.json();
        setRequirements(data);
      } catch (err) {
        console.error("Failed to load requirements:", err);
      } finally {
        setLoadingReqs(false);
      }
    };
    fetchReqs();
  }, [activeProject?.id]);

  useEffect(() => {
    if (isGenerating.srs || isGenerating.sdd) setTerminalOpen(true);
  }, [isGenerating]);

  const filteredRequirements = useMemo(() => {
    if (filterCategory === 'All') return requirements;
    return requirements.filter(r => (r.category || r.type) === filterCategory);
  }, [requirements, filterCategory]);

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const visibleIds = filteredRequirements.map(r => r.id);
    const isAllVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));
    if (isAllVisibleSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...visibleIds])]);
    }
  };

  const toggleExpand = (id) => {
    setExpandedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleGenerateDoc = async (type) => {
    setIsGenerating(prev => ({ ...prev, srs: type === 'SRS', sdd: type !== 'SRS' }));
    if (type === 'SRS') setSrsDoc(''); else setSddDoc('');
    try {
      setTerminalOutput(prev => [...prev, `$ Generating ${type} document...`]);

      console.log("Selected IDS: ", selectedIds);

      const res = await fetch(getApiUrl('/generate-document-stream'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirement_ids: selectedIds, template_type: type, project_id: activeProject?.id }),
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.heading) setTerminalOutput(prev => [...prev, `[PROCESS] Building: ${data.heading}`]);
              if (data.section_num && data.total) setGenerationProgress({ current: data.section_num, total: data.total });
              if (data.content) {
                if (type === 'SRS') setSrsDoc(prev => prev ? prev + '\n\n' + data.content : data.content);
                else setSddDoc(prev => prev ? prev + '\n\n' + data.content : data.content);
              }
              if (data.message) setTerminalOutput(prev => [...prev, `[INFO] ${data.message}`]);
            } catch (_) {}
          }
        }
      }
      setTerminalOutput(prev => [...prev, `${type} generated successfully.`]);
    } catch {
      setTerminalOutput(prev => [...prev, `[ERROR] Failed to generate ${type}`]);
    } finally {
      setIsGenerating(prev => ({ ...prev, srs: false, sdd: false }));
    }
  };

  const handleCompile = () => {
    setIsCompiling(true);
    setTerminalOutput(prev => [...prev, `$ gcc -Wall -Wextra ${activeFile} -o firmware.bin`]);
    setTimeout(() => {
      setTerminalOutput(prev => [...prev, 'firmware.bin compiled successfully. 0 errors, 0 warnings.']);
      setIsCompiling(false);
    }, 1400);
  };

  const handleExport = async () => {
    const content = activeTab === 'srs' ? srsDoc : activeTab === 'sdd' ? sddDoc : activeTab === 'requirements' ? JSON.stringify(requirements, null, 2) : codeFiles[activeFile];
    if (exportFormat === 'odt' && activeTab !== 'requirements') {
      try {
        setTerminalOutput(prev => [...prev, `[PROCESS] Exporting ${activeTab.toUpperCase()} as ODT...`]);
        const response = await fetch(getApiUrl('/export-document'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, doc_type: activeTab.toUpperCase() }),
        });
        if (!response.ok) throw new Error('Export failed');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        Object.assign(document.createElement('a'), { href: url, download: `export_${activeTab.toUpperCase()}.odt` }).click();
        setTerminalOutput(prev => [...prev, `[INFO] ODT exported successfully.`]);
      } catch (e) {
        setTerminalOutput(prev => [...prev, `[ERROR] ${e.message}`]);
      }
    } else {
      const blob = new Blob([content], { type: activeTab === 'requirements' ? 'application/json' : 'text/plain' });
      const url = URL.createObjectURL(blob);
      Object.assign(document.createElement('a'), { href: url, download: `export_${activeTab}.${activeTab === 'requirements' ? 'json' : exportFormat}` }).click();
    }
  };

  const isGenActive = activeTab === 'srs' ? isGenerating.srs : activeTab === 'sdd' ? isGenerating.sdd : false;
  const currentDoc = activeTab === 'srs' ? srsDoc : sddDoc;

  const getCategoryColor = (cat) => {
    const map = {
      'Hardware': '#3b82f6', 'Software': '#6366f1', 'Non-Functional': '#64748b',
      'Functional': '#2563eb', 'System': '#4f46e5', 'Clock': '#f59e0b',
      'Memory': '#8b5cf6', 'Interface': '#0ea5e9'
    };
    return map[cat] || '#64748b';
  };

  const TABS = [
    { id: 'requirements', label: 'Requirements', icon: <ClipboardList size={13} /> },
    { id: 'srs', label: 'SRS Document', icon: <BookOpen size={13} /> },
    { id: 'sdd', label: 'SDD Document', icon: <LayoutTemplate size={13} /> },
    { id: 'code', label: 'Code Editor', icon: <Code2 size={13} /> },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Geist:wght@400;500;600;700&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
      `}</style>

      <div style={{
        display: 'flex', height: '100%', gap: 0,
        background: C.bg, fontFamily: "'Geist', 'Inter', sans-serif",
        overflow: 'hidden', borderRadius: 16,
        border: `1px solid ${C.border}`,
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>

        {/* ── Left Sidebar (File Tree) ────────────────────────────────── */}
        {activeTab === 'code' && sidebarOpen && (
          <div style={{
            width: 240, display: 'flex', flexDirection: 'column',
            borderRight: `1px solid ${C.border}`, background: C.surface,
            flexShrink: 0, animation: 'fadeIn .2s ease',
          }}>
            <SectionHeader
              title="Files"
              subtitle={`${Object.keys(codeFiles).length} files`}
              action={
                <button onClick={() => setSidebarOpen(false)} style={{
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  padding: 4, borderRadius: 6, color: C.textFaint,
                  display: 'flex', alignItems: 'center',
                }} title="Collapse sidebar">
                  <PanelRightClose size={14} />
                </button>
              }
            />
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
              <FileNode node={fileTree} activeFile={activeFile} onSelect={setActiveFile} />
            </div>
          </div>
        )}

        {/* ── Main Content ──────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

          {/* ── Topbar ── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px', borderBottom: `1px solid ${C.border}`,
            background: C.surface, flexShrink: 0, gap: 12,
          }}>
            {/* Tab pills */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 2,
              background: C.bg, padding: 4, borderRadius: 12,
              border: `1px solid ${C.border}`,
            }}>
              {TABS.map(t => (
                <TabPill
                  key={t.id} label={t.label} icon={t.icon}
                  active={activeTab === t.id}
                  onClick={() => setActiveTab(t.id)}
                  badge={
                    t.id === 'srs' && isGenerating.srs ? 'live'
                      : t.id === 'sdd' && isGenerating.sdd ? 'live'
                        : null
                  }
                />
              ))}
            </div>

            {/* Right controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {activeTab === 'code' && !sidebarOpen && (
                <button onClick={() => setSidebarOpen(true)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                  border: `1px solid ${C.border}`, borderRadius: 9, background: C.surface,
                  cursor: 'pointer', fontSize: 12, fontWeight: 500, color: C.textMuted,
                }} title="Show file tree">
                  <PanelRightOpen size={13} />
                </button>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CustomSelect
                  value={exportFormat}
                  onChange={setExportFormat}
                  options={[
                    { label: '.MD', value: 'md' },
                    { label: '.ODT', value: 'odt' },
                    { label: '.PDF', value: 'pdf' },
                    { label: '.TXT', value: 'txt' },
                  ]}
                  className="w-28 z-20"
                />
                <button onClick={handleExport} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', border: `1px solid ${C.border}`,
                  borderRadius: 9, background: C.surface, cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, color: C.text,
                  transition: 'all .12s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.surfaceHover; }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.surface; }}
                >
                  <Download size={13} /> Export
                </button>
              </div>

              <div style={{ width: 1, height: 20, background: C.border }} />

              <button onClick={() => setTerminalOpen(o => !o)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 9, cursor: 'pointer',
                fontSize: 12, fontWeight: 600, border: 'none',
                background: terminalOpen ? C.accentLight : C.bg,
                color: terminalOpen ? C.accent : C.textMuted,
                border: `1px solid ${terminalOpen ? C.accentMuted : C.border}`,
                transition: 'all .12s',
              }}>
                <TerminalIcon size={13} />
                Console
                <StatusDot active={isGenerating.srs || isGenerating.sdd || isCompiling} />
              </button>
            </div>
          </div>

          {/* ── Workspace Row ── */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

            {/* Editor Pane */}
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              overflow: 'hidden', minWidth: 0,
              ...(isFullscreen ? {
                position: 'fixed', inset: 16, zIndex: 100,
                background: C.surface, borderRadius: 16,
                border: `1px solid ${C.border}`,
                boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
              } : {}),
            }}>

              {/* Editor Subheader */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px', borderBottom: `1px solid ${C.border}`,
                background: C.surface, flexShrink: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: C.textFaint, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>
                    {activeTab === 'code' ? activeFile : `${activeTab.toUpperCase()}_Document.md`}
                  </span>
                  {activeTab !== 'code' && (
                    <button onClick={() => setIsFullscreen(f => !f)} style={{
                      border: 'none', background: 'transparent', cursor: 'pointer',
                      padding: '3px 5px', borderRadius: 5, color: C.textFaint,
                      display: 'flex', alignItems: 'center', transition: 'color .12s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.color = C.accent}
                      onMouseLeave={e => e.currentTarget.style.color = C.textFaint}
                    >
                      {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                    </button>
                  )}
                </div>

                {activeTab === 'code' ? (
                  <button onClick={handleCompile} disabled={isCompiling} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px', border: 'none', borderRadius: 8,
                    background: isCompiling ? C.border : C.green, color: '#fff',
                    fontSize: 12, fontWeight: 600, cursor: isCompiling ? 'not-allowed' : 'pointer',
                    opacity: isCompiling ? 0.7 : 1, transition: 'all .12s',
                  }}>
                    {isCompiling
                      ? <><RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> Compiling…</>
                      : <><Play size={12} /> Run & Compile</>
                    }
                  </button>
                ) : (
                  <button onClick={() => handleGenerateDoc(activeTab.toUpperCase())} disabled={isGenActive} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px', border: 'none', borderRadius: 8,
                    background: isGenActive ? C.accentMuted : C.accent,
                    color: '#fff', fontSize: 12, fontWeight: 600,
                    cursor: isGenActive ? 'not-allowed' : 'pointer',
                    transition: 'all .12s',
                  }}>
                    {isGenActive
                      ? <><Sparkles size={12} style={{ animation: 'pulse 1.5s infinite' }} /> Generating…</>
                      : <><Zap size={12} /> Generate {activeTab.toUpperCase()}</>
                    }
                  </button>
                )}
              </div>

              {/* Progress */}
              {isGenActive && (
                <div style={{ borderBottom: `1px solid ${C.border}`, padding: '10px 16px 8px' }}>
                  <ProgressBar value={generationProgress.current} total={generationProgress.total} />
                </div>
              )}

              {/* Editor Body */}
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {activeTab === 'code' ? (
                    <Editor
                      height="100%"
                      theme="light"
                      path={activeFile}
                      defaultLanguage={
                        activeFile.endsWith('.py') ? 'python'
                          : activeFile.endsWith('.c') || activeFile.endsWith('.h') ? 'c'
                            : 'plaintext'
                      }
                      value={codeFiles[activeFile]}
                      onChange={v => setCodeFiles(f => ({ ...f, [activeFile]: v || '' }))}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace",
                        padding: { top: 20, bottom: 20 },
                        scrollBeyondLastLine: false,
                        smoothScrolling: true,
                        cursorBlinking: 'smooth',
                        cursorSmoothCaretAnimation: 'on',
                        lineHeight: 22,
                        renderLineHighlight: 'gutter',
                        bracketPairColorization: { enabled: true },
                      }}
                    />
                  ) : activeTab === 'requirements' ? (
                    <div className="scrollbar-pro" style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', background: '#fafafa' }}>
                      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
                        
                        {/* Category Filter Navigation Bar */}
                        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{
                            background: 'rgba(241, 245, 249, 0.5)', padding: 6, borderRadius: 20,
                            display: 'flex', flexWrap: 'wrap', gap: 4, border: '1px solid rgba(226, 232, 240, 0.6)',
                            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                          }}>
                            <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, color: C.textFaint }}>
                              <Tag size={14} />
                              <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Filter</span>
                            </div>
                            {['All', ...new Set(requirements.map(r => r.category || r.type).filter(Boolean))].map(cat => {
                              const isActive = filterCategory === cat;
                              const color = getCategoryColor(cat);
                              return (
                                <button
                                  key={cat}
                                  onClick={() => setFilterCategory(cat)}
                                  style={{
                                    padding: '8px 16px', borderRadius: 16, border: 'none',
                                    fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.3s',
                                    background: isActive ? color : 'transparent',
                                    color: isActive ? '#fff' : C.textMuted,
                                    boxShadow: isActive ? `0 4px 12px ${color}44` : 'none',
                                    transform: isActive ? 'scale(1.05)' : 'scale(1)',
                                  }}
                                >
                                  {cat}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, background: C.surface, padding: '16px 24px', borderRadius: 20, border: `1px solid ${C.border}` }}>
                          <div>
                            <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>Source Specifications</h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                              <p style={{ fontSize: 12, color: C.textMuted }}>Traceable engineering requirements for synthesis</p>
                              <div style={{ width: 4, height: 4, borderRadius: '50%', background: C.border }} />
                              <span style={{ fontSize: 11, fontWeight: 700, color: C.accent }}>{selectedIds.length} Selected</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                              <input
                                type="checkbox"
                                checked={filteredRequirements.length > 0 && filteredRequirements.every(r => selectedIds.includes(r.id))}
                                onChange={toggleSelectAll}
                                style={{ width: 16, height: 16, cursor: 'pointer' }}
                              />
                              <span style={{ fontSize: 12, fontWeight: 700, color: C.textMuted }}>Select Visible</span>
                            </label>
                            <div style={{
                              padding: '8px 16px', borderRadius: 12, background: C.bg,
                              border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8
                            }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: C.textFaint, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Intelligence Pool:</span>
                              <span style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{requirements.length}</span>
                            </div>
                          </div>
                        </div>

                        {loadingReqs ? (
                          <div style={{ padding: 60, textAlign: 'center', color: C.textFaint }}>
                            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
                            <div style={{ fontSize: 13, fontWeight: 600 }}>Refreshing intelligence pool...</div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {filteredRequirements.map((req, idx) => {
                              const isExpanded = expandedIds.includes(req.id);
                              return (
                                <div key={req.id || idx} style={{
                                  padding: '20px 24px', background: C.surface, borderRadius: 20,
                                  border: `1px solid ${selectedIds.includes(req.id) ? C.accentMuted : C.border}`,
                                  boxShadow: selectedIds.includes(req.id) ? `0 8px 24px ${C.accentLight}88` : '0 2px 8px rgba(0,0,0,0.02)',
                                  transition: 'all .25s ease', animation: 'fadeIn .3s ease forwards',
                                  animationDelay: `${idx * 0.05}s`,
                                  display: 'flex', gap: 20
                                }}>
                                  <div style={{ paddingTop: 4 }}>
                                    <input
                                      type="checkbox"
                                      checked={selectedIds.includes(req.id)}
                                      onChange={() => toggleSelect(req.id)}
                                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                                    />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{
                                          fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700,
                                          color: C.accent, background: C.accentLight, padding: '4px 10px',
                                          borderRadius: 8, border: `1px solid ${C.accentMuted}`
                                        }}>
                                          {req.id}
                                        </div>
                                        <div style={{
                                          fontSize: 10, fontWeight: 800, color: '#fff',
                                          background: getCategoryColor(req.category || req.type),
                                          padding: '4px 10px', borderRadius: 8, textTransform: 'uppercase',
                                          letterSpacing: '0.05em'
                                        }}>
                                          {req.category || req.type}
                                        </div>
                                        {req.priority && (
                                          <div style={{
                                            fontSize: 10, fontWeight: 700, color: req.priority === 'High' ? C.red : C.textMuted,
                                            background: req.priority === 'High' ? C.redLight : C.bg,
                                            padding: '4px 10px', borderRadius: 8, border: `1px solid ${req.priority === 'High' ? C.red : C.border}`
                                          }}>
                                            {req.priority} Priority
                                          </div>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => toggleExpand(req.id)}
                                        style={{
                                          background: 'transparent', border: 'none', cursor: 'pointer',
                                          color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4,
                                          fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 8,
                                          transition: 'all .2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = C.bg}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                      >
                                        {isExpanded ? 'Collapse' : 'Expand'}
                                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                      </button>
                                    </div>
                                    <div className="prose prose-slate max-w-none prose-p:text-[14px] prose-p:leading-relaxed prose-p:text-slate-700" style={{
                                      fontSize: 14, lineHeight: 1.6, color: C.text,
                                      fontWeight: 500, overflow: 'hidden',
                                      display: isExpanded ? 'block' : '-webkit-box',
                                      WebkitLineClamp: isExpanded ? 'none' : 3,
                                      WebkitBoxOrient: 'vertical'
                                    }}>
                                      <ReactMarkdown 
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                          code({ node, inline, className, children, ...props }) {
                                            const match = /language-(\w+)/.exec(className || '');
                                            if (!inline && match && match[1] === 'mermaid') {
                                              return <MermaidRenderer code={String(children).replace(/\n$/, '')} />;
                                            }
                                            return (
                                              <code className={className} {...props}>
                                                {children}
                                              </code>
                                            );
                                          }
                                        }}
                                      >
                                        {req.text}
                                      </ReactMarkdown>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.borderLight}` }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <FileText size={12} style={{ color: C.textFaint }} />
                                        <span style={{ fontSize: 11, fontWeight: 600, color: C.textFaint }}>{req.source || 'Imported Specification'}</span>
                                      </div>
                                      {req.confidence && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                          <ShieldCheck size={12} style={{ color: C.green }} />
                                          <span style={{ fontSize: 11, fontWeight: 700, color: C.green }}>{Math.round(req.confidence * 100)}% Extraction Match</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : activeTab === 'srs' ? (
                    <TiptapEditor
                      content={srsDoc} onChange={setSrsDoc}
                      project={activeProject} requirementId="SRS_DOC"
                      className="h-full border-none shadow-none rounded-none"
                    />
                  ) : (
                    <TiptapEditor
                      content={sddDoc} onChange={setSddDoc}
                      project={activeProject} requirementId="SDD_DOC"
                      className="h-full border-none shadow-none rounded-none"
                    />
                  )}
                </div>

                {/* TOC Sidebar */}
                {activeTab !== 'code' && activeTab !== 'requirements' && (
                  <div style={{
                    width: 200, borderLeft: `1px solid ${C.border}`,
                    background: C.bg, flexShrink: 0, overflowY: 'auto',
                    display: 'flex', flexDirection: 'column',
                  }}>
                    <div style={{
                      padding: '10px 16px 8px',
                      fontSize: 10, fontWeight: 700, color: C.textFaint,
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                      borderBottom: `1px solid ${C.border}`,
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}>
                      Contents
                    </div>
                    <TableOfContents doc={currentDoc} />
                  </div>
                )}
              </div>
            </div>

            {/* ── Terminal Panel ── */}
            {terminalOpen && (
              <div style={{
                width: 340, borderLeft: `1px solid ${C.border}`,
                background: C.surface, flexShrink: 0,
                display: 'flex', flexDirection: 'column',
                animation: 'fadeIn .2s ease',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      padding: '5px', borderRadius: 7,
                      background: isGenerating.srs || isGenerating.sdd ? C.accentLight : C.bg,
                      color: isGenerating.srs || isGenerating.sdd ? C.accent : C.textMuted,
                      display: 'flex',
                    }}>
                      {isGenerating.srs || isGenerating.sdd
                        ? <Activity size={13} style={{ animation: 'pulse 1.5s infinite' }} />
                        : <TerminalIcon size={13} />
                      }
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
                        {isGenerating.srs || isGenerating.sdd ? 'Generating…' : 'Console'}
                      </div>
                      <div style={{ fontSize: 10, color: C.textFaint }}>
                        {terminalOutput.length} entries
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setTerminalOutput(['$ archtech-sys --cleared'])} style={{
                      border: 'none', background: 'transparent', cursor: 'pointer',
                      padding: '4px 6px', borderRadius: 6, color: C.textFaint,
                      fontSize: 10, display: 'flex', alignItems: 'center', gap: 4,
                    }}
                      onMouseEnter={e => e.currentTarget.style.color = C.text}
                      onMouseLeave={e => e.currentTarget.style.color = C.textFaint}
                      title="Clear console"
                    >
                      <RefreshCw size={11} />
                    </button>
                    <button onClick={() => setTerminalOpen(false)} style={{
                      border: 'none', background: 'transparent', cursor: 'pointer',
                      padding: '4px 6px', borderRadius: 6, color: C.textFaint,
                      display: 'flex', alignItems: 'center',
                    }}
                      onMouseEnter={e => e.currentTarget.style.color = C.text}
                      onMouseLeave={e => e.currentTarget.style.color = C.textFaint}
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>

                <div
                  ref={terminalRef}
                  style={{
                    flex: 1, overflowY: 'auto', padding: '12px 16px',
                    background: '#fafafa',
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}
                >
                  {terminalOutput.map((line, i) => (
                    <TermLine key={i} line={line} idx={i} />
                  ))}
                </div>

                {/* Terminal Input Mock */}
                <div style={{
                  padding: '10px 16px', borderTop: `1px solid ${C.border}`,
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: C.surface,
                }}>
                  <span style={{ color: C.accent, fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>$</span>
                  <div style={{
                    flex: 1, fontSize: 12, color: C.textFaint,
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}>
                    Ready
                  </div>
                  <StatusDot active={isGenerating.srs || isGenerating.sdd || isCompiling} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}