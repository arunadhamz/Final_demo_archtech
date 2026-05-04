import React, { useEffect, useState } from 'react';
import { Network, ArrowRightCircle, Layers, CheckCircle } from 'lucide-react';
import { getApiUrl } from '../utils/apiConfig';

export default function Traceability({ project }) {
  const [loading, setLoading] = useState(true);
  const [matrixData, setMatrixData] = useState(null);

  useEffect(() => {
    const fetchTraceability = async () => {
      try {
        const res = await fetch(getApiUrl('/traceability'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requirement_ids: project?.reqIds || [] })
        });
        const data = await res.json();
        setMatrixData(data);
      } catch (err) {
        console.error("Traceability module mapping failure:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTraceability();
  }, [project]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-400">
        <Network size={40} className="animate-pulse text-blue-500 mb-4" />
        <span className="text-sm font-bold">Computing Traceability Linkages...</span>
      </div>
    );
  }

  if (!matrixData || !matrixData.requirements || matrixData.requirements.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500 bg-white border border-slate-100 rounded-[32px] shadow-sm">
        <Layers size={48} className="mx-auto text-slate-300 mb-4" />
        <h3 className="text-xl font-bold">No Traceable Requirements Found</h3>
        <p className="text-xs text-slate-400 mt-1">Initialize workspace via your project Technical Specification documents.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-center bg-white p-6 border border-slate-100 rounded-[24px] shadow-sm">
        <div>
          <span className="text-blue-600 font-black text-[10px] uppercase tracking-widest">Analytics Layer</span>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Bidirectional Traceability Matrix</h2>
        </div>
        <div className="flex gap-4">
          <div className="px-4 py-2 bg-blue-50 border border-blue-100 rounded-xl text-blue-700 text-xs font-bold flex items-center gap-2">
            Links: <span className="text-slate-900 font-black">{matrixData.total_trace_links}</span>
          </div>
        </div>
      </header>

      <div className="bg-white border border-slate-100 rounded-[32px] overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-black text-slate-400 uppercase tracking-widest">
              <th className="py-5 px-6">Requirement Node</th>
              <th className="py-5 px-6">Domain Type</th>
              <th className="py-5 px-6">Traced Linkages</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-slate-700 text-sm font-medium">
            {matrixData.requirements.map(req => {
              const links = matrixData.matrix[req.id] || [];
              return (
                <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-6 px-6 font-mono text-slate-900 font-bold max-w-xs truncate">
                    {req.id}
                    <div className="font-sans text-xs text-slate-400 font-normal mt-1 leading-snug">{req.text}</div>
                  </td>
                  <td className="py-6 px-6">
                    <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-wider rounded-lg border border-slate-100">
                      {req.type}
                    </span>
                  </td>
                  <td className="py-6 px-6">
                    {links.length === 0 ? (
                      <span className="text-slate-400 text-xs font-normal">Isolated (0 relations)</span>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {links.map((link, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs bg-slate-50 p-2 border border-slate-100/50 rounded-xl max-w-sm">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                              link.link_tag === 'upstream' ? 'bg-indigo-50 text-indigo-600' :
                              link.link_tag === 'downstream' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-200 text-slate-600'
                            }`}>
                              {link.link_tag}
                            </span>
                            <ArrowRightCircle size={12} className="text-slate-300" />
                            <span className="font-mono font-bold text-slate-900">{link.linked_to}</span>
                            <span className="text-slate-400 text-[10px] ml-auto">Str: {link.trace_strength}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
