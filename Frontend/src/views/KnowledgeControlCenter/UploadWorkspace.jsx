import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File, X, CheckCircle2, Settings, Plus } from 'lucide-react';
import CustomSelect from '../../components/ui/CustomSelect';
import useKnowledgeStore from '../../store/knowledgeStore';
import useToastStore from '../../store/toastStore';
import { getApiUrl } from '../../utils/apiConfig';

/**
 * UploadWorkspace Component
 * Handles the drag-and-drop file upload interface for the Knowledge Control Center.
 * Allows users to upload documents, assign them to specific sections, and add custom tags.
 */
export default function UploadWorkspace({ project }) {
  // Global state management for toast notifications
  const { addToast } = useToastStore();
  
  // Global state management for knowledge base files and upload progress
  const { 
    uploadFiles, 
    addUploadFiles, 
    removeUploadFile, 
    updateUploadFile, 
    customSections, 
    clearUploads, 
    isUploading, 
    setIsUploading, 
    addCustomSection, 
    knowledgeList 
  } = useKnowledgeStore();
  
  // Local state for managing the "Create Custom Section" input field
  const [newSectionName, setNewSectionName] = useState("");
  const [showNewSectionInput, setShowNewSectionInput] = useState(false);

  /**
   * Callback fired when files are dragged and dropped into the dropzone.
   * Adds the accepted files to the global upload store.
   */
  const onDrop = useCallback(acceptedFiles => {
    const { addedCount, skippedDuplicates, skippedInvalidType } = addUploadFiles(acceptedFiles);
    
    if (addedCount > 0) {
      addToast(`Added ${addedCount} file(s) to queue.`, 'success');
    }
    
    if (skippedDuplicates > 0) {
      addToast(`${skippedDuplicates} duplicate file(s) were skipped.`, 'info');
    }
    
    if (skippedInvalidType > 0) {
      addToast(`${skippedInvalidType} file(s) skipped (Unsupported format).`, 'warning');
    }
  }, [addUploadFiles, addToast]);

  // Hook from react-dropzone to handle drag-and-drop interactions
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  /**
   * Handles the actual upload process to the backend API.
   * Uploads files sequentially so that individual metadata (section, tags) 
   * can be properly associated with each file.
   */
  const handleUpload = async () => {
    if (uploadFiles.length === 0) return;
    setIsUploading(true);

    try {
      // Create a map to group files by section and tags
      // Since we are uploading them together, the easiest approach is to upload them one by one if they have different metadata, 
      // or grouped if the endpoint supports it. The current endpoint supports multiple files but expects a single `section` and `tags` form field.
      // So we will upload them one by one to ensure each gets its correct section and tags.
      
      let successCount = 0;
      const pid = project?.id || "global_knowledge"; // Default to global if no project is selected

      // Iterate through each file and upload it individually
      for (const item of uploadFiles) {
        const formData = new FormData();
        formData.append('files', item.file);
        formData.append('project_id', pid);
        formData.append('section', item.section);
        formData.append('tags', item.tags.join(',')); // Convert tags array to comma-separated string

        // Update UI to show this specific file is uploading
        updateUploadFile(uploadFiles.indexOf(item), { status: 'uploading' });

        // Send POST request to the backend
        const res = await fetch(getApiUrl('/upload-warehouse'), {
          method: 'POST',
          body: formData
        });

        // Handle the response
        if (res.ok) {
          updateUploadFile(uploadFiles.indexOf(item), { status: 'success' });
          successCount++;
        } else {
          updateUploadFile(uploadFiles.indexOf(item), { status: 'error' });
          addToast(`Failed to upload ${item.name || 'file'}`, 'error');
        }
      }

      // Show final notification based on success count
      if (successCount === uploadFiles.length) {
        addToast(`Successfully uploaded ${successCount} file(s)!`, 'success');
        // Clear the upload list after a short delay so the user can see the success indicators
        setTimeout(() => clearUploads(), 2000);
      } else if (successCount > 0) {
        addToast(`Uploaded ${successCount} out of ${uploadFiles.length} files.`, 'info');
      }
    } catch (error) {
      console.error(error);
      addToast(error.message || 'An error occurred during upload', 'error');
    } finally {
      setIsUploading(false); // Reset uploading state when finished
    }
  };

  /**
   * Handles adding a new tag to a specific file when the user presses 'Enter'.
   */
  const handleTagInput = (index, e) => {
    if (e.key === 'Enter' && e.target.value.trim() !== '') {
      e.preventDefault();
      const newTag = e.target.value.trim().toLowerCase();
      const currentTags = uploadFiles[index].tags;
      
      // Prevent duplicate tags
      if (!currentTags.includes(newTag)) {
        updateUploadFile(index, { tags: [...currentTags, newTag] });
      }
      e.target.value = ''; // Clear input field
    }
  };

  /**
   * Removes a specific tag from a file's tag list.
   */
  const removeTag = (fileIndex, tagToRemove) => {
    const currentTags = uploadFiles[fileIndex].tags;
    updateUploadFile(fileIndex, { tags: currentTags.filter(t => t !== tagToRemove) });
  };

  /**
   * Adds a user-defined custom section to the available section options.
   */
  const handleAddCustomSection = () => {
    if (newSectionName.trim()) {
      addCustomSection(newSectionName.trim());
      setNewSectionName("");
      setShowNewSectionInput(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 
        Dropzone Area
        This is the dashed box where users can drag and drop files.
      */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Upload Workspace</h2>
        <p className="text-sm text-slate-500 mb-6">Drag and drop files or folders to add them to the knowledge base.</p>

        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${isDragActive ? 'border-rose-500 bg-rose-50' : 'border-slate-300 hover:border-slate-400 bg-slate-50'}`}
        >
          {/* Hidden input used by react-dropzone to handle file selection dialogs */}
          <input {...getInputProps()} />
          <UploadCloud className="mx-auto text-slate-400 mb-4" size={48} />
          <p className="text-slate-700 font-medium">Drag & drop files or folders here</p>
          <p className="text-xs text-slate-400 mt-2">Supports PDF, DOCX, MD, TXT</p>
        </div>
      </div>

      {/* 
        Pre-Upload Review Table
        Only shows if there are files queued for upload. 
        Allows the user to set metadata (Section, Tags) before committing.
      */}
      {uploadFiles.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-900">Pre-Upload Review</h3>
            {/* Main commit button that triggers handleUpload */}
            <button 
              onClick={handleUpload}
              disabled={isUploading}
              className="bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white px-6 py-2 rounded-xl font-bold shadow-sm transition-all flex items-center gap-2"
            >
              {isUploading ? 'Uploading...' : 'Commit Upload'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="text-xs uppercase bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 rounded-tl-xl">File</th>
                  <th className="px-4 py-3">Section</th>
                  <th className="px-4 py-3">Tags (Press Enter)</th>
                  <th className="px-4 py-3 text-right rounded-tr-xl">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* Loop through each file queued for upload */}
                {uploadFiles.map((fileItem, index) => (
                  <tr key={index} className="hover:bg-slate-50 transition-colors group">
                    {/* File Name Column */}
                    <td className="px-4 py-3 font-medium text-slate-900 flex items-center gap-3">
                      <File size={16} className="text-slate-400" />
                      <span className="truncate max-w-[200px]" title={fileItem.name}>{fileItem.name}</span>
                    </td>
                    
                    {/* Section Selector Column */}
                    <td className="px-4 py-3">
                      <CustomSelect 
                        value={fileItem.section}
                        onChange={(val) => updateUploadFile(index, { section: val })}
                        options={[
                          {
                            group: "Standard Sections",
                            items: [
                              { label: "Datasheets", value: "Datasheets" },
                              { label: "SyRS (System Requirements)", value: "SyRS" },
                              { label: "SRS (Software Requirements)", value: "SRS" },
                              { label: "HRS (Hardware Requirements)", value: "HRS" },
                              { label: "SDD (System Design)", value: "SDD" },
                              { label: "Standards (ISO, IEEE)", value: "Standards" },
                            ]
                          },
                          {
                            group: "Custom Sections",
                            // Combine newly created sections and existing knowledge base sections
                            items: Array.from(new Set([
                              ...customSections,
                              ...knowledgeList.map(i => i.section).filter(Boolean)
                            ]))
                          }
                        ]}
                        className="w-full text-xs"
                      />
                    </td>
                    
                    {/* Tags Column */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 mb-2">
                        {/* Render existing tags as chips */}
                        {fileItem.tags.map(tag => (
                          <span key={tag} className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                            {tag} <button onClick={() => removeTag(index, tag)}><X size={10}/></button>
                          </span>
                        ))}
                      </div>
                      {/* Input for adding new tags */}
                      <input 
                        type="text" 
                        placeholder="Add tag..." 
                        onKeyDown={(e) => handleTagInput(index, e)}
                        className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg focus:ring-rose-500 focus:border-rose-500 block w-full p-1.5 text-xs"
                      />
                    </td>
                    
                    {/* Actions Column (Success Icon or Delete Button) */}
                    <td className="px-4 py-3 text-right">
                      {fileItem.status === 'success' ? (
                        <CheckCircle2 className="text-emerald-500 inline" size={20} />
                      ) : (
                        <button onClick={() => removeUploadFile(index)} className="text-slate-400 hover:text-rose-600 transition-colors p-1">
                          <X size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 
            Custom Section Creator 
            Allows users to add new categories to the Section dropdown
          */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-3">
             {showNewSectionInput ? (
               <div className="flex items-center gap-2">
                 <input 
                   type="text" 
                   value={newSectionName}
                   onChange={e => setNewSectionName(e.target.value)}
                   placeholder="Section Name" 
                   className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-rose-500"
                   autoFocus
                 />
                 <button onClick={handleAddCustomSection} className="text-xs bg-slate-800 text-white px-3 py-1.5 rounded-lg font-bold">Add</button>
                 <button onClick={() => setShowNewSectionInput(false)} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
               </div>
             ) : (
               <button onClick={() => setShowNewSectionInput(true)} className="text-xs font-bold text-slate-500 hover:text-rose-600 flex items-center gap-1 transition-colors">
                 <Plus size={14}/> Create Custom Section
               </button>
             )}
          </div>
        </div>
      )}
    </div>
  );
}
