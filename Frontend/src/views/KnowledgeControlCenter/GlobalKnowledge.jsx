import React, { useEffect, useMemo } from 'react';
import { useReactTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel, flexRender } from '@tanstack/react-table';
import { LayoutGrid, List, Search, Eye, Trash2, Cpu, FileText, Database, Folder, ChevronLeft } from 'lucide-react';
import CustomSelect from '../../components/ui/CustomSelect';
import useKnowledgeStore from '../../store/knowledgeStore';
import { getApiUrl } from '../../utils/apiConfig';

export default function GlobalKnowledge({ project }) {
  const { knowledgeList, viewMode, setViewMode, filterSection, setFilterSection, searchQuery, setSearchQuery, setKnowledgeList, setSelectedDoc } = useKnowledgeStore();

  const fetchKnowledge = async () => {
    try {
      const pid = project?.id || "global_knowledge";
      const res = await fetch(getApiUrl(`/project-knowledge/${pid}`));
      const data = await res.json();
      setKnowledgeList(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchKnowledge();
  }, [project]);

  const handleDelete = async (docId) => {
    if(!confirm("Delete this document?")) return;
    try {
      const pid = project?.id || "global_knowledge";
      await fetch(getApiUrl(`/knowledge/${pid}/${docId}`), { method: 'DELETE' });
      fetchKnowledge();
    } catch (e) {
      console.error(e);
    }
  };

  const columns = useMemo(() => [
    {
      accessorKey: 'source',
      header: 'Name',
      cell: info => <span className="font-bold text-slate-800">{info.getValue()}</span>
    },
    {
      accessorKey: 'section',
      header: 'Section',
      cell: info => <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">{info.getValue() || 'Uncategorized'}</span>
    },
    {
      accessorKey: 'tags',
      header: 'Tags',
      cell: info => (
        <div className="flex gap-1 flex-wrap">
          {info.getValue()?.slice(0, 3).map(t => (
            <span key={t} className="bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">{t}</span>
          ))}
          {info.getValue()?.length > 3 && <span className="text-slate-400 text-xs">+{info.getValue().length - 3}</span>}
        </div>
      )
    },
    {
      accessorKey: 'version',
      header: 'Version',
      cell: info => <span className="text-xs font-mono bg-slate-100 px-1.5 rounded">{info.getValue()}</span>
    },
    {
      accessorKey: 'uploaded_at',
      header: 'Date',
      cell: info => <span className="text-xs text-slate-500">{new Date(info.getValue()).toLocaleDateString()}</span>
    },
    {
      accessorKey: 'usage_count',
      header: 'RAG Usage',
      cell: info => (
        <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
           <Database size={12}/> {info.getValue() || 0}
        </span>
      )
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          <button onClick={() => setSelectedDoc(row.original)} className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"><Eye size={16}/></button>
          <button onClick={() => handleDelete(row.original.doc_id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"><Trash2 size={16}/></button>
        </div>
      )
    }
  ], []);

  const filteredData = useMemo(() => {
    return knowledgeList.filter(item => {
      const matchSearch = (item.source || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (item.tags || []).join(' ').toLowerCase().includes(searchQuery.toLowerCase());
      const matchSection = filterSection === 'All' || item.section === filterSection;
      return matchSearch && matchSection;
    });
  }, [knowledgeList, searchQuery, filterSection]);

  const showCategoryCards = viewMode === 'grid' && filterSection === 'All' && !searchQuery;

  const categoryStats = useMemo(() => {
    if (!showCategoryCards) return [];
    const stats = {};
    knowledgeList.forEach(item => {
        const sec = item.section || 'Uncategorized';
        if (!stats[sec]) stats[sec] = 0;
        stats[sec]++;
    });
    return Object.entries(stats).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count);
  }, [knowledgeList, showCategoryCards]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
         <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search documents, tags..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
            />
         </div>
         <div className="flex items-center gap-3">
            <CustomSelect 
              value={filterSection} 
              onChange={setFilterSection} 
              options={[
                { label: 'All Sections', value: 'All' },
                ...Array.from(new Set(knowledgeList.map(i => i.section).filter(Boolean)))
              ]}
              className="w-48 z-10"
            />
            <div className="flex items-center p-1 bg-slate-100 rounded-lg">
               <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}>
                  <List size={18} />
               </button>
               <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}>
                  <LayoutGrid size={18} />
               </button>
            </div>
         </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
         {filteredData.length === 0 && !showCategoryCards ? (
            <div className="p-12 text-center text-slate-400">
               <Database className="mx-auto mb-4 opacity-50" size={48} />
               <p>No documents found matching your filters.</p>
            </div>
         ) : showCategoryCards ? (
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 bg-slate-50/50">
               {categoryStats.map(cat => (
                   <div key={cat.name} onClick={() => setFilterSection(cat.name)} className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-rose-300 hover:shadow-md cursor-pointer transition-all flex items-center gap-4 group">
                       <div className="p-4 bg-slate-50 text-slate-400 group-hover:text-rose-500 group-hover:bg-rose-50 rounded-xl transition-colors">
                          <Folder size={28} />
                       </div>
                       <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-800 text-lg truncate" title={cat.name}>{cat.name}</h4>
                          <p className="text-sm font-bold text-slate-400">{cat.count} {cat.count === 1 ? 'file' : 'files'}</p>
                       </div>
                   </div>
               ))}
               {categoryStats.length === 0 && (
                   <div className="col-span-full p-12 text-center text-slate-400">
                      <Folder className="mx-auto mb-4 opacity-50" size={48} />
                      <p>No categories found.</p>
                   </div>
               )}
            </div>
         ) : viewMode === 'table' ? (
            <div className="overflow-x-auto">
               <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200 text-xs uppercase tracking-wider">
                     {table.getHeaderGroups().map(headerGroup => (
                        <tr key={headerGroup.id}>
                           {headerGroup.headers.map(header => (
                              <th key={header.id} className="px-6 py-4 font-bold">
                                 {flexRender(header.column.columnDef.header, header.getContext())}
                              </th>
                           ))}
                        </tr>
                     ))}
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {table.getRowModel().rows.map(row => (
                        <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                           {row.getVisibleCells().map(cell => (
                              <td key={cell.id} className="px-6 py-4">
                                 {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </td>
                           ))}
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         ) : (
            <div className="flex flex-col bg-slate-50/50">
               {filterSection !== 'All' && (
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                     <div className="flex items-center gap-2">
                         <button onClick={() => setFilterSection('All')} className="text-slate-500 hover:text-slate-800 flex items-center gap-1 text-sm font-bold transition-colors">
                            <ChevronLeft size={16} /> Back to Categories
                         </button>
                         <span className="text-slate-300">|</span>
                         <span className="text-sm font-bold text-slate-700">{filterSection}</span>
                     </div>
                  </div>
               )}
               <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredData.map(item => {
                  const isCode = item.tags?.includes("code");
                  const Icon = isCode ? Cpu : FileText;
                  return (
                    <div key={item.doc_id} className="bg-white p-5 rounded-2xl border border-slate-200 hover:shadow-md hover:border-rose-200 transition-all group flex flex-col h-full">
                       <div className="flex items-start justify-between mb-4">
                          <div className="p-2.5 bg-slate-50 text-slate-400 rounded-xl group-hover:text-rose-500 group-hover:bg-rose-50 transition-colors">
                             <Icon size={24} />
                          </div>
                          <button onClick={() => setSelectedDoc(item)} className="text-slate-400 hover:text-slate-800"><Eye size={18}/></button>
                       </div>
                       <h4 className="font-bold text-slate-900 truncate mb-1" title={item.source}>{item.source}</h4>
                       <p className="text-xs text-slate-500 mb-4 truncate">{item.section || 'Uncategorized'}</p>
                       <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-400">{new Date(item.uploaded_at).toLocaleDateString()}</span>
                          <span className="text-emerald-600 flex items-center gap-1"><Database size={12}/> {item.usage_count || 0}</span>
                       </div>
                    </div>
                  );
               })}
               </div>
            </div>
         )}
      </div>
    </div>
  );
}
