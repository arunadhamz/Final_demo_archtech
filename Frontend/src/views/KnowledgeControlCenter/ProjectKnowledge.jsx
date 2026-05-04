import React from 'react';
import { Folder, FileText, Code, Network } from 'lucide-react';

export default function ProjectKnowledge({ project }) {
  if (!project) {
    return (
      <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center shadow-sm">
        <Folder className="mx-auto text-slate-300 mb-4" size={48} />
        <h3 className="text-xl font-bold text-slate-800">No Project Selected</h3>
        <p className="text-slate-500 mt-2">Select a project to view its specific knowledge base and generated assets.</p>
      </div>
    );
  }

  const sections = [
    { name: "Documents & Specs", icon: FileText, count: 12 },
    { name: "Generated Outputs", icon: Folder, count: 5 },
    { name: "Source Code", icon: Code, count: 24 },
    { name: "Traceability Links", icon: Network, count: 156 }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
           <h2 className="text-2xl font-extrabold text-slate-900">{project.name || "Project"} Knowledge</h2>
           <p className="text-sm text-slate-500 font-medium mt-1">Hierarchical view of all assets linked to this project.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map(sec => (
          <div key={sec.name} className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-rose-300 hover:shadow-md cursor-pointer transition-all flex items-center gap-4 group">
             <div className="p-4 bg-slate-50 text-slate-400 group-hover:text-rose-500 group-hover:bg-rose-50 rounded-xl transition-colors">
                <sec.icon size={28} />
             </div>
             <div>
                <h4 className="font-bold text-slate-800 text-lg">{sec.name}</h4>
                <p className="text-sm font-bold text-slate-400">{sec.count} items</p>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}
