import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import debounce from 'lodash.debounce';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, ArrowRight, ShieldCheck, Tag, FileUp, FileText, Sparkles, Send, ChevronLeft, ChevronRight, Copy, Check, Maximize2, X } from 'lucide-react';
import remarkGfm from 'remark-gfm';
import CustomSelect from '../components/ui/CustomSelect';
import { getApiUrl } from '../utils/apiConfig';
import TiptapEditor from '../components/TiptapEditor';

const getCategoryColor = (cat) => {
  const map = {
    'All': 'blue',
    'Hardware': 'blue',
    'Software': 'indigo',
    'Non-Functional': 'slate',
    'Clock': 'amber',
    'Memory': 'violet',
    'Optical': 'fuchsia',
    'Interface': 'sky',
    'Processor': 'rose',
    'Environmental': 'emerald',
    'Power': 'orange',
    'Safety': 'rose',
    'Firmware': 'teal',
    'Technical': 'violet',
    'Functional': 'blue',
    'System': 'indigo'
  };
  return map[cat] || 'slate';
};

// --- Sub-components for performance isolation ---

const AIInsightPanel = ({ reqId, reqText, summarizingId, handleAIInsight, onCancel }) => {
  const [insightAction, setInsightAction] = useState('summarize');
  const [localQuery, setLocalQuery] = useState('');

  return (
    <div className=" w-[600px] bg-blue-50/50 border border-blue-100 rounded-2xl p-5 mb-6 animate-in slide-in-from-top-2 duration-300">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">AI Command Center</span>
        <button 
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ArrowRight size={14} className="rotate-180" />
        </button>
      </div>
      
      <div className="flex flex-wrap gap-2 mb-4">
        {['summarize', 'rephrase', 'custom'].map((action) => (
          <button
            key={action}
            onClick={() => setInsightAction(action)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-tight transition-all ${
              insightAction === action 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {action}
          </button>
        ))}
      </div>

      {insightAction === 'custom' && (
        <div className="mb-4">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Custom Instruction</label>
          <div className="bg-white border border-blue-100 rounded-2xl overflow-hidden focus-within:border-blue-400 transition-colors shadow-sm">
            <TiptapEditor 
              content={localQuery}
              onChange={setLocalQuery}
              className="p-4 min-h-[100px]"
            />
          </div>
        </div>
      )}

      <button
        onClick={() => handleAIInsight(reqId, reqText, insightAction, localQuery)}
        disabled={summarizingId === reqId}
        className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
      >
        {summarizingId === reqId ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <Send size={14} />
        )}
        Generate AI Insight
      </button>
    </div>
  );
};

export default function RequirementListing({ project }) {
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [targetDoc, setTargetDoc] = useState('SyRS');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [summaries, setSummaries] = useState({}); // { reqId: [{ action, content, timestamp }] }
  const [activeInsightIndex, setActiveInsightIndex] = useState({}); // { reqId: index }
  const [showInsightId, setShowInsightId] = useState(null);
  const [summarizingId, setSummarizingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newReq, setNewReq] = useState({ id: '', text: '', type: 'Functional', source: 'Manual' });
  const [docType, setDocType] = useState('TechSpec');
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);
  const [filterCategory, setFilterCategory] = useState('All');
  const [progressData, setProgressData] = useState(null);
  const [aiPanelId, setAiPanelId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [fullViewId, setFullViewId] = useState(null);
  const itemsPerPage = 8;

  // Local states for metadata to avoid full re-renders on typing
  const [localNewReq, setLocalNewReq] = useState(newReq);

  const filteredRequirements = useMemo(() => {
    if (filterCategory === 'All') return requirements;
    return requirements.filter(r => (r.category || r.type) === filterCategory);
  }, [requirements, filterCategory]);

  const totalPages = Math.ceil(filteredRequirements.length / itemsPerPage);
  const paginatedRequirements = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRequirements.slice(start, start + itemsPerPage);
  }, [filteredRequirements, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterCategory]);

  // Debounced sync for AI Query
  const debouncedSetCustomQuery = useMemo(
    () => debounce((val) => setCustomQuery(val), 300),
    []
  );

  // Debounced sync for New Requirement
  const debouncedSetNewReq = useMemo(
    () => debounce((val) => setNewReq(val), 300),
    []
  );

  const listTopRef = useRef(null);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const loadReqs = async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl(`/requirements/${project.id}`));
      const data = await res.json();
      setRequirements(data);
    } catch (err) {
      console.error("Extraction mapping failure:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReqs();
  }, [project.id]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setProgressData({ status: 'starting', message: 'Initializing upload...' });

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(getApiUrl(`/extraction-progress/${project.id}`));
        const data = await res.json();
        setProgressData(data);
      } catch (err) {
        // ignore polling errors
      }
    }, 500);

    try {
      const data = new FormData();
      data.append('files', file);
      data.append('project_id', project.id);

      const response = await fetch(getApiUrl('/upload-requirements'), {
        method: 'POST',
        body: data,
      });

      if (!response.ok) throw new Error('Upload failed');
      await response.json();

      // Reload requirements after successful extraction
      await loadReqs();
    } catch (err) {
      console.error("Upload error:", err);
      alert("Failed to upload document.");
    } finally {
      clearInterval(pollInterval);
      setProgressData(null);
      setIsUploading(false);
    }
  };

  const handleProceed = () => {
    if (selectedIds.length === 0) {
      alert("Please select at least one requirement.");
      return;
    }
    let target = 'system';
    if (targetDoc === 'HRS') target = 'hardware';
    else if (targetDoc === 'SRS') target = 'software';
    navigate(`/workspace/${target}`);
  };

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

  const handleAddReq = () => {
    if (!newReq.id || !newReq.text) return alert("Please fill in ID and Requirement text.");
    setRequirements([newReq, ...requirements]);
    setNewReq({ id: '', text: '', type: 'Functional', source: 'Manual' });
    setShowAddForm(false);
  };

  const handleSaveEdit = async (id) => {
    try {
      const res = await fetch(getApiUrl('/update-requirement'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ req_id: id, text: editText, project_id: project.id })
      });
      if (res.ok) {
        setRequirements(requirements.map(r => r.id === id ? { ...r, text: editText } : r));
        setEditingId(null);
      } else {
        alert("Failed to save changes to backend.");
      }
    } catch (err) {
      console.error("Save error:", err);
      alert("Error connecting to server.");
    }
  };

  const handleAIInsight = async (reqId, text, action = 'summarize', query = '') => {
    setSummarizingId(reqId);
    try {
      const res = await fetch(getApiUrl('/ai-insight'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text, 
          action, 
          user_query: action === 'custom' ? query : null,
          project_id: project.id,
          requirement_ids: [reqId]
        })
      });
      const data = await res.json();
      const newInsight = {
        action: action === 'custom' ? `Custom: ${query}` : action,
        content: data.insight || 'Failed to parse AI insight.',
        timestamp: new Date().toLocaleTimeString()
      };
      
      setSummaries(prev => {
        const currentList = prev[reqId] || [];
        const updatedList = [...currentList, newInsight];
        
        setActiveInsightIndex(idxPrev => ({
          ...idxPrev,
          [reqId]: updatedList.length - 1
        }));
        
        return { ...prev, [reqId]: updatedList };
      });
      setShowInsightId(reqId); // Show the results sidebar

    } catch (e) {
      const errorInsight = { action: 'Error', content: 'Error: Could not connect to AI engine.', timestamp: new Date().toLocaleTimeString() };
      setSummaries(prev => ({ ...prev, [reqId]: [...(prev[reqId] || []), errorInsight] }));
    } finally {
      setSummarizingId(null);
      setAiPanelId(null); 
    }
  };

  const toggleInsightPanel = (reqId) => {
    if (aiPanelId === reqId) {
      setAiPanelId(null);
    } else {
      setAiPanelId(reqId);
    }
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleInsightResult = (reqId) => {
    if (showInsightId === reqId) {
      setShowInsightId(null);
    } else if (summaries[reqId]?.length > 0) {
      setShowInsightId(reqId);
    } else {
      toggleInsightPanel(reqId);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-400 font-bold">
        <ClipboardList className="animate-bounce text-blue-500 mb-4" size={36} />
        Extracting Document Schema...
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4">
      <style dangerouslySetInnerHTML={{ __html: `
        .scrollbar-pro::-webkit-scrollbar { width: 6px; }
        .scrollbar-pro::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-pro::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .scrollbar-pro::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}} />
      {/* High-Fidelity Upload Command Bar */}
      <div className="bg-gradient-to-br from-white to-blue-50/30 p-8 border border-blue-100/50 rounded-[32px] shadow-xl shadow-blue-50/50 flex items-center justify-between relative z-50 group/upload">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-100/20 rounded-full blur-3xl -mr-32 -mt-32 transition-transform group-hover/upload:scale-110 duration-1000" />
        
        <div className="relative z-10" ref={listTopRef}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
              <FileUp size={16} className="text-white" />
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Source Specifications</h3>
          </div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-11">Ingest technical documents for AI extraction</p>
        </div>

        <div className="flex items-center gap-5 relative z-10">
          {isUploading && (
            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-blue-600 bg-white/80 backdrop-blur-md border border-blue-100 px-4 py-2.5 rounded-2xl shadow-sm animate-pulse">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              {progressData ? progressData.message : 'Extracting Context...'}
            </div>
          )}
          <div className="w-72">
            <CustomSelect
              value={docType}
              onChange={setDocType}
              options={[
                { label: 'Technical Specification (Full Chain)', value: 'TechSpec' },
                { label: 'System Requirements (SyRS)', value: 'SyRS' },
                { label: 'Hardware Requirements (HRS)', value: 'HRS' }
              ]}
              className="z-20"
            />
          </div>
          <label className="flex items-center gap-3 px-8 py-4 bg-slate-900 hover:bg-blue-600 text-white font-black uppercase tracking-widest rounded-2xl text-[11px] transition-all cursor-pointer shadow-2xl shadow-slate-200 hover:shadow-blue-200 hover:-translate-y-0.5 active:scale-95 group/btn">
            <FileUp size={18} className="group-hover/btn:animate-bounce" />
            Upload Document
            <input
              type="file"
              className="hidden"
              accept=".pdf,.docx,.odt,.txt,.md"
              onChange={handleFileUpload}
              disabled={isUploading}
            />
          </label>
        </div>
      </div>

      <header className="flex justify-between items-center bg-white p-8 border border-slate-100 rounded-[32px] shadow-xl relative z-40 group/header">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-blue-600 font-black text-[10px] uppercase tracking-[0.3em] bg-blue-50 px-3 py-1 rounded-full border border-blue-100">Parsing Layer Live</span>
            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Extracted Requirements</h2>
          {/* <div className="flex items-center gap-4">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-4 py-1.5 rounded-xl border border-slate-100 flex items-center gap-3">
              Visible Selection: <span className="text-blue-600 text-sm font-black">{selectedIds.length}</span> <div className="w-px h-3 bg-slate-200" /> <span className="text-slate-900">{requirements.length} Total</span>
            </div>
          </div> */}
        </div>
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-4 py-1.5 rounded-xl border border-slate-100 flex items-center gap-3">
              Visible Selection: <span className="text-blue-600 text-sm font-black">{selectedIds.length}</span> <div className="w-px h-3 bg-slate-200" /> <span className="text-slate-900">{requirements.length} Total</span>
            </div>
          </div>
          {/* <div className="flex flex-col gap-1 items-end mr-2">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Synthesis Target</span>
            <CustomSelect
              value={targetDoc}
              onChange={setTargetDoc}
              options={[
                { label: 'Generate SyRS (System)', value: 'SyRS' },
                { label: 'Generate HRS (Hardware)', value: 'HRS' },
                { label: 'Generate SRS (Software)', value: 'SRS' }
              ]}
              className="w-64 z-20"
            />
          </div> */}
          {/* <button
            onClick={() => setShowAddForm(!showAddForm)}
            className={`px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
              showAddForm 
                ? 'bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100' 
                : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/30 shadow-sm'
            }`}
          >
            {showAddForm ? <X size={16} /> : <FileText size={16} />}
            {showAddForm ? 'Cancel' : 'Manual Entry'}
          </button> */}
          {/* <button
            onClick={handleProceed}
            className="px-8 py-4 bg-slate-900 hover:bg-blue-600 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl flex items-center gap-3 group transition-all shadow-2xl shadow-slate-200 hover:shadow-blue-200 hover:-translate-y-0.5 active:scale-95"
          >
            Start Synthesis
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button> */}
        </div>
      </header>


      {/* High-Fidelity Manual Ingestion strip */}
      {showAddForm && (
        <div className="bg-gradient-to-br from-blue-50/40 to-white border border-blue-100/50 rounded-[32px] p-8 shadow-xl shadow-blue-50/30 animate-in slide-in-from-top-4 duration-500 relative z-30 group/add">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-100">
              <ClipboardList size={16} className="text-white" />
            </div>
            <div>
              <span className="text-blue-600 font-black text-[9px] uppercase tracking-[0.3em] block leading-none mb-1">Manual Entry Layer</span>
              <h4 className="text-lg font-black text-slate-900 tracking-tight">Draft New Requirement</h4>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-6 items-end relative z-10">
            <div className="col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">ID Specification</label>
              <input
                type="text"
                placeholder="SYR-001"
                className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                value={localNewReq.id}
                onChange={e => {
                  const val = e.target.value;
                  setLocalNewReq(prev => ({ ...prev, id: val }));
                  debouncedSetNewReq({ ...localNewReq, id: val });
                }}
              />
            </div>
            <div className="col-span-6">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Requirement Description</label>
              <input
                type="text"
                placeholder="Describe the technical requirement..."
                className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                value={localNewReq.text}
                onChange={e => {
                  const val = e.target.value;
                  setLocalNewReq(prev => ({ ...prev, text: val }));
                  debouncedSetNewReq({ ...localNewReq, text: val });
                }}
              />
            </div>
            <div className="col-span-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Classification</label>
              <CustomSelect
                value={newReq.type}
                onChange={val => setNewReq({ ...newReq, type: val })}
                options={[
                  { label: 'Functional Requirement', value: 'Functional' },
                  { label: 'Hardware Requirement (HRS)', value: 'Hardware' },
                  { label: 'Software Requirement (SRS)', value: 'Software' }
                ]}
                className="w-full z-20"
              />
            </div>
            <div className="col-span-1">
              <button
                onClick={handleAddReq}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:shadow-blue-200 transition-all active:scale-95"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Filter Navigation Bar */}
      <div className="flex items-center gap-4 mb-6 relative z-20">
        <div className="bg-slate-100/50 p-1.5 rounded-[22px] flex flex-wrap gap-1 border border-slate-200/60 shadow-inner">
          <div className="px-4 py-2 flex items-center gap-2 text-slate-400">
            <Tag size={14} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Filter</span>
          </div>
          {['All', ...new Set(requirements.map(r => r.category || r.type).filter(Boolean))].map(cat => {
            const color = getCategoryColor(cat);
            const isActive = filterCategory === cat;
            
            // Map color string to tailwind classes
            const colorClasses = {
              blue: 'bg-blue-600 text-white shadow-blue-200 border-blue-500',
              indigo: 'bg-indigo-600 text-white shadow-indigo-200 border-indigo-500',
              emerald: 'bg-emerald-600 text-white shadow-emerald-200 border-emerald-500',
              rose: 'bg-rose-600 text-white shadow-rose-200 border-rose-500',
              amber: 'bg-amber-500 text-white shadow-amber-200 border-amber-400',
              teal: 'bg-teal-600 text-white shadow-teal-200 border-teal-500',
              orange: 'bg-orange-600 text-white shadow-orange-200 border-orange-500',
              violet: 'bg-violet-600 text-white shadow-violet-200 border-violet-500',
              sky: 'bg-sky-600 text-white shadow-sky-200 border-sky-500',
              fuchsia: 'bg-fuchsia-600 text-white shadow-fuchsia-200 border-fuchsia-500',
              slate: 'bg-slate-700 text-white shadow-slate-200 border-slate-600'
            }[color];

            return (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-5 py-2 rounded-[18px] text-[11px] font-black uppercase tracking-widest transition-all duration-300 border ${isActive
                    ? `${colorClasses} shadow-lg scale-105 z-10`
                    : 'bg-transparent text-slate-500 hover:text-slate-800 hover:bg-white/40 border-transparent'
                  }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm">
        <div className="px-8 py-5 bg-gradient-to-r from-blue-50/40 via-white to-indigo-50/40 border-b border-blue-100/50 flex items-center justify-between relative overflow-hidden group/bar">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500 opacity-70" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
              <ShieldCheck size={20} className="text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-[12px] font-black text-blue-500 uppercase tracking-[0.3em] leading-none mb-2 ">System Intelligence</span>
              <div className="flex items-center gap-4">
                <div className="bg-slate-100/80 border border-slate-200/60 rounded-full px-6 py-2.5 flex items-center gap-4 shadow-inner group/capsule hover:bg-slate-100 transition-colors">
                  <span className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-400">Total Extracted:</span>
                  <span className="text-2xl font-black text-slate-900 leading-none">{requirements.length}</span>
                </div>
                {filterCategory !== 'All' && (
                  <span className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-full text-[14px] font-black uppercase tracking-wider shadow-lg shadow-blue-100 animate-in slide-in-from-left-2 duration-300">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    {filterCategory}: {filteredRequirements.length}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 relative z-10">
            <label className="flex items-center gap-3 cursor-pointer px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-blue-200 transition-all select-none active:scale-95 group/select">
              <input
                type="checkbox"
                checked={filteredRequirements.length > 0 && filteredRequirements.every(r => selectedIds.includes(r.id))}
                onChange={toggleSelectAll}
                className="rounded-lg border-slate-300 text-blue-600 focus:ring-blue-200 cursor-pointer w-4 h-4 transition-transform group-hover/select:scale-110"
              />
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest group-hover/select:text-blue-600 transition-colors">Select All</span>
            </label>
          </div>
        </div>

        {requirements.length === 0 ? (
          <div className="p-20 text-center text-slate-500 font-medium text-lg">
            No requirements detected. Verify document formatting.
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100">
              {paginatedRequirements.map((req, idx) => (
              <div key={req.id || idx} className="p-8 hover:bg-slate-50/80 transition-all flex items-start gap-8 group">
                <div className="flex items-center mt-1.5">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(req.id)}
                    onChange={() => toggleSelect(req.id)}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-200 cursor-pointer"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  {/* 1. Meta Header: ID, Category, Priority, Confidence */}
                  <div className="flex flex-wrap items-center gap-3 mb-5">
                    <div className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm select-none flex items-center gap-2">
                      {req.id}
                      <button 
                        onClick={(e) => { e.stopPropagation(); setFullViewId(req.id); }}
                        className="ml-1 text-slate-400 hover:text-blue-600 transition-colors"
                        title="Full Reading View"
                      >
                        <Maximize2 size={12} />
                      </button>
                    </div>

                    {req.category && (
                      <span className="text-[11px] font-black uppercase tracking-widest text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                        {req.category} / {req.sub_category || 'General'}
                      </span>
                    )}

                    {req.priority && (
                      <span className={`text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border ${req.priority === 'High'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                        {req.priority} Priority
                      </span>
                    )}

                    {req.confidence && (
                      <div className="ml-auto flex items-center gap-3">
                        <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden hidden sm:block">
                          <div
                            className="h-full bg-emerald-500 transition-all duration-1000"
                            style={{ width: `${Math.round(req.confidence * 100)}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-extrabold text-slate-500">
                          {Math.round(req.confidence * 100)}% Match
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 2. Requirement Text - TipTap Notion-like Editor */}
                  <div className="relative group">
                    {editingId === req.id ? (
                      <div className="space-y-4 mb-6">
                        <div className="relative bg-blue-50/30 border-l-4 border-blue-500 pl-8 py-4 rounded-r-2xl ring-1 ring-blue-100 shadow-xl shadow-blue-50/50 transition-all duration-500 animate-in fade-in zoom-in-95">
                          <TiptapEditor 
                            content={editText}
                            onChange={setEditText}
                            className="w-full"
                            project={project}
                            requirementId={req.id}
                          />
                          <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg shadow-blue-200 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                            Active Drafting
                          </div>
                        </div>
                        <div className="bg-slate-50/80 backdrop-blur-sm p-8 rounded-[32px] border border-slate-200/60 shadow-inner animate-in fade-in slide-in-from-top-2 duration-500">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="h-[1px] flex-1 bg-slate-200" />
                            <div className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-100 rounded-full shadow-sm">
                              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Production Preview</span>
                            </div>
                            <div className="h-[1px] flex-1 bg-slate-200" />
                          </div>
                          <div className="prose prose-slate max-w-none prose-p:text-slate-700 prose-p:text-[15px] prose-p:font-medium prose-table:border prose-table:border-slate-200 prose-th:bg-slate-100 prose-th:p-2 prose-td:p-2 max-h-[300px] overflow-y-auto scrollbar-pro pr-2">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{editText}</ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="prose prose-slate max-w-none prose-p:text-slate-900 prose-p:text-[15px] prose-p:font-medium prose-p:leading-relaxed mb-6 bg-white border border-slate-200/60 shadow-sm rounded-[12px] p-8 hover:border-blue-200 hover:bg-blue-50/5 hover:shadow-xl hover:shadow-blue-50/50 transition-all duration-300 cursor-text border-l-[3px] border-l-slate-100 hover:border-l-blue-500 max-h-[450px] overflow-y-auto scrollbar-pro group/block"
                        onClick={() => { setEditingId(req.id); setEditText(req.text); }}
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{req.text}</ReactMarkdown>
                      </div>
                    )}
                  </div>

                  {/* 3. AI Insight Panel - Optimized via Component Isolation */}
                  {aiPanelId === req.id && (
                    <AIInsightPanel 
                      reqId={req.id}
                      reqText={req.text}
                      summarizingId={summarizingId}
                      handleAIInsight={handleAIInsight}
                      onCancel={() => setAiPanelId(null)}
                    />
                  )}

                  {/* 4. Keywords Tags */}
                  {req.keywords && req.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-6">
                      {req.keywords.slice(0, 8).map(kw => (
                        <span key={kw} className="text-[10px] font-extrabold text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm hover:border-slate-300 hover:text-slate-900 transition-colors cursor-default">
                          #{kw.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 5. Footer: Actions & Traceability */}
                  <div className="flex items-center justify-between pt-5 border-t border-slate-100">
                    <div className="flex items-center gap-5 text-slate-500">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-blue-600" />
                        <span className="text-[11px] font-bold uppercase tracking-tight truncate max-w-fit bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 text-transparent">
                          {req.source || 'Manual Entry'}
                        </span>
                      </div>
                      {req.page && (
                        <div className="flex items-center gap-2 bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 text-transparent">
                          <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
                          <span className="text-[11px] font-bold uppercase tracking-tight">Page - {req.page}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      {editingId === req.id ? (
                        <button
                          onClick={() => handleSaveEdit(req.id)}
                          className="text-[12px] font-black text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors shadow-md shadow-blue-200"
                        >
                          Save Changes
                        </button>
                      ) : (
                        <button
                          onClick={() => { setEditingId(req.id); setEditText(req.text); }}
                          className="text-[12px] font-black text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100 px-4 py-2 rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                      )}
                      <button
                        onClick={() => toggleInsightResult(req.id)}
                        className={`text-[12px] font-black transition-all flex items-center gap-2 px-4 py-2 rounded-lg ${summaries[req.id]?.length > 0 || aiPanelId === req.id
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                            : 'text-blue-600 bg-blue-50 hover:bg-blue-100 hover:text-blue-700 border border-blue-100'
                          }`}
                      >
                        {summarizingId === req.id ? (
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Sparkles size={14} />
                        )}
                        {summaries[req.id]?.length > 0 ? `Insights (${summaries[req.id].length})` : (aiPanelId === req.id ? 'Cancel AI' : 'AI Insight')}
                      </button>
                    </div>
                  </div>
                </div>

                {/* AI Summary Sidebar - Enhanced with versioning (Light Theme) */}
                {showInsightId === req.id && summaries[req.id]?.length > 0 && (
                  <div className="w-1/3 bg-indigo-50/50 border border-indigo-100 text-slate-800 p-6 rounded-[24px] text-xs font-medium leading-relaxed shadow-2xl animate-in fade-in slide-in-from-right-4 duration-300 relative overflow-hidden flex flex-col">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                      <ShieldCheck size={80} className="text-indigo-600" />
                    </div>
                    
                    {/* Version Navigation */}
                    <div className="flex items-center justify-between mb-4 border-b border-indigo-100 pb-3">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <button 
                            disabled={(activeInsightIndex[req.id] || 0) === 0}
                            onClick={() => setActiveInsightIndex(prev => ({ ...prev, [req.id]: (prev[req.id] || 0) - 1 }))}
                            className="p-1 hover:bg-indigo-100 rounded-md disabled:opacity-20 transition-all text-indigo-600"
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <span className="font-black text-[11px] text-indigo-700 bg-indigo-100/50 px-2 py-0.5 rounded-full tabular-nums">
                            { (activeInsightIndex[req.id] || 0) + 1 } / { summaries[req.id].length }
                          </span>
                          <button 
                            disabled={(activeInsightIndex[req.id] || 0) === summaries[req.id].length - 1}
                            onClick={() => setActiveInsightIndex(prev => ({ ...prev, [req.id]: (prev[req.id] || 0) + 1 }))}
                            className="p-1 hover:bg-indigo-100 rounded-md disabled:opacity-20 transition-all text-indigo-600"
                          >
                            <ChevronRight size={14} />
                          </button>
                        </div>
                        <span className="text-[9px] text-slate-400 font-bold uppercase mt-1.5 ml-1">
                          { summaries[req.id][activeInsightIndex[req.id] || 0]?.action } • { summaries[req.id][activeInsightIndex[req.id] || 0]?.timestamp }
                        </span>
                      </div>

                      <div className="flex items-center z-10">
                        <button 
                          onClick={() => handleCopy(summaries[req.id][activeInsightIndex[req.id] || 0]?.content, req.id)}
                          className="p-2 hover:bg-indigo-100 rounded-xl transition-all text-indigo-600"
                          title="Copy to clipboard"
                        >
                          {copiedId === req.id ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="relative z-10 text-slate-700 flex-1 overflow-y-auto max-h-[600px] scrollbar-hide prose prose-indigo max-w-none prose-table:text-[10px] prose-table:leading-tight prose-th:p-1 prose-td:p-1 prose-table:border prose-table:border-indigo-100 prose-th:bg-indigo-100/30">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {summaries[req.id][activeInsightIndex[req.id] || 0]?.content}
                      </ReactMarkdown>
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-indigo-100 pt-5">
                      <button 
                        onClick={() => toggleInsightPanel(req.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-md shadow-indigo-100 group"
                      >
                        <Sparkles size={12} className="group-hover:rotate-12 transition-transform" />
                        New Command
                      </button>
                      <button 
                        onClick={() => toggleInsightResult(req.id)}
                        className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-md shadow-rose-100"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft size={16} />
                </button>
                
                {[...Array(totalPages)].map((_, i) => {
                  const p = i + 1;
                  // Only show current, first, last, and neighbors
                  if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
                    return (
                      <button
                        key={p}
                        onClick={() => handlePageChange(p)}
                        className={`w-9 h-9 rounded-xl text-[11px] font-black transition-all ${
                          currentPage === p 
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                            : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  }
                  if (p === currentPage - 2 || p === currentPage + 2) return <span key={p} className="px-1 text-slate-300">...</span>;
                  return null;
                })}

                <button
                  disabled={currentPage === totalPages}
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            )}
          </>
        )}
      </div>

      {/* Full Reading View Modal */}
      {fullViewId && (() => {
        const req = requirements.find(r => r.id === fullViewId);
        if (!req) return null;
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-20 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
            <div className="relative w-full max-w-5xl h-full max-h-[90vh] bg-white rounded-[40px] shadow-2xl flex flex-col overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
              {/* Header */}
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="font-mono text-sm font-black text-blue-600 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 shadow-sm">
                    {req.id}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">Requirement Source</span>
                    <span className="text-xs font-bold text-slate-600">{req.category || req.type} Specification</span>
                  </div>
                </div>
                <button 
                  onClick={() => setFullViewId(null)}
                  className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-100 rounded-2xl transition-all shadow-sm hover:shadow-md active:scale-95"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-12 scrollbar-pro">
                <div className="prose prose-slate max-w-none prose-p:text-slate-800 prose-p:text-[18px] prose-p:leading-relaxed prose-headings:text-slate-900 prose-headings:font-black prose-table:border prose-table:border-slate-200 prose-th:bg-slate-50 prose-th:p-4 prose-td:p-4 prose-blockquote:border-l-blue-500 prose-blockquote:bg-blue-50/50 prose-blockquote:p-6 prose-blockquote:rounded-r-2xl">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{req.text}</ReactMarkdown>
                </div>
              </div>

              {/* Footer Meta */}
              <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Confidence Score</span>
                    <span className="text-xs font-bold text-emerald-600">{Math.round(req.confidence * 100)}% Extraction Match</span>
                  </div>
                  <div className="w-px h-8 bg-slate-200" />
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Last Updated</span>
                    <span className="text-xs font-bold text-slate-600">{new Date().toLocaleDateString()}</span>
                  </div>
                </div>
                <button 
                  onClick={() => { 
                    navigator.clipboard.writeText(req.text); 
                    setCopiedId(req.id);
                    setTimeout(() => setCopiedId(null), 2000);
                  }}
                  className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2 ${
                    copiedId === req.id 
                      ? 'bg-emerald-600 text-white shadow-emerald-100' 
                      : 'bg-slate-900 text-white shadow-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {copiedId === req.id ? (
                    <>
                      <Check size={14} /> Copied to Clipboard
                    </>
                  ) : (
                    <>
                      <Copy size={14} /> Copy Source Text
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
