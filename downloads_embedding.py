from huggingface_hub import snapshot_download
import os

# 1. Configuration
# The official model name on Hugging Face
REPO_ID = "intfloat/e5-large-v2" 

# Where you want to save it (matches your error log path)
LOCAL_DIR = os.path.join("Embedding_model", "e5-large-v2")

print(f"🚀 Starting download of {REPO_ID}...")
print(f"📂 Saving to: {os.path.abspath(LOCAL_DIR)}")

try:
    # 2. Download the full repository
    snapshot_download(
        repo_id=REPO_ID,
        local_dir=LOCAL_DIR,
        local_dir_use_symlinks=False,  # Ensures actual files are copied, not just links
        ignore_patterns=["*.msgpack", "*.h5", "*.ot"], # Skips files you don't need for Python
    )
    print("\n✅ Success! Model files are now in the correct folder.")
    print("You can now run your main.py script.")

except Exception as e:
    print(f"\n❌ An error occurred: {e}")
    print("Tip: Check your internet connection or if the model name is correct.")
