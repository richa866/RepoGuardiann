"""One-shot Phase 1 CLI runner for fetching and caching GitHub repository issues.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings
from app.github.fetch import main

if __name__ == "__main__":
    main()
