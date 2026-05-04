import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  FolderTree, FileCode, Play, Terminal as TerminalIcon,
  ChevronRight, ChevronDown, Download, Zap, Activity,
  Maximize2, Minimize2, FileText, Folder, FolderOpen,
  X, ChevronUp, Circle, CheckCircle2, AlertTriangle,
  LayoutTemplate, Code2, BookOpen, Cpu, Hash, ArrowRight,
  RefreshCw, PanelRightClose, PanelRightOpen, Sparkles,
} from 'lucide-react';
import Editor from '@monaco-editor/react';
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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function HardwareWorkspace({ project: activeProject }) {
  const { hrsDoc, setHrsDoc, schemaDoc, setSchemaDoc, isGenerating, setIsGenerating } = useOutletContext();
  const [activeTab, setActiveTab] = useState('hrs');
  const [isCompiling, setIsCompiling] = useState(false);
  const [exportFormat, setExportFormat] = useState('md');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 1 });
  const terminalRef = useRef(null);

  const [codeFiles, setCodeFiles] = useState({
    'hardware/bom/bom_list.txt': `PCB Revision: 1.2\nMain Controller: ARM Cortex-M7\nPower Regulation: TI-LM2596\nStorage: 128MB Flash`,
    'hardware/firmware/bootloader.c': `/* Low-level Hardware Initialization */\n#include "hw_map.h"\n\nvoid hw_init_clocks(void) {\n    /* Clock configuration for hardware modules */\n}`,
    'hardware/firmware/Makefile': `CC=arm-none-eabi-gcc\nall: bootloader.bin`,
    'hardware/schematics/layout_v1.md': `# PCB Layout Specifications\n\nDimensions: 100x80mm\nLayers: 4 Layers\nMaterial: FR-4 Standard`,
  });
  const [activeFile, setActiveFile] = useState('hardware/firmware/bootloader.c');
  const [terminalOutput, setTerminalOutput] = useState([
    '$ archtech-sys --v3-engine initialized',
    '[INFO] Hardware Workspace ready. Select a tab to begin.',
  ]);

  const fileTree = (() => {
    const root = { name: 'ArchTech_Hardware', type: 'dir', children: [] };
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
    if (isGenerating.hrs || isGenerating.schema) setTerminalOpen(true);
  }, [isGenerating]);

  const handleGenerateDoc = async (type) => {
    setIsGenerating(prev => ({ ...prev, hrs: type === 'HRS', schema: type !== 'HRS' }));
    if (type === 'HRS') setHrsDoc(''); else setSchemaDoc('');
    try {
      setTerminalOutput(prev => [...prev, `$ Generating ${type} document...`]);
      const res = await fetch(getApiUrl('/generate-document-stream'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirement_ids: activeProject?.reqIds || [], template_type: type }),
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
                if (type === 'HRS') setHrsDoc(prev => prev ? prev + '\n\n' + data.content : data.content);
                else setSchemaDoc(prev => prev ? prev + '\n\n' + data.content : data.content);
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
      setIsGenerating(prev => ({ ...prev, hrs: false, schema: false }));
    }
  };

  const handleCompile = () => {
    setIsCompiling(true);
    setTerminalOutput(prev => [...prev, `$ Verifying hardware firmware: ${activeFile}...`]);
    setTimeout(() => {
      setTerminalOutput(prev => [...prev, 'Firmware binary compiled successfully. No hardware conflicts found.']);
      setIsCompiling(false);
    }, 1400);
  };

  const handleExport = async () => {
    const content = activeTab === 'hrs' ? hrsDoc : activeTab === 'sch' ? schemaDoc : codeFiles[activeFile];
    if (exportFormat === 'odt') {
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
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      Object.assign(document.createElement('a'), { href: url, download: `export_${activeTab}.${exportFormat}` }).click();
    }
  };

  const isGenActive = activeTab === 'hrs' ? isGenerating.hrs : isGenerating.schema;
  const currentDoc = activeTab === 'hrs' ? hrsDoc : schemaDoc;

  const TABS = [
    { id: 'hrs', label: 'HRS Document', icon: <BookOpen size={13} /> },
    { id: 'sch', label: 'Schematics', icon: <LayoutTemplate size={13} /> },
    { id: 'code', label: 'Firmware', icon: <Cpu size={13} /> },
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
              title="Assets"
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
                    t.id === 'hrs' && isGenerating.hrs ? 'live'
                    : t.id === 'sch' && isGenerating.sch ? 'live'
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
                }} title="Show hardware tree">
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
                <StatusDot active={isGenerating.hrs || isGenerating.sch || isCompiling} />
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
                      ? <><RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> Building…</>
                      : <><Play size={12} /> Build Firmware</>
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
                <div style={{ flex: 1, overflow: 'hidden' }}>
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
                  ) : activeTab === 'hrs' ? (
                    <TiptapEditor
                      content={hrsDoc} onChange={setHrsDoc}
                      project={activeProject} requirementId="HRS_DOC"
                      className="h-full border-none shadow-none rounded-none"
                    />
                  ) : (
                    <TiptapEditor
                      content={schemaDoc} onChange={setSchemaDoc}
                      project={activeProject} requirementId="SCH_DOC"
                      className="h-full border-none shadow-none rounded-none"
                    />
                  )}
                </div>

                {/* TOC Sidebar */}
                {activeTab !== 'code' && (
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
                      background: isGenerating.hrs || isGenerating.schema ? C.accentLight : C.bg,
                      color: isGenerating.hrs || isGenerating.schema ? C.accent : C.textMuted,
                      display: 'flex',
                    }}>
                      {isGenerating.hrs || isGenerating.schema
                        ? <Activity size={13} style={{ animation: 'pulse 1.5s infinite' }} />
                        : <TerminalIcon size={13} />
                      }
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
                        {isGenerating.hrs || isGenerating.schema ? 'Generating…' : 'Console'}
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
                  <StatusDot active={isGenerating.hrs || isGenerating.schema || isCompiling} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
