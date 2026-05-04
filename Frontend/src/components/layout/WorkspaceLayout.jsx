import React, { useState } from 'react';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { 
  BarChart3, 
  Cpu, 
  Code2, 
  Settings, 
  ChevronRight, 
  FileText, 
  LogOut,
  Layers,
  Bell,
  Search,
  Database
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function WorkspaceLayout({ project }) {
  const { workspaceType } = useParams();

  // Lifted parallel document states
  const [syrsDoc, setSyrsDoc] = useState('# System Requirements Specification (SyRS)\n\nGenerated template for SyRS.');
  const [archDoc, setArchDoc] = useState('# System Architecture Description\n\nGenerated template for Architecture.');
  const [hrsDoc, setHrsDoc] = useState('# Hardware Requirements Specification (HRS)\n\nGenerated template for HRS.');
  const [schemaDoc, setSchemaDoc] = useState('# Hardware Schematics Baseline\n\nGenerated template for Schematics.');
  const [srsDoc, setSrsDoc] = useState('# Software Requirements Specification (SRS)\n\nGenerated template for SRS.');
  const [sddDoc, setSddDoc] = useState('# Software Design Description (SDD)\n\nGenerated template for SDD.');

  const [isGenerating, setIsGenerating] = useState({ syrs: false, arch: false, hrs: false, schema: false, srs: false, sdd: false });

  const workspaceNames = {
    requirements: 'Requirements Dashboard',
    system: 'System Architecture Workspace',
    hardware: 'Hardware Requirements Specification (HRS)',
    software: 'Software Requirements & Code Suite',
    traceability: 'Bi-Traceability Workspace',
    knowledge: 'Central Intelligence Knowledge Base'
  };

  const navItems = [
    { id: 'requirements', label: 'Requirements List', icon: FileText, path: '/workspace/requirements', color: 'bg-amber-100 text-amber-600' },
    { id: 'knowledge', label: 'RAG Knowledge Base', icon: Database, path: '/workspace/knowledge', color: 'bg-rose-100 text-rose-600' },
    { id: 'system', label: 'System Architecture', icon: Layers, path: '/workspace/system', color: 'bg-blue-100 text-blue-600' },
    { id: 'hardware', label: 'Hardware HRS', icon: Cpu, path: '/workspace/hardware', color: 'bg-indigo-100 text-indigo-600' },
    { id: 'software', label: 'Software SRS/SDD', icon: Code2, path: '/workspace/software', color: 'bg-violet-100 text-violet-600' },
    { id: 'traceability', label: 'Bi-Traceability', icon: BarChart3, path: '/workspace/traceability', color: 'bg-emerald-100 text-emerald-600' },
  ];

  return (
    <div className="app-container">
      {/* Premium Sidebar */}
      <aside className="sidebar">
        <div className="logo-container">
          <div className="logo-box">A</div>
          <div className="flex flex-col">
            <span className="font-extrabold text-lg tracking-tighter text-slate-900 leading-tight">ArchTech AI</span>
            <span className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-400">Systems Core</span>
          </div>
        </div>

        <div className="nav-group">
          <p className="nav-label">Domains / Workspaces</p>
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <div className={`p-2 rounded-lg ${item.color}`}>
                <item.icon size={18} />
              </div>
              <span className="flex-1">{item.label}</span>
              <ChevronRight size={14} className="opacity-40" />
            </NavLink>
          ))}
        </div>

        <div className="mt-auto">
          <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm mb-6">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">Authenticated Session</p>
            <div className="font-bold text-sm text-slate-700 truncate">{project?.name || 'Gateway Node B'}</div>
            <div className="text-xs font-mono text-blue-500 mt-1">{project?.id || 'ARCH-2026-X1'}</div>
          </div>
          
          <div className="flex items-center gap-2">
            <button className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors">
              <LogOut size={14} />
              Sign Out
            </button>
            <button className="p-3 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors">
              <Settings size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Stage */}
      <main className="main-stage">
        <div className="mesh-bg"></div>
        
        {/* Global Header */}
        <header className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
          <div className="flex flex-col">
             <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1">
               <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
               Live Core Node
             </div>
             <h2 className="text-slate-900 font-extrabold text-2xl tracking-tight">
               {workspaceNames[workspaceType] || 'ArchTech Workspace Panel'}
             </h2>
          </div>
        </header>

        {/* Content View */}
        <motion.div 
          key={workspaceType}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="h-[calc(100vh-180px)] min-h-0"
        >
          <Outlet context={{
            syrsDoc, setSyrsDoc,
            archDoc, setArchDoc,
            hrsDoc, setHrsDoc,
            schemaDoc, setSchemaDoc,
            srsDoc, setSrsDoc,
            sddDoc, setSddDoc,
            isGenerating, setIsGenerating
          }} />
        </motion.div>
      </main>
    </div>
  );
}
