#!/usr/bin/env python3
"""Port shadcn preview-02 cards (apps/v4/registry/bases/base/blocks/preview-02)
into this Vite project, mimicking what the shadcn registry build does for the
`base-nova` style:

- @/registry/bases/base/ui/*      -> @/components/ui/*
- <IconPlaceholder lucide="X" .../> -> <X ... /> imported from lucide-react
- useDesignSystemSearchParams()    -> nova style constants (isRounded = true)
- style-nova:foo -> foo, style-<other>:foo -> removed
- cn-font-heading                  -> font-heading
"""
import re
import sys
from pathlib import Path

SRC = Path(sys.argv[1])
DST = Path(sys.argv[2])
DST.mkdir(parents=True, exist_ok=True)

ICON_LIB_ATTRS = ("lucide", "tabler", "hugeicons", "phosphor", "remixicon")


def find_tag_end(text: str, start: int) -> int:
    """Return index just past the closing `/>` of a self-closing JSX tag."""
    depth = 0
    i = start
    quote = None
    while i < len(text):
        c = text[i]
        if quote:
            if c == quote:
                quote = None
        elif c in "\"'`":
            quote = c
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
        elif depth == 0 and text.startswith("/>", i):
            return i + 2
        i += 1
    raise ValueError("unterminated IconPlaceholder tag")


def replace_icons(text: str, icons: set[str]) -> str:
    out = []
    pos = 0
    tag = "<IconPlaceholder"
    while True:
        idx = text.find(tag, pos)
        if idx == -1:
            out.append(text[pos:])
            break
        end = find_tag_end(text, idx + len(tag))
        attrs = text[idx + len(tag): end - 2]
        m = re.search(r'\blucide="([A-Za-z0-9]+)"', attrs)
        if not m:
            raise ValueError(f"IconPlaceholder without lucide attr: {attrs!r}")
        name = m.group(1)
        icons.add(name)
        for a in ICON_LIB_ATTRS:
            attrs = re.sub(rf'\s*\b{a}="[^"]*"', "", attrs)
        attrs = attrs.strip()
        out.append(text[pos:idx])
        out.append(f"<{name} {attrs} />" if attrs else f"<{name} />")
        pos = end
    return "".join(out)


def transform(text: str) -> str:
    text = text.replace("@/registry/bases/base/ui/", "@/components/ui/")
    text = text.replace("@/registry/bases/base/lib/", "@/lib/")
    text = text.replace("@/registry/bases/base/hooks/", "@/hooks/")

    # Remove create-app-only imports.
    text = re.sub(r'import \{ IconPlaceholder \} from "[^"]+"\n', "", text)
    text = re.sub(r'import \{ useDesignSystemSearchParams \} from "[^"]+"\n', "", text)
    text = re.sub(r"[ \t]*const \[params\] = useDesignSystemSearchParams\(\)\n", "", text)
    text = re.sub(
        r'const isRounded = !\[[^\]]*\]\.includes\(params\.style\)',
        "const isRounded = true // nova style",
        text,
    )
    if "params.style" in text or "useDesignSystemSearchParams" in text:
        raise ValueError("unhandled design-system param usage")

    icons: set[str] = set()
    text = replace_icons(text, icons)

    # Style-specific variants: keep nova, drop the rest.
    text = re.sub(
        r"(?<![\w-])style-(\w+):([^\s\"'`}]+)",
        lambda m: m.group(2) if m.group(1) == "nova" else "",
        text,
    )
    text = text.replace("cn-font-heading", "font-heading")
    # Tidy class strings left with double/leading/trailing spaces.
    text = re.sub(r'className="\s*([^"]*?)\s*"', lambda m: 'className="' + re.sub(r"\s{2,}", " ", m.group(1)) + '"', text)
    text = re.sub(r'\s*className=""', "", text)

    if icons:
        imp = "import { " + ", ".join(sorted(icons)) + ' } from "lucide-react"\n'
        lines = text.split("\n")
        # Insert after the last top-level import statement.
        last_import_end = 0
        in_import = False
        for i, line in enumerate(lines):
            if line.startswith("import "):
                in_import = not (line.rstrip().endswith('"') or line.rstrip().endswith("'"))
                last_import_end = i
            elif in_import:
                last_import_end = i
                if line.startswith("}"):
                    in_import = False
        lines.insert(last_import_end + 1, imp.rstrip("\n"))
        text = "\n".join(lines)
    return text


count = 0
for f in sorted(SRC.glob("*.tsx")):
    (DST / f.name).write_text(transform(f.read_text()))
    count += 1
print(f"ported {count} files -> {DST}")
