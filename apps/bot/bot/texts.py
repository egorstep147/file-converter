"""Bot texts: Russian for ru/uk/be/kk users, English for everyone else."""

RU = {
    "start": (
        "👋 Я <b>IslePlace Converter</b>.\n\n"
        "Пришлите мне:\n"
        "🎙 <b>голосовое или аудио</b> → верну MP3\n"
        "🖼 <b>фото файлом</b> (HEIC с iPhone, PNG, WebP) → JPG или сжатое\n"
        "📄 <b>PDF</b> → сжать, в картинки или по страницам\n\n"
        "🔒 Присланные мне файлы обрабатываются на сервере и удаляются сразу после ответа.\n"
        "Хотите, чтобы файлы вообще не покидали телефон — откройте приложение кнопкой ниже: "
        "там всё работает на вашем устройстве и без ограничения размера."
    ),
    "open_app": "⇄ Открыть конвертер",
    "choose": "Что сделать с файлом <b>{name}</b>?",
    "to_jpg": "🖼 В JPG",
    "compress": "🗜 Сжать",
    "pdf_jpg": "🖼 В картинки",
    "pdf_split": "✂️ По страницам",
    "working": "⏳ Обрабатываю…",
    "done": "✅ Готово · {before} → {after} ({pct})",
    "done_plain": "✅ Готово",
    "not_smaller": "Файл уже оптимизирован — уменьшить не получилось.",
    "too_big": (
        "Файл {size} — больше лимита Telegram для ботов (20 MB).\n"
        "Откройте конвертер кнопкой ниже: там файлы любого размера обрабатываются прямо на телефоне."
    ),
    "unsupported": "Этот формат я пока не умею. Поддерживаю: голосовые/аудио, фото (HEIC, PNG, WebP, JPG) и PDF.",
    "photo_hint": (
        "Telegram уже сжал это фото. Чтобы получить JPG без потерь из HEIC/PNG, "
        "отправьте его <b>как файл</b> (📎 → Файл). А это фото могу сжать ещё сильнее:"
    ),
    "expired": "Кнопка устарела — пришлите файл ещё раз.",
    "error": "❌ Не получилось обработать файл. Возможно, он повреждён.",
    "pages_zip": "Страниц много — отправляю архивом.",
    "from_app": "⇄ Из конвертера IslePlace",
}

EN = {
    "start": (
        "👋 I'm <b>IslePlace Converter</b>.\n\n"
        "Send me:\n"
        "🎙 <b>a voice message or audio</b> → I'll return MP3\n"
        "🖼 <b>a photo as a file</b> (iPhone HEIC, PNG, WebP) → JPG or compressed\n"
        "📄 <b>a PDF</b> → compress, to images or split into pages\n\n"
        "🔒 Files you send me are processed on the server and deleted right after the reply.\n"
        "Want files to never leave your phone? Open the app with the button below: "
        "everything runs on your device, with no size limit."
    ),
    "open_app": "⇄ Open converter",
    "choose": "What to do with <b>{name}</b>?",
    "to_jpg": "🖼 To JPG",
    "compress": "🗜 Compress",
    "pdf_jpg": "🖼 To images",
    "pdf_split": "✂️ Split pages",
    "working": "⏳ Working…",
    "done": "✅ Done · {before} → {after} ({pct})",
    "done_plain": "✅ Done",
    "not_smaller": "The file is already optimized — it couldn't be made smaller.",
    "too_big": (
        "The file is {size} — over Telegram's 20 MB limit for bots.\n"
        "Open the converter with the button below: files of any size are processed right on your phone."
    ),
    "unsupported": "I can't handle this format yet. Supported: voice/audio, photos (HEIC, PNG, WebP, JPG) and PDF.",
    "photo_hint": (
        "Telegram has already compressed this photo. For a lossless JPG from HEIC/PNG, "
        "send it <b>as a file</b> (📎 → File). I can compress this photo further:"
    ),
    "expired": "This button has expired — please send the file again.",
    "error": "❌ Couldn't process the file. It may be damaged.",
    "pages_zip": "Many pages — sending them as a ZIP.",
    "from_app": "⇄ From IslePlace Converter",
}

RU_LANGS = {"ru", "uk", "be", "kk"}
SITE_LANGS = {"en", "es", "pt", "ru", "id"}


def lang_of(code: str | None) -> str:
    return "ru" if (code or "")[:2] in RU_LANGS else "en"


def site_lang(code: str | None) -> str:
    c = (code or "")[:2]
    return c if c in SITE_LANGS else ("ru" if c in RU_LANGS else "en")


def t(code: str | None, key: str, **kw: object) -> str:
    s = (RU if lang_of(code) == "ru" else EN)[key]
    return s.format(**kw) if kw else s
