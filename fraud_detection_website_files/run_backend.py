"""
Convenience entry point to launch the FastAPI backend server
directly from the fraud_detection_website_files directory.
"""
import sys
from pathlib import Path
import uvicorn

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent / "backend"
sys.path.insert(0, str(backend_dir))

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
