from __future__ import annotations

import argparse
import json
from pathlib import Path

from jinja2 import Environment, FileSystemLoader


ROOT = Path(__file__).resolve().parent
JSON_DIR = ROOT / "json"
TEMPLATE_DIR = ROOT / "templates"
TEMPLATE_NAME = "template.html"
DEFAULT_NAME = "dsh"


def available_names() -> list[str]:
    return sorted(path.stem for path in JSON_DIR.glob("*.json"))


def load_resume(name: str) -> dict:
    json_path = JSON_DIR / f"{name}.json"
    if not json_path.exists():
        choices = ", ".join(available_names()) or "none"
        raise FileNotFoundError(f"Cannot find {json_path}. Available resumes: {choices}")

    with json_path.open("r", encoding="utf-8") as file:
        data = json.load(file)

    data.setdefault("ico", "./assets/img/favicon.ico")
    return data


def _url_filter(path: str, base_path: str = "./") -> str:
    """Jinja2 filter: prefix relative paths with base_path.

    External URLs (http/https/data:) and absolute paths (/...) are returned as-is.
    Relative paths get base_path prepended (after stripping any leading ./).
    """
    if not path:
        return path
    if path.startswith(("http://", "https://", "//", "data:", "mailto:", "#")):
        return path
    if path.startswith("/"):
        return path
    # Strip leading ./
    while path.startswith("./"):
        path = path[2:]
    return base_path + path


def render_resume(
    name: str,
    output_dir: Path = ROOT,
    base_path: str = "../",
) -> Path:
    """Render a single resume to {output_dir}/{name}/index.html.

    Args:
        name: Resume json name (e.g. "dsh").
        output_dir: Root output directory. The file is written to
            ``{output_dir}/{name}/index.html``.
        base_path: Relative path prefix for assets (e.g. ``"../"`` for
            subdirectory pages, ``"./"`` for root-level pages).

    Returns:
        The path to the generated ``index.html``.
    """
    env = Environment(loader=FileSystemLoader(TEMPLATE_DIR), autoescape=False)
    env.filters["url"] = _url_filter
    template = env.get_template(TEMPLATE_NAME)

    data = load_resume(name)
    output_html = template.render(data, base_path=base_path)

    page_dir = output_dir / name
    page_dir.mkdir(parents=True, exist_ok=True)
    output_path = page_dir / "index.html"
    output_path.write_text(output_html, encoding="utf-8")
    return output_path


def render_root_index(name: str, output_dir: Path = ROOT) -> Path:
    """Render the default resume as the root index.html (base_path = ./)."""
    env = Environment(loader=FileSystemLoader(TEMPLATE_DIR), autoescape=False)
    env.filters["url"] = _url_filter
    template = env.get_template(TEMPLATE_NAME)

    data = load_resume(name)
    output_html = template.render(data, base_path="./")

    output_path = output_dir / "index.html"
    output_path.write_text(output_html, encoding="utf-8")
    return output_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render resume HTML from json/*.json.")
    parser.add_argument(
        "names",
        nargs="*",
        help="Resume json name(s), such as dsh or cyy. Defaults to dsh.",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Render every json file under json/.",
    )
    parser.add_argument(
        "--output-dir",
        default=str(ROOT),
        help="Directory for generated html files. Defaults to the project root.",
    )
    parser.add_argument(
        "--root",
        default=DEFAULT_NAME,
        help=f"Resume name to use as the root index.html (default: {DEFAULT_NAME}). "
        "Pass --no-root to skip generating root index.html.",
    )
    parser.add_argument(
        "--no-root",
        action="store_true",
        help="Skip generating the root index.html.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    names = available_names() if args.all else (args.names or [DEFAULT_NAME])
    if not names:
        raise SystemExit("No resume json files found under json/.")

    for name in names:
        output_path = render_resume(name, output_dir)
        print(f"Rendered {name}: {output_path}")

    # Generate root index.html from the default/root resume
    if not args.no_root:
        root_name = args.root if args.root != DEFAULT_NAME else (names[0] if len(names) == 1 else DEFAULT_NAME)
        if root_name in available_names():
            root_path = render_root_index(root_name, output_dir)
            print(f"Rendered root index: {root_path}")
        else:
            print(f"Warning: root resume '{root_name}' not found, skipping root index.html.")


if __name__ == "__main__":
    main()
