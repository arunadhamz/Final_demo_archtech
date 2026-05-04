import { useEditor, EditorContent, NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { Plugin } from 'prosemirror-state';
import { BubbleMenu as BubbleMenuExtension } from '@tiptap/extension-bubble-menu';
import { StarterKit } from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import SlashCommands, { getSuggestionItems, renderItems } from './SlashCommands';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import debounce from 'lodash.debounce';
import { Markdown } from 'tiptap-markdown';
import { marked } from 'marked';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getApiUrl } from '../utils/apiConfig';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, Link as LinkIcon,
  Plus, Minus, Trash, Columns, Table as TableIcon, Copy, ArrowDown,
  CopyPlus, Repeat, Type, Heading1, Heading2, Heading3, List, ListOrdered,
  CheckSquare, Quote, GripVertical, Sparkles, FileText, Hash, Check,
} from 'lucide-react';

import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CharacterCount from '@tiptap/extension-character-count';
import Typography from '@tiptap/extension-typography';
import Focus from '@tiptap/extension-focus';
import CodeBlock from '@tiptap/extension-code-block';

// ─── Mermaid Node View ───────────────────────────────────────────────────────
const MermaidNodeView = ({ node, updateAttributes, extension }) => {
  const isMermaid = node.attrs.language === 'mermaid';
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  const [showCode, setShowCode] = useState(!isMermaid);
  const id = useRef(`mermaid-tiptap-${Math.random().toString(36).substr(2, 9)}`).current;
  
  const code = node.textContent;

  useEffect(() => {
    if (!isMermaid) return;
    let isCancelled = false;
    const renderDiagram = async () => {
      if (!window.mermaid) { setTimeout(renderDiagram, 300); return; }
      try {
        window.mermaid.initialize({ startOnLoad: false, theme: 'default' });
        const { svg: renderedSvg } = await window.mermaid.render(id, code);
        if (!isCancelled) { setSvg(renderedSvg); setError(''); }
      } catch (err) {
        if (!isCancelled) setError(err.message || 'Syntax Error');
      }
    };
    const timer = setTimeout(renderDiagram, 300); // debounce rendering slightly while typing
    return () => { isCancelled = true; clearTimeout(timer); };
  }, [code, isMermaid, id]);

  return (
    <NodeViewWrapper className={`code-block-wrapper my-4 relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 group ${isMermaid ? '' : 'p-4'}`}>
      {isMermaid && (
        <div contentEditable={false} className="mermaid-preview p-6 bg-white border-b border-slate-100 min-h-[100px] flex flex-col items-center justify-center relative">
          {error ? (
            <div className="text-red-500 text-xs font-mono p-4 bg-red-50 rounded-lg w-full whitespace-pre-wrap">{error}</div>
          ) : svg ? (
            <div dangerouslySetInnerHTML={{ __html: svg }} className="w-full flex justify-center" />
          ) : (
            <div className="text-slate-400 text-xs italic">Rendering diagram...</div>
          )}
          
          <button 
            className="absolute top-2 right-2 p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg text-[10px] font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => setShowCode(!showCode)}
          >
            {showCode ? 'Hide Code' : 'Edit Code'}
          </button>
        </div>
      )}
      
      <pre 
        style={{ display: (!isMermaid || showCode) ? 'block' : 'none' }}
        className={`m-0 text-sm font-mono text-slate-800 bg-slate-50 overflow-x-auto ${isMermaid ? 'p-4' : 'p-0'}`}
      >
        <NodeViewContent as="code" />
      </pre>
    </NodeViewWrapper>
  );
};

const MermaidCodeBlock = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(MermaidNodeView);
  },
});

// ─── BlockHoverPlugin ────────────────────────────────────────────────────────
// Tracks which top-level block the mouse is over and reports its
// VIEWPORT-relative rect so we can position the handle with `position:fixed`.
const BlockHoverPlugin = (onHover, hoveredBlockRef) =>
  new Plugin({
    props: {
      handleDOMEvents: {
        mousemove(view, event) {

          const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
          if (!pos) { 
            if (hoveredBlockRef.current) console.log('☁️ Hover: Out of bounds');
            onHover(null); 
            return false; 
          }

          try {
            const $pos = view.state.doc.resolve(pos.pos);
            let depth = 1;
            if ($pos.depth < 1) { onHover(null); return false; }

            const node = $pos.node(depth);
            const nodePos = $pos.before(depth);

            const validTypes = [
              'paragraph', 'heading', 'bulletList', 'orderedList',
              'taskList', 'blockquote', 'codeBlock', 'table', 'horizontalRule',
            ];
            if (!validTypes.includes(node.type.name)) { onHover(null); return false; }

            if (hoveredBlockRef.current?.pos !== nodePos) {
              console.log(`🎯 Hover: ${node.type.name} at pos ${nodePos}`);
            }

            const dom = view.nodeDOM(nodePos);
            if (!(dom instanceof HTMLElement)) { onHover(null); return false; }

            // Use viewport-relative rect — we'll use position:fixed for the handle
            const rect = dom.getBoundingClientRect();
            onHover({ pos: nodePos, node, rect });
          } catch (_) { onHover(null); }

          return false;
        },
        mouseleave(_view, _event) {
          // Don't clear on mouseleave — the handle itself triggers this
          // We clear via a short delay in the component instead
          return false;
        },
      },
    },
  });

// Uses position:absolute with coordinates relative to the editor container.
function BlockActions({ rect, containerRect, onPlusClick, onGripClick }) {
  const BUTTON_HEIGHT = 24;
  const top = (rect.top - containerRect.top) + 4;
  const left = (rect.left - containerRect.left) - 48;

  return (
    <div
      style={{
        position: 'absolute',
        top,
        left,
        width: 44,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        zIndex: 30,
        pointerEvents: 'auto',
      }}
    >
      {/* Plus — add block below */}
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onPlusClick();
        }}
        className="w-5 h-6 flex items-center justify-center rounded-md text-slate-300 hover:bg-slate-100 hover:text-slate-500 transition-all"
        title="Click to add a block below"
      >
        <Plus size={16} />
      </button>

      {/* Grip — click for context menu */}
      <div
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onGripClick(e);
        }}
        style={{
          width: 24, height: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 6,
          border: '1px solid #e2e8f0',
          background: '#fff',
          color: '#94a3b8',
          cursor: 'pointer',
          transition: 'all .15s',
          flexShrink: 0,
          userSelect: 'none',
        }}
        onMouseOver={(e) => { e.currentTarget.style.background = '#f0f4ff'; e.currentTarget.style.color = '#6366f1'; e.currentTarget.style.borderColor = '#c7d2fe'; }}
        onMouseOut={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
        title="Click for options"
      >
        <GripVertical size={13} />
      </div>
    </div>
  );
}

// ─── BlockContextMenu ────────────────────────────────────────────────────────
function BlockContextMenu({ position, containerRect, onClose, onAction }) {
  const ref = useRef(null);
  const [view, setView] = useState('main');

  const top = position.top - containerRect.top;
  const left = position.left - containerRect.left;

  useEffect(() => {
    const handler = (e) => {
      if (!ref.current?.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const mainItems = [
    { key: 'turnInto', icon: <Repeat size={13} />, label: 'Turn into…' },
    { key: 'duplicate', icon: <CopyPlus size={13} />, label: 'Duplicate block' },
    { key: 'copy', icon: <Copy size={13} />, label: 'Copy text' },
    { key: 'delete', icon: <Trash size={13} />, label: 'Delete block', danger: true },
  ];

  const turnIntoItems = [
    { key: 'paragraph', label: 'Text', icon: <Type size={13} /> },
    { key: 'heading 1', label: 'Heading 1', icon: <Heading1 size={13} /> },
    { key: 'heading 2', label: 'Heading 2', icon: <Heading2 size={13} /> },
    { key: 'heading 3', label: 'Heading 3', icon: <Heading3 size={13} /> },
    { key: 'bulletList', label: 'Bulleted List', icon: <List size={13} /> },
    { key: 'orderedList', label: 'Numbered List', icon: <ListOrdered size={13} /> },
    { key: 'taskList', label: 'To-do List', icon: <CheckSquare size={13} /> },
    { key: 'blockquote', label: 'Quote', icon: <Quote size={13} /> },
    { key: 'codeBlock', label: 'Code', icon: <Code size={13} /> },
  ];

  return (
    <div
      ref={ref}
      style={{ position: 'absolute', top, left, zIndex: 20 }}
      className="bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl w-52 py-1.5"
    >
      {view === 'main' ? (
        <div className="px-1.5 space-y-0.5">
          {mainItems.map((item) => (
            <button
              key={item.key}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (item.key === 'turnInto') { setView('turnInto'); return; }
                onAction(item.key);
                onClose();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-semibold transition-colors text-left ${item.danger
                ? 'text-rose-600 hover:bg-rose-50'
                : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
                }`}
            >
              <span className={item.danger ? 'text-rose-400' : 'text-slate-400'}>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.key === 'turnInto' && <span className="text-slate-300">›</span>}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2 mb-1">
            <button
              onMouseDown={(e) => { e.preventDefault(); setView('main'); }}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
            >
              <ArrowDown size={13} className="rotate-90" />
            </button>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Turn into</span>
          </div>
          <div className="px-1.5 space-y-0.5 max-h-64 overflow-y-auto">
            {turnIntoItems.map((opt) => (
              <button
                key={opt.key}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onAction(`turn-${opt.key}`);
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-semibold text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-left"
              >
                <span className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded-lg text-slate-400">
                  {opt.icon}
                </span>
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── AIPopover (Display Only) ──────────────────────────────────────────────
function AIPopover({ result, loading, onApply, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  if (!loading && !result) return null;

  return (
    <div
      ref={ref}
      className="w-80 flex flex-col bg-white/95 backdrop-blur-2xl border-l border-slate-200 shadow-xl animate-in slide-in-from-right-4 duration-500 fade-in"
    >
      <div className="p-6 border-b border-slate-100 bg-gradient-to-br from-blue-50/50 to-white">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
            <Sparkles size={20} />
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">✕</button>
        </div>
        <div>
          <span className="text-blue-600 font-black text-[9px] uppercase tracking-[0.3em] block mb-1">Intelligence Output</span>
          <h3 className="text-lg font-black text-slate-900 tracking-tight">Drafting Insight</h3>
        </div>
      </div>

      <div className="p-6 bg-slate-50/50 flex-1 overflow-y-auto">
        <div className="mb-4 p-4 bg-white rounded-2xl border border-slate-100 text-xs text-slate-700 leading-relaxed shadow-sm">
          {loading
            ? <div className="flex flex-col items-center justify-center py-4 gap-3 text-slate-400 font-bold uppercase tracking-widest text-[9px]">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                Synthesizing...
              </div>
            : <div className="prose prose-slate prose-xs max-w-none prose-p:text-slate-700 prose-p:leading-relaxed prose-table:border prose-table:border-slate-200 prose-th:bg-slate-100 prose-th:p-1 prose-td:p-1">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
              </div>}
        </div>
        {result && !loading && (
          <div className="flex flex-col gap-2">
            <button onClick={() => onApply(result)} className="w-full py-4 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95 flex items-center justify-center gap-2">
              <Check size={14} />
              Apply Improvements
            </button>
            <button onClick={onClose} className="w-full py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">Discard</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Editor ─────────────────────────────────────────────────────────────
export default function TiptapEditor({ content, onChange, className, project, requirementId }) {
  const debouncedOnChange = useMemo(() => debounce((val) => onChange(val), 300), [onChange]);

  const [focusMode, setFocusMode] = useState(false);
  const [hoveredBlock, setHoveredBlock] = useState(null); 
  const [ctxMenu, setCtxMenu] = useState(null); 
  const [showAiActions, setShowAiActions] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const hoveredBlockRef = useRef(null);
  const hoverClearTimer = useRef(null);
  const onHoverRef = useRef(null);

  useEffect(() => { hoveredBlockRef.current = hoveredBlock; }, [hoveredBlock]);

  const actions = [
    { key: 'improve', icon: '✨', label: 'Improve' },
    { key: 'expand', icon: '↔', label: 'Expand' },
    { key: 'shorten', icon: '↙', label: 'Shorten' },
    { key: 'formal', icon: '👔', label: 'Formal' },
    { key: 'casual', icon: '😊', label: 'Casual' },
    { key: 'fixspelling', icon: '🔤', label: 'Fix' },
  ];

  const PROMPTS = {
    improve: 'Improve the writing quality of the following text. Return ONLY the improved text:\n\n',
    expand: 'Expand the following text with more detail. Return ONLY the expanded text:\n\n',
    shorten: 'Make the following text shorter. Return ONLY the shortened text:\n\n',
    formal: 'Rewrite in a formal professional tone. Return ONLY the rewritten text:\n\n',
    casual: 'Rewrite in a friendly conversational tone. Return ONLY the rewritten text:\n\n',
    fixspelling: 'Fix all spelling and grammar errors. Return ONLY the corrected text:\n\n',
  };

  const runAI = async (key) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    if (!selectedText) return;

    setAiLoading(true);
    setAiResult('');
    try {
      const resp = await fetch(getApiUrl('/ai-insight'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'custom', 
          text: PROMPTS[key] + selectedText,
          project_id: project?.id,
          requirement_ids: [requirementId]
        }),
      });
      const data = await resp.json();
      setAiResult(data.result || data.insight || 'No response.');
    } catch {
      setAiResult('AI Error: Check backend connection.');
    } finally {
      setAiLoading(false);
    }
  };
  
  onHoverRef.current = (info) => {
    if (hoverClearTimer.current) {
      clearTimeout(hoverClearTimer.current);
      hoverClearTimer.current = null;
    }
    if (info) {
      setHoveredBlock(info);
    } else {
      hoverClearTimer.current = setTimeout(() => setHoveredBlock(null), 150);
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      MermaidCodeBlock,
      Placeholder.configure({ placeholder: 'Type "/" for commands…' }),
      BubbleMenuExtension,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      SlashCommands.configure({ suggestion: { items: getSuggestionItems, render: renderItems } }),
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CharacterCount,
      Typography,
      Focus.configure({ className: 'has-focus', mode: 'all' }),
      Markdown.configure({ transformPastedText: true, transformCopiedText: true }),
    ],
    content: marked.parse(content || ''),
    onUpdate: ({ editor }) => {
      debouncedOnChange(editor.storage.markdown.getMarkdown());
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-slate max-w-none focus:outline-none min-h-[120px] text-[16px] text-slate-900 font-medium leading-relaxed ' +
          'prose-table:border-collapse prose-table:border-slate-300 ' +
          'prose-td:border prose-td:border-slate-300 prose-td:p-2 ' +
          'prose-th:border prose-th:border-slate-300 prose-th:bg-slate-100 prose-th:p-2',
      },
    },
    onCreate({ editor }) {
      editor.registerPlugin(BlockHoverPlugin((info) => onHoverRef.current?.(info), hoveredBlockRef));
    },
  });

  useEffect(() => {
    if (editor && !editor.isFocused) {
      const cur = editor.storage.markdown.getMarkdown();
      if (content !== cur) editor.commands.setContent(marked.parse(content || ''), false);
    }
  }, [content, editor]);

  const handleCtxAction = useCallback((action) => {
    if (!ctxMenu || !editor) return;
    const { pos } = ctxMenu;
    const node = editor.state.doc.nodeAt(pos);
    if (!node) return;
    const { nodeSize, textContent } = node;

    switch (action) {
      case 'delete':
        editor.chain().focus().deleteRange({ from: pos, to: pos + nodeSize }).run();
        break;
      case 'duplicate':
        editor.chain().focus().insertContentAt(pos + nodeSize, node.toJSON()).run();
        break;
      case 'copy':
        navigator.clipboard.writeText(textContent);
        break;
      case 'turn-paragraph':
        editor.chain().focus().setTextSelection(pos + 1).setParagraph().run(); break;
      case 'turn-heading 1':
        editor.chain().focus().setTextSelection(pos + 1).toggleHeading({ level: 1 }).run(); break;
      case 'turn-heading 2':
        editor.chain().focus().setTextSelection(pos + 1).toggleHeading({ level: 2 }).run(); break;
      case 'turn-heading 3':
        editor.chain().focus().setTextSelection(pos + 1).toggleHeading({ level: 3 }).run(); break;
      case 'turn-bulletList':
        editor.chain().focus().setTextSelection(pos + 1).toggleBulletList().run(); break;
      case 'turn-orderedList':
        editor.chain().focus().setTextSelection(pos + 1).toggleOrderedList().run(); break;
      case 'turn-taskList':
        editor.chain().focus().setTextSelection(pos + 1).toggleTaskList().run(); break;
      case 'turn-blockquote':
        editor.chain().focus().setTextSelection(pos + 1).toggleBlockquote().run(); break;
      case 'turn-codeBlock':
        editor.chain().focus().setTextSelection(pos + 1).toggleCodeBlock().run(); break;
      default: break;
    }
  }, [ctxMenu, editor]);

  const exportMarkdown = () => {
    if (!editor) return;
    const md = editor.storage.markdown.getMarkdown();
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'export.md'; a.click();
    URL.revokeObjectURL(url);
  };

  const containerRef = useRef(null);

  return (
    <div
      ref={containerRef}
      data-editor-container
      className={`${className} relative group bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col transition-all z-0`}
    >
      {/* ── Toolbar ── */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-1.5 flex items-center justify-between text-xs opacity-0 group-hover:opacity-100 transition-opacity rounded-t-xl">
        <button
          onClick={() => setFocusMode((f) => !f)}
          className={`px-2 py-1 rounded-md font-semibold transition-all ${focusMode ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-white border border-transparent hover:border-slate-200'
            }`}
        >
          {focusMode ? 'Focus On' : 'Focus Off'}
        </button>
        <div className="flex items-center gap-2">
          <button onClick={exportMarkdown} className="flex items-center gap-1.5 px-2 py-1 text-slate-500 hover:text-indigo-600 font-semibold transition-all">
            <ArrowDown size={14} /> Export MD
          </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        ${focusMode ? `
          .has-focus { border-radius: 3px; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
          .ProseMirror > *:not(.has-focus) { opacity: 0.3; transition: opacity 0.3s; }
          .ProseMirror:hover > *:not(.has-focus) { opacity: 0.6; }
        ` : ''}
        .ProseMirror { padding: 8px 0; }
        .ProseMirror p { margin: 3px 0; }
        .ProseMirror > * + * { margin-top: 2px; }
        .ProseMirror-selectednode { outline: 2px solid #6366f1; background: rgba(99,102,241,.05); border-radius: 4px; }
        .ProseMirror p.is-editor-empty:first-child::before {
          color: #adb5bd; content: attr(data-placeholder);
          float: left; height: 0; pointer-events: none;
        }
        .scrollbar-pro::-webkit-scrollbar { width: 6px; }
        .scrollbar-pro::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-pro::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; transition: background 0.2s; }
        .scrollbar-pro::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      ` }} />

      <div className="flex-1 flex overflow-hidden min-h-[400px]">
        {/* ── Drafting Area ── */}
        <div className="flex-1 px-12 py-8 relative overflow-y-auto scrollbar-pro pr-2">
          {editor && (
            <BubbleMenu
              editor={editor}
              tippyOptions={{ duration: 150, placement: 'top-start' }}
              className="flex bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl p-1.5 shadow-2xl"
            >
              {editor.isActive('table') ? (
                <div className="flex items-center gap-1">
                  <BubbleBtn onClick={() => editor.chain().focus().addRowAfter().run()} title="Add row"><Plus size={15} /></BubbleBtn>
                  <BubbleBtn onClick={() => editor.chain().focus().deleteRow().run()} title="Delete row" danger><Minus size={15} /></BubbleBtn>
                  <BubbleSep />
                  <BubbleBtn onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add col"><Columns size={15} /></BubbleBtn>
                  <BubbleBtn onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete col" danger><Trash size={15} /></BubbleBtn>
                  <BubbleSep />
                  <BubbleBtn onClick={() => editor.chain().focus().deleteTable().run()} title="Delete table" danger><TableIcon size={15} /></BubbleBtn>
                </div>
              ) : (
                <div className="flex items-center gap-0.5">
                  <BubbleBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold"><Bold size={15} /></BubbleBtn>
                  <BubbleBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><Italic size={15} /></BubbleBtn>
                  <BubbleBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline"><UnderlineIcon size={15} /></BubbleBtn>
                  <BubbleBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strike"><Strikethrough size={15} /></BubbleBtn>
                  <BubbleSep />
                  <BubbleBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1"><Heading1 size={15} /></BubbleBtn>
                  <BubbleBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2"><Heading2 size={15} /></BubbleBtn>
                  <BubbleBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List"><List size={15} /></BubbleBtn>
                  <BubbleBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="Task List"><CheckSquare size={15} /></BubbleBtn>
                  <BubbleSep />
                  <BubbleBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline code"><Code size={15} /></BubbleBtn>
                  <BubbleSep />
                  <button
                    onClick={() => setShowAiActions(!showAiActions)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2 ml-1 ${
                      showAiActions ? 'bg-blue-50 text-blue-600 ring-2 ring-blue-500' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'
                    }`}
                  >
                    <Sparkles size={14} fill={showAiActions ? 'currentColor' : 'white'} />
                    Assistant
                  </button>
                  {showAiActions && (
                    <>
                      <BubbleSep />
                      <div className="flex items-center gap-1 animate-in slide-in-from-left-2 duration-300">
                        {actions.map(a => (
                          <button
                            key={a.key}
                            onClick={() => runAI(a.key)}
                            title={a.label}
                            className="p-2 rounded-lg hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition-colors flex items-center justify-center text-sm"
                          >
                            {a.icon}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </BubbleMenu>
          )}

          <EditorContent editor={editor} />
        </div>

        {/* ── AI Secondary Column ── */}
        {(aiLoading || aiResult) && (
          <AIPopover
            result={aiResult}
            loading={aiLoading}
            onClose={() => { setAiResult(''); setAiLoading(false); setShowAiActions(false); }}
            onApply={(result) => {
              editor.chain().focus().insertContent(result).run();
              setAiResult('');
              setAiLoading(false);
              setShowAiActions(false);
            }}
          />
        )}
      </div>

      {hoveredBlock && containerRef.current && (
        <BlockActions
          rect={hoveredBlock.rect}
          containerRect={containerRef.current.getBoundingClientRect()}
          onPlusClick={() => {
            if (!editor || !hoveredBlock) return;
            editor
              .chain()
              .focus()
              .insertContentAt(hoveredBlock.pos + hoveredBlock.node.nodeSize, { type: 'paragraph' })
              .run();
          }}
          onGripClick={(e) => {
            const hb = hoveredBlock;
            setCtxMenu({
              position: { top: hb.rect.top + 28, left: hb.rect.left - 48 },
              pos: hb.pos,
            });
          }}
        />
      )}

      {/* Context menu */}
      {ctxMenu && containerRef.current && (
        <BlockContextMenu
          position={ctxMenu.position}
          containerRect={containerRef.current.getBoundingClientRect()}
          onClose={() => { setCtxMenu(null); }}
          onAction={(action) => { handleCtxAction(action); }}
        />
      )}

      {/* Status Bar */}
      {editor && (
        <div className="absolute bottom-5 right-6 flex items-center gap-5 px-4 py-2 bg-white/95 backdrop-blur-xl border border-slate-200 shadow-xl rounded-2xl pointer-events-none select-none transition-all duration-300 transform hover:scale-105">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-indigo-600" />
            <div className="flex flex-col">
              <span className="text-[12px] font-black leading-none text-slate-900 tracking-tight">
                {editor.storage.characterCount.words()}
              </span>
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Words</span>
            </div>
          </div>

          <div className="w-px h-6 bg-slate-200" />

          <div className="flex items-center gap-2">
            <Hash size={14} className="text-indigo-600" />
            <div className="flex flex-col">
              <span className="text-[12px] font-mono font-bold leading-none text-slate-900 tracking-tighter">
                {(() => {
                  if (editor.isActive('table')) return 'TBL';
                  const { from } = editor.state.selection;
                  const text = editor.state.doc.textBetween(0, from, '\n');
                  const lines = text.split('\n');
                  return `${lines.length}:${lines[lines.length - 1].length + 1}`;
                })()}
              </span>
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Position</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────
function BubbleBtn({ onClick, active, danger, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-2 rounded-xl transition-all ${active ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
        : danger ? 'text-rose-400 hover:bg-rose-500/20'
          : 'text-slate-500 hover:bg-slate-100'
        }`}
    >
      {children}
    </button>
  );
}

function BubbleSep() {
  return <div className="w-px h-4 bg-slate-200 mx-0.5 flex-shrink-0" />;
}