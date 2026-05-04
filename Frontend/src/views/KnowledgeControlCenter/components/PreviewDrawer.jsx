import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, History, Clock, FileText, Database } from 'lucide-react';
import useKnowledgeStore from '../../../store/knowledgeStore';
import { getApiUrl } from '../../../utils/apiConfig';

export default function PreviewDrawer({ project }) {
  const { selectedDoc, setSelectedDoc } = useKnowledgeStore();
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedDoc) {
      setLoading(true);
      const pid = project?.id || "global_knowledge";
      fetch(getApiUrl(`/document-versions/${pid}/${selectedDoc.doc_id}`))
        .then(res => res.json())
        .then(data => setVersions(data))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [selectedDoc, project]);

  if (!selectedDoc) return null;

  return (
    <Transition.Root show={!!selectedDoc} as={React.Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => setSelectedDoc(null)}>
        <Transition.Child
          as={React.Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
              <Transition.Child
                as={React.Fragment}
                enter="transform transition ease-out duration-300 sm:duration-500"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in duration-200 sm:duration-500"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-2xl">
                  <div className="flex h-full flex-col overflow-y-scroll bg-white shadow-2xl rounded-l-3xl">
                    <div className="px-6 py-6 sm:px-8 bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                      <div className="flex items-start justify-between">
                        <div>
                           <Dialog.Title className="text-xl font-extrabold text-slate-900 pr-8">{selectedDoc.source}</Dialog.Title>
                           <div className="flex flex-wrap gap-2 mt-3">
                              <span className="bg-slate-200 text-slate-700 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">{selectedDoc.section || 'Uncategorized'}</span>
                              {selectedDoc.tags?.map(t => (
                                <span key={t} className="bg-rose-100 text-rose-700 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">{t}</span>
                              ))}
                           </div>
                        </div>
                        <div className="ml-3 flex h-7 items-center">
                          <button
                            type="button"
                            className="rounded-full p-2 bg-white text-slate-400 hover:text-slate-500 hover:bg-slate-100 shadow-sm border border-slate-100 transition-all focus:outline-none focus:ring-2 focus:ring-rose-500"
                            onClick={() => setSelectedDoc(null)}
                          >
                            <span className="sr-only">Close panel</span>
                            <X className="h-5 w-5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="relative flex-1 px-6 py-6 sm:px-8 space-y-8">
                      {/* Summary Section */}
                      <div>
                         <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                           <FileText size={14}/> Document Summary
                         </h4>
                         <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm text-slate-700 whitespace-pre-wrap">
                            {selectedDoc.summary || 'No summary available.'}
                         </div>
                      </div>

                      {/* RAG Usage Tracking */}
                      <div>
                         <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                           <Database size={14}/> RAG Usage Tracking
                         </h4>
                         <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl">
                            <div className="flex items-center gap-2 mb-4">
                               <span className="text-2xl font-extrabold text-emerald-700">{selectedDoc.usage_count || 0}</span>
                               <span className="text-sm font-bold text-emerald-600/70">times used in generation</span>
                            </div>
                         </div>
                      </div>

                      {/* Version History */}
                      <div>
                         <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                           <History size={14}/> Version History
                         </h4>
                         {loading ? (
                           <div className="text-center text-sm text-slate-400 py-4">Loading versions...</div>
                         ) : (
                           <div className="space-y-4">
                             {versions.map((v, i) => (
                               <div key={i} className={`p-4 rounded-2xl border ${v.is_current ? 'border-rose-200 bg-rose-50/50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 transition-colors'}`}>
                                 <div className="flex justify-between items-center mb-2">
                                   <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${v.is_current ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                                     {v.version} {v.is_current && "(Current)"}
                                   </span>
                                   <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                                     <Clock size={14}/> {new Date(v.uploaded_at).toLocaleDateString()} {new Date(v.uploaded_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                   </span>
                                 </div>
                                 <p className="text-sm text-slate-600 mt-3 line-clamp-3">{v.summary}</p>
                               </div>
                             ))}
                             {versions.length === 0 && <div className="text-sm text-slate-500 italic">No version history available.</div>}
                           </div>
                         )}
                      </div>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
