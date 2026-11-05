import io
import shutil
import zipfile
from pathlib import Path

import pymupdf
import pytest
from PIL import Image

from bot import convert

FX = Path(__file__).parent / "fixtures"
read = lambda n: (FX / n).read_bytes()  # noqa: E731


def jpeg_size(data: bytes) -> tuple[int, int]:
    with Image.open(io.BytesIO(data)) as im:
        assert im.format == "JPEG"
        return im.size


@pytest.mark.parametrize(
    ("name", "mime", "kind"),
    [
        ("IMG_1.HEIC", None, "image"),
        ("a.png", "image/png", "image"),
        ("doc.pdf", "application/octet-stream", "pdf"),
        ("x", "application/pdf", "pdf"),
        ("voice.ogg", "audio/ogg", "audio"),
        ("rec.m4a", None, "audio"),
        ("a.zip", "application/zip", None),
    ],
)
def test_kind_of(name, mime, kind):
    assert convert.kind_of(name, mime) == kind


@pytest.mark.parametrize("fx", ["photo.heic", "photo.png", "photo.webp", "photo.jpg"])
def test_to_jpeg_from_every_format(fx):
    w, h = jpeg_size(convert.to_jpeg(read(fx)))
    assert w > 0 and h > 0


def test_png_transparency_becomes_white():
    src = Image.new("RGBA", (10, 10), (0, 0, 0, 0))
    buf = io.BytesIO()
    src.save(buf, "PNG")
    with Image.open(io.BytesIO(convert.to_jpeg(buf.getvalue()))) as im:
        assert im.getpixel((5, 5)) == (255, 255, 255)


def test_compress_image_is_smaller_and_limits_size():
    big = Image.new("RGB", (4000, 3000), "white")
    buf = io.BytesIO()
    big.save(buf, "PNG")
    out = convert.compress_image(read("photo.png"))
    assert len(out) < len(read("photo.png"))
    assert max(jpeg_size(convert.compress_image(buf.getvalue()))) == 2560


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg not installed")
def test_voice_to_mp3():
    mp3 = convert.audio_to_mp3(read("voice.ogg"))
    assert mp3[:3] == b"ID3" or (mp3[0] == 0xFF and mp3[1] & 0xE0 == 0xE0)
    assert 15_000 < len(mp3) < 40_000  # 3 s at 64 kbps


def test_pdf_compress_scan_and_text():
    out = convert.pdf_compress(read("scan.pdf"))
    assert out is not None and len(out) < len(read("scan.pdf"))
    with pymupdf.open(stream=out, filetype="pdf") as d:
        assert d.page_count == 2
    assert convert.pdf_compress(read("text.pdf")) is None  # text-only PDFs are already small


def test_pdf_to_jpegs_and_split():
    pages = convert.pdf_to_jpegs(read("text.pdf"))
    assert len(pages) == 3 and all(p[:3] == b"\xff\xd8\xff" for p in pages)
    parts = convert.pdf_split(read("text.pdf"))
    assert len(parts) == 3
    for p in parts:
        with pymupdf.open(stream=p, filetype="pdf") as d:
            assert d.page_count == 1


def test_zip_and_helpers():
    z = convert.zip_files([("a.txt", b"1"), ("b.txt", b"2")])
    assert zipfile.ZipFile(io.BytesIO(z)).namelist() == ["a.txt", "b.txt"]
    assert convert.change(2400, 640) == "−73%"
    assert convert.change(100, 112) == "+12%"
    assert convert.human(512) == "512 B"
    assert convert.human(1536) == "1.5 KB"
    assert convert.human(78_000) == "76 KB"
    assert convert.stem("IMG_2870.HEIC") == "IMG_2870"
