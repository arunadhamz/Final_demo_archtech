import React, { useState } from 'react';
import { Database, FolderOpen, UploadCloud, Globe } from 'lucide-react';
import GlobalKnowledge from './KnowledgeControlCenter/GlobalKnowledge';
import UploadWorkspace from './KnowledgeControlCenter/UploadWorkspace';
import ProjectKnowledge from './KnowledgeControlCenter/ProjectKnowledge';
import PreviewDrawer from './KnowledgeControlCenter/components/PreviewDrawer';

export default function KnowledgeBase({ project }) {
  const [activeTab, setActiveTab] = useState('global');

  const tabs = [
    { id: 'global', label: 'Global Knowledge', icon: Globe },
    { id: 'project', label: 'Project Knowledge', icon: FolderOpen },
    { id: 'upload', label: 'Upload Workspace', icon: UploadCloud },
  ];

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
         <div className="flex items-center gap-4">
            <div className="p-4 bg-rose-50 text-rose-600 rounded-3xl shadow-sm"><Database size={32} /></div>
            <div>
               <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">Knowledge Control Center</h3>
               <p className="text-sm text-slate-500 font-medium">Manage, visualize, and track engineering intelligence.</p>
            </div>
         </div>
         
         <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
         </div>
      </div>

      <div className="mt-6">
         {activeTab === 'global' && <GlobalKnowledge project={project} />}
         {activeTab === 'project' && <ProjectKnowledge project={project} />}
         {activeTab === 'upload' && <UploadWorkspace project={project} />}
      </div>

      <PreviewDrawer project={project} />
    </div>
  );
}
