from huggingface_hub import snapshot_download

snapshot_download(
    # repo_id="BAAI/bge-large-en-v1.5",
    repo_id="intfloat/e5-large-v2",
    local_dir="C:/Users/team086/Desktop/ArchTech_Main/ArchTech_V5-main/Backend/Embedding_Model/e5-large-v2",
    local_dir_use_symlinks=False
)

print("✅ Download complete")