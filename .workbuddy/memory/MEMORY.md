# Brief 项目长期记忆

## 项目概述
Brief 是一个开源简历框架，使用 Jinja2 模板引擎 + JSON 数据驱动，部署在 GitHub Pages。

## 技术栈
- 模板引擎：Jinja2 (Python SSG)
- 数据格式：JSON (json/{name}.json)
- 前端：原生 HTML/CSS/JS + Swiper.js + jQuery + Unicons/Font Awesome
- 部署：GitHub Pages + GitHub Actions CI
- 本地编辑器：admin.py (Python HTTP server) + edit.html + editor.js

## 架构要点
- Clean URL：`/{name}/` → `{name}/index.html`（目录结构，非 .html 后缀）
- base_path 机制：根页面 `./`，子目录页面 `../`，通过 Jinja2 `url` 过滤器处理
- CI 自动渲染：push JSON → GitHub Actions 运行 render.py --all → 部署到 Pages
- 生成文件不入库（.gitignore 忽略 index.html, dsh/, cyy/ 等）

## 关键文件
- `render.py`：渲染脚本，支持 --all / --no-root / --root 参数
- `admin.py`：本地编辑器后端，API 端点 /api/resumes, /api/render, /api/upload
- `templates/template.html`：唯一页面模板
- `json/dsh.json`、`json/cyy.json`：简历数据
