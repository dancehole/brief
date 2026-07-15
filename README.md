

<h1 align="center"> Brief </h1>

<p align="center">
    <strong>简体中文</strong> | <a href="readme_en.md">English</a>
</p>

<div align="center">
    <a href ="https://dancehole.gitee.io/"><img src="https://img.shields.io/badge/Blog-dancehole-orange?style=flat&logo=microdotblog&logoColor=white&labelColor=blue"></a>
    <a href ="https://gitee.com/dancehole"><img src="https://img.shields.io/badge/Gitee-dancehole-orange?style=flat&logo=gitee&logoColor=red&labelColor=white"></a>
    <a href ="https://github.com/dancehole"><img src="https://img.shields.io/badge/Github-dancehole-orange?style=flat&logo=github&logoColor=white&labelColor=grey"></a>
</div>

<div align="center">
    <a href ="https://www.apache.org/licenses/LICENSE-2.0.html"><img src="https://img.shields.io/badge/license-Apache--2.0-yellow"></a>
    <a><img src="https://img.shields.io/badge/Repo_type-vue_ resume-blue"></a>
    <a><img src="https://img.shields.io/badge/Status-Updating-green"></a>
    <a><img src="https://img.shields.io/badge/Download-Unavailable-darkred"></a>
</div>

------------------------------------------

<p align="center" style="border: 1px solid black; padding: 5px; margin: 10px 0;">
    一个开源简历框架，参考<a href="https://gitee.com/asoutherncat/responsive-portfolio-website/tree/master/assets">Bedimcode</a>和<a href="https://gitee.com/asoutherncat/responsive-portfolio-website/tree/master/assets">ASOUTHERNCAT</a><br>
    使用 Jinja2 模板引擎 + JSON 数据驱动，支持动态编辑（类似低代码/saas运维端），通过修改配置文件动态生成简历内容；支持多个人的简历（只需要修改路由 /your_name 即可）
    </p>


-------------------------------------------------------

## 一、仓库介绍

欢迎访问 Brief 文档仓库，参与该开源项目，与我们一起完善开发者文档。

<a href="https://dancehole.github.io/brief" style="font-size: 24px;">项目预览地址：https://dancehole.github.io/brief/</a>

------

## 二、架构设计

```
brief/
├── json/               # 简历数据（JSON）
│   ├── dsh.json        # 邓仕昊的简历数据
│   └── cyy.json        # 陈妍妍的简历数据
├── templates/
│   └── template.html   # Jinja2 模板（唯一的页面模板）
├── assets/             # 静态资源（CSS/JS/图片/PDF）
├── render.py           # 渲染脚本：JSON + 模板 → HTML
├── admin.py            # 本地编辑器后端（可选）
├── edit.html           # 本地编辑器前端
├── .github/workflows/
│   └── static.yml      # GitHub Actions CI（自动渲染+部署）
└── requirements.txt    # Python 依赖
```

### 模板引擎

使用 **Jinja2**（Python）作为服务端模板引擎，属于 **SSG（静态站点生成）** 方案：

- ✅ 生成纯静态 HTML，加载快、SEO 友好、无需服务器运行时
- ✅ 模板与数据分离，JSON 即数据，模板即视图
- ✅ GitHub Actions CI 自动渲染，push JSON 即部署
- ✅ 支持多简历：每个 JSON 文件对应一个路由页面

### 路由与 Clean URL

生成的页面采用目录结构，支持无 `.html` 后缀的 clean URL：

| URL | 对应文件 | 说明 |
|-----|---------|------|
| `/` | `index.html` | 默认简历（dsh） |
| `/dsh/` | `dsh/index.html` | 邓仕昊简历 |
| `/cyy/` | `cyy/index.html` | 陈妍妍简历 |

新增简历只需在 `json/` 目录添加 `{name}.json`，运行 `python render.py --all` 即可生成对应页面。

------

## 三、编辑与部署工作流

### 方式一：GitHub CI 自动部署（推荐）

1. 编辑 `json/dsh.json`（可直接在 GitHub 网页编辑）
2. 提交并推送到 master/main 分支
3. GitHub Actions 自动运行 `render.py --all` 并部署到 Pages
4. 无需本地安装 Python

### 方式二：本地编辑器

```bash
pip install -r requirements.txt
python admin.py
# 浏览器打开 http://127.0.0.1:8010/edit.html
```

编辑器支持：
- 表单化编辑所有简历字段
- 图片上传（自动保存到 assets/img/uploads/）
- 源码模式直接编辑 JSON
- 不运行后台时自动切换为下载 JSON 模式

### 方式三：命令行渲染

```bash
pip install -r requirements.txt
python render.py --all          # 渲染所有简历
python render.py dsh            # 仅渲染 dsh
python render.py --all --no-root  # 不生成根 index.html
```

------

## 四、自定义域名部署

1. 在 GitHub 仓库 Settings → Pages 中设置自定义域名 `brief.dancehole.cn`
2. 在域名 DNS 中添加 CNAME 记录指向 `dancehole.github.io`
3. CI 会自动渲染并部署，访问 `brief.dancehole.cn` 即可

------

## 五、预览

目前已经存放的简历：

此单页简历后续还可以用于公司的介绍、项目与产品介绍等。只需要简单修改配置文件，使用 /xx 路由访问即可。

------

## 六、加入我们

欢迎您参与贡献，我们鼓励开发者以各种方式参与文档反馈和贡献。

您可以对现有文档进行评价、简单更改、反馈文档质量问题、贡献您的原创内容，详细请参考[贡献文档]()。

## 七、联系方式

网站：[dancehole 的博客](https://dancehole.gitee.io)

邮箱：1391755954@qq.com

------

**仓库动态/更新日志**
- 2024/07/05 开始记录日志：在此之前已完成 jinja2模板重构 + 两个人的示例页面 + 配置文件。优化了页脚和项目展示的功能（支持一级分类）
- 2025/03/10 更新简历模板
- 2025/07/15 架构重构：Clean URL + GitHub Actions CI 自动渲染 + base_path 多层级资源路径适配
