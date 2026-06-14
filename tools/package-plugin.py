import shutil
import sys
import zipfile
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLUGIN_SLUG = "yoleotard-product-card-enhancer"
PLUGIN_DIR = ROOT / PLUGIN_SLUG
ARCHIVE_DIR = ROOT / "plugin-archives"
ARCHIVE_PATH = ARCHIVE_DIR / f"{PLUGIN_SLUG}.zip"

EXCLUDE_NAMES = {".DS_Store", "Thumbs.db"}


def archive_existing_zip():
    if not ARCHIVE_PATH.exists():
        return None

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = ARCHIVE_DIR / f"{PLUGIN_SLUG}-{stamp}.zip"
    shutil.copy2(ARCHIVE_PATH, backup)
    return backup


def iter_plugin_files():
    for path in sorted(PLUGIN_DIR.rglob("*")):
        if path.is_file() and path.name not in EXCLUDE_NAMES:
            yield path


def build_zip():
    if not PLUGIN_DIR.is_dir():
        raise SystemExit(f"Plugin directory not found: {PLUGIN_DIR}")

    ARCHIVE_DIR.mkdir(exist_ok=True)
    backup = archive_existing_zip()

    with zipfile.ZipFile(ARCHIVE_PATH, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in iter_plugin_files():
            rel = path.relative_to(ROOT).as_posix()
            zf.write(path, rel)

    return backup


def verify_zip():
    with zipfile.ZipFile(ARCHIVE_PATH) as zf:
        names = zf.namelist()

    if not names:
        raise SystemExit("Archive is empty.")

    if any("\\" in name for name in names):
        raise SystemExit("Archive contains Windows backslash paths.")

    top_levels = {name.split("/", 1)[0] for name in names}
    if top_levels != {PLUGIN_SLUG}:
        raise SystemExit(f"Archive must contain one top-level folder: {PLUGIN_SLUG}")

    required = {
        f"{PLUGIN_SLUG}/yoleotard-product-card-enhancer.php",
        f"{PLUGIN_SLUG}/assets/js/frontend.js",
        f"{PLUGIN_SLUG}/assets/css/frontend.css",
    }
    missing = required.difference(names)
    if missing:
        raise SystemExit("Archive is missing required files: " + ", ".join(sorted(missing)))


def main():
    backup = build_zip()
    verify_zip()
    if backup:
        print(f"Preserved previous archive: {backup.relative_to(ROOT)}")
    print(f"Built archive: {ARCHIVE_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    sys.exit(main())
