"""Server-side converters. Pure functions on bytes, no Telegram here (unit-tested)."""

from __future__ import annotations

import io
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path

import pymupdf
from PIL import Image, ImageOps
from pillow_heif import register_heif_opener

register_heif_opener()  # Pillow can now open HEIC/HEIF

IMAGE_EXT = {"heic", "heif", "jpg", "jpeg", "png", "webp", "bmp", "tif", "tiff"}
AUDIO_EXT = {"ogg", "oga", "opus", "m4a", "aac", "wav", "flac", "mp3", "amr"}


def kind_of(name: str, mime: str | None) -> str | None:
    """'image' | 'pdf' | 'audio' | None — by MIME type or extension."""
    ext = Path(name or "").suffix.lower().lstrip(".")
    mime = (mime or "").lower()
    if mime == "application/pdf" or ext == "pdf":
        return "pdf"
    if mime.startswith("image/") or ext in IMAGE_EXT:
        return "image"
    if mime.startswith("audio/") or ext in AUDIO_EXT:
        return "audio"
    return None


def stem(name: str) -> str:
    return Path(name or "file").stem or "file"


def to_jpeg(data: bytes, quality: int = 90, max_side: int | None = None) -> bytes:
    """Any Pillow/HEIC image → JPEG. Respects EXIF rotation; transparency goes on white."""
    with Image.open(io.BytesIO(data)) as src:
        img = ImageOps.exif_transpose(src)
        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGBA")
            bg = Image.new("RGB", img.size, "white")
            bg.paste(img, mask=img.getchannel("A"))
            img = bg
        else:
            img = img.convert("RGB")
        if max_side:
            img.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
        out = io.BytesIO()
        img.save(out, "JPEG", quality=quality, optimize=True, progressive=True)
        return out.getvalue()


def compress_image(data: bytes) -> bytes:
    """Smaller JPEG for mail/forms: quality 75, long side ≤ 2560 px."""
    return to_jpeg(data, quality=75, max_side=2560)


def audio_to_mp3(data: bytes, kbps: int = 64) -> bytes:
    """Any ffmpeg-readable audio (voice messages are Ogg/Opus) → MP3."""
    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg is not installed")
    with tempfile.TemporaryDirectory() as d:
        src, dst = Path(d, "in"), Path(d, "out.mp3")
        src.write_bytes(data)
        subprocess.run(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                str(src),
                "-vn",
                "-codec:a",
                "libmp3lame",
                "-b:a",
                f"{kbps}k",
                str(dst),
            ],
            check=True,
            timeout=180,
        )
        return dst.read_bytes()


def pdf_compress(data: bytes, dpi: int = 110, quality: int = 60) -> bytes | None:
    """Rasterize pages to JPEG and rebuild. Great for scans; None if the result is not smaller."""
    with pymupdf.open(stream=data, filetype="pdf") as doc, pymupdf.open() as out:
        for page in doc:
            jpg = page.get_pixmap(dpi=dpi).tobytes("jpeg", jpg_quality=quality)
            new = out.new_page(width=page.rect.width, height=page.rect.height)
            new.insert_image(new.rect, stream=jpg)
        res = out.tobytes(garbage=4, deflate=True)
    return res if len(res) < len(data) else None


def pdf_to_jpegs(data: bytes, dpi: int = 150) -> list[bytes]:
    with pymupdf.open(stream=data, filetype="pdf") as doc:
        return [page.get_pixmap(dpi=dpi).tobytes("jpeg", jpg_quality=88) for page in doc]


def pdf_split(data: bytes) -> list[bytes]:
    """One PDF per page."""
    out: list[bytes] = []
    with pymupdf.open(stream=data, filetype="pdf") as doc:
        for i in range(doc.page_count):
            with pymupdf.open() as one:
                one.insert_pdf(doc, from_page=i, to_page=i)
                out.append(one.tobytes(garbage=4, deflate=True))
    return out


def zip_files(files: list[tuple[str, bytes]]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED) as z:  # results are already compressed
        for name, data in files:
            z.writestr(name, data)
    return buf.getvalue()


def change(before: int, after: int) -> str:
    """'−73%' / '+12%' for the caption."""
    if not before:
        return ""
    pct = round((after / before - 1) * 100)
    return f"−{abs(pct)}%" if pct < 0 else f"+{pct}%"


def human(n: int) -> str:
    for unit in ("B", "KB", "MB"):
        if n < 1024 or unit == "MB":
            return f"{n:.0f} {unit}" if unit == "B" or n >= 10 else f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} MB"
