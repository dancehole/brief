(() => {
  "use strict";

  const FALLBACK_NAMES = ["dsh", "cyy"];
  const SECTIONS = [
    { id: "basics", title: "基础信息", help: "站点标题、图标、顶部下载按钮和导航菜单。", render: renderBasics },
    { id: "home", title: "首页", help: "首页头像、标题、简介、按钮和社交链接。", render: renderHome },
    { id: "about", title: "个人简介", help: "简介段落、关键经历、简历附件和个人照片。", render: renderAbout },
    { id: "skills", title: "技能", help: "技能分组和进度条，百分比请保留百分号。", render: renderSkills },
    { id: "qualification", title: "经历", help: "教育、工作等时间线内容。", render: renderQualification },
    { id: "projects", title: "项目", help: "作品集轮播内容和图片。", render: renderProjects },
    { id: "contact", title: "联系", help: "联系方式标题和具体联系方式。", render: renderContact },
    { id: "footer", title: "页脚", help: "底部链接、社交图标、备案和致谢。", render: renderFooter },
    { id: "raw", title: "源码", help: "直接编辑完整 JSON，适合处理新字段或批量修改。", render: null },
  ];

  const state = {
    backend: false,
    currentName: "dsh",
    data: createEmptyResume(),
    dirty: false,
    names: [...FALLBACK_NAMES],
    tab: "basics",
  };

  const dom = {};

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    cacheDom();
    bindEvents();
    renderSectionNav();
    await detectBackend();
    populateResumeSelect(state.names);
    await loadResume(state.currentName);
  }

  function cacheDom() {
    dom.backendStatus = document.getElementById("backendStatus");
    dom.dirtyStatus = document.getElementById("dirtyStatus");
    dom.resumeSelect = document.getElementById("resumeSelect");
    dom.resumeName = document.getElementById("resumeName");
    dom.loadBtn = document.getElementById("loadBtn");
    dom.saveBtn = document.getElementById("saveBtn");
    dom.renderBtn = document.getElementById("renderBtn");
    dom.previewLink = document.getElementById("previewLink");
    dom.openFileBtn = document.getElementById("openFileBtn");
    dom.downloadBtn = document.getElementById("downloadBtn");
    dom.fileInput = document.getElementById("fileInput");
    dom.message = document.getElementById("message");
    dom.sectionNav = document.getElementById("sectionNav");
    dom.sectionTitle = document.getElementById("sectionTitle");
    dom.sectionHelp = document.getElementById("sectionHelp");
    dom.formRoot = document.getElementById("formRoot");
    dom.rawPanel = document.getElementById("rawPanel");
    dom.rawJson = document.getElementById("rawJson");
    dom.syncRawBtn = document.getElementById("syncRawBtn");
    dom.applyRawBtn = document.getElementById("applyRawBtn");
  }

  function bindEvents() {
    dom.resumeSelect.addEventListener("change", () => {
      setCurrentName(dom.resumeSelect.value);
      loadResume(state.currentName);
    });

    dom.resumeName.addEventListener("input", () => {
      setCurrentName(dom.resumeName.value, false);
    });

    dom.loadBtn.addEventListener("click", () => loadResume(state.currentName));
    dom.saveBtn.addEventListener("click", saveResume);
    dom.renderBtn.addEventListener("click", renderResume);
    dom.downloadBtn.addEventListener("click", downloadJson);
    dom.openFileBtn.addEventListener("click", () => dom.fileInput.click());
    dom.fileInput.addEventListener("change", openLocalJson);
    dom.syncRawBtn.addEventListener("click", () => {
      updateRawJson();
      renderTab("raw");
      setMessage("已同步到源码视图。", "ok");
    });
    dom.applyRawBtn.addEventListener("click", () => {
      if (syncRawToData()) {
        markDirty();
        renderTab("raw");
        setMessage("源码已应用到表单。", "ok");
      }
    });
  }

  async function detectBackend() {
    if (window.location.protocol === "file:") {
      setBackendStatus(false);
      return;
    }

    try {
      const result = await requestJson("/api/resumes");
      state.backend = true;
      state.names = Array.isArray(result.names) && result.names.length ? result.names : [...FALLBACK_NAMES];
      setBackendStatus(true);
    } catch (error) {
      state.backend = false;
      state.names = [...FALLBACK_NAMES];
      setBackendStatus(false);
    }
  }

  async function loadResume(name) {
    const safeName = sanitizeName(name);
    setCurrentName(safeName);
    try {
      const url = state.backend ? `/api/resumes/${encodeURIComponent(safeName)}` : `json/${encodeURIComponent(safeName)}.json`;
      state.data = await requestJson(url);
      ensureShape();
      markClean();
      renderTab(state.tab);
      setMessage(`已读取 ${safeName}.json。`, "ok");
    } catch (error) {
      if (!state.data) {
        state.data = createEmptyResume();
      }
      ensureShape();
      renderTab(state.tab);
      setMessage(`读取失败：${error.message}。可以点“打开本地 JSON”导入。`, "error");
    }
  }

  async function saveResume() {
    if (!syncRawToData()) return;
    const name = sanitizeName(state.currentName);
    setCurrentName(name);

    if (!state.backend) {
      downloadJson();
      setMessage("当前未连接本地后台，已改为下载 JSON。", "warn");
      return;
    }

    try {
      await requestJson(`/api/resumes/${encodeURIComponent(name)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state.data),
      });
      addResumeName(name);
      markClean();
      setMessage(`已保存 json/${name}.json。`, "ok");
    } catch (error) {
      setMessage(`保存失败：${error.message}`, "error");
    }
  }

  async function renderResume() {
    if (!syncRawToData()) return;
    const name = sanitizeName(state.currentName);
    setCurrentName(name);

    if (!state.backend) {
      setMessage(`生成 HTML 需要运行本地后台，或在终端执行 python render.py ${name}。`, "warn");
      return;
    }

    try {
      const result = await requestJson("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      dom.previewLink.href = result.url || `${name}/`;
      setMessage(`已生成 ${result.path || `${name}/index.html`}。`, "ok");
    } catch (error) {
      setMessage(`生成失败：${error.message}`, "error");
    }
  }

  function openLocalJson() {
    const file = dom.fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        state.data = JSON.parse(String(reader.result || "{}"));
        ensureShape();
        const name = sanitizeName(file.name.replace(/\.json$/i, ""));
        setCurrentName(name);
        addResumeName(name);
        markDirty();
        renderTab(state.tab);
        setMessage(`已打开 ${file.name}，保存时会下载或写回 ${name}.json。`, "ok");
      } catch (error) {
        setMessage(`JSON 解析失败：${error.message}`, "error");
      } finally {
        dom.fileInput.value = "";
      }
    });
    reader.readAsText(file, "utf-8");
  }

  function downloadJson() {
    if (!syncRawToData()) return;
    const name = sanitizeName(state.currentName);
    const jsonText = `${JSON.stringify(state.data, null, 2)}\n`;
    const blob = new Blob([jsonText], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, { cache: "no-store", ...options });
    const text = await response.text();
    let body = {};
    if (text) {
      try {
        body = JSON.parse(text);
      } catch (error) {
        throw new Error(text.slice(0, 160) || response.statusText);
      }
    }
    if (!response.ok) {
      throw new Error(body.error || response.statusText);
    }
    return body;
  }

  function renderSectionNav() {
    dom.sectionNav.innerHTML = "";
    SECTIONS.forEach((section) => {
      const item = makeButton(section.title, "", () => renderTab(section.id));
      item.dataset.tab = section.id;
      dom.sectionNav.appendChild(item);
    });
  }

  function renderTab(tabId = state.tab) {
    const section = SECTIONS.find((item) => item.id === tabId) || SECTIONS[0];
    state.tab = section.id;
    ensureShape();

    dom.sectionTitle.textContent = section.title;
    dom.sectionHelp.textContent = section.help;
    dom.applyRawBtn.classList.toggle("hidden", section.id !== "raw");

    [...dom.sectionNav.querySelectorAll("button")].forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === section.id);
    });

    if (section.id === "raw") {
      dom.formRoot.classList.add("hidden");
      dom.rawPanel.classList.remove("hidden");
      updateRawJson();
      return;
    }

    dom.rawPanel.classList.add("hidden");
    dom.formRoot.classList.remove("hidden");
    dom.formRoot.innerHTML = "";
    appendMany(dom.formRoot, section.render());
  }

  function renderBasics() {
    const header = state.data.header;
    return [
      sectionBlock("站点", [
        div("grid-2", [
          textField("页面标题", state.data, "title", { placeholder: "简历标题" }),
          imageField("浏览器图标路径", state.data, "ico", { accept: "image/*" }),
        ]),
      ]),
      sectionBlock("顶部左侧按钮", [
        arrayEditor("左侧按钮", header.navLeft, () => ({ name: "新按钮", url: "#" }), (item) => [
          div("grid-2", [
            textField("按钮文字", item, "name"),
            textField("链接", item, "url", { placeholder: "assets/pdf/resume.pdf" }),
          ]),
        ]),
      ]),
      sectionBlock("导航菜单", [
        arrayEditor("导航项", header.navRight, () => ({ text: "新菜单", url: "#home" }), (item) => [
          div("grid-2", [
            textField("文字", item, "text"),
            textField("锚点", item, "url", { placeholder: "#home" }),
          ]),
        ]),
      ]),
    ];
  }

  function renderHome() {
    const home = state.data.home;
    return [
      sectionBlock("首页内容", [
        imageField("头像或主图", home, "img"),
        div("grid-2", [
          textField("主标题", home.personal_info, "title"),
          textField("副标题", home.personal_info, "nickname"),
        ]),
        textField("简介", home.personal_info, "description", {
          multiline: true,
          hint: "支持 <br>、<a>、&emsp; 等少量 HTML。",
        }),
        div("grid-2", [
          textField("按钮文字", home.cta_button, "text"),
          textField("按钮图标 class", home.cta_button, "icon", { placeholder: "uil uil-message" }),
        ]),
        div("grid-2", [
          textField("滚动提示文字", home.scroll_message, "name"),
          textField("滚动提示链接", home.scroll_message, "url", { placeholder: "#about" }),
        ]),
      ]),
      sectionBlock("社交链接", [
        arrayEditor("社交链接", home.social_links, () => ({ name: "新链接", url: "", icon: "uil uil-link" }), (item) => [
          div("grid-3", [
            textField("名称", item, "name"),
            textField("链接", item, "url"),
            textField("图标 class 或图片路径", item, "icon", { placeholder: "uil uil-github-alt 或 assets/img/gitee.svg" }),
          ]),
        ]),
      ]),
    ];
  }

  function renderAbout() {
    const about = state.data.about;
    return [
      sectionBlock("标题和图片", [
        div("grid-2", [
          textField("区块标题", about, "about_title"),
          textField("区块副标题", about, "about_subtitle"),
        ]),
        imageField("个人照片", about, "about_image"),
      ]),
      sectionBlock("简介段落", [
        arrayEditor("段落", about.about_description, () => "", (_item, index) => [
          valueField("段落内容", about.about_description, index, {
            multiline: true,
            hint: "每一项会自动换行；可保留 &emsp;、<br> 等 HTML。",
          }),
        ]),
      ]),
      sectionBlock("关键经历", [
        arrayEditor("关键经历", about.experience, () => ({ years: "1+", name: "新经历" }), (item) => [
          div("grid-2", [
            textField("数字或年限", item, "years"),
            textField("说明", item, "name"),
          ]),
        ]),
      ]),
      sectionBlock("附件", [
        div("grid-2", [
          textField("简历 PDF 路径", about, "resume_link", { placeholder: "assets/pdf/resume.pdf" }),
          textField("下载按钮文字", about, "download_resume_text"),
        ]),
      ]),
    ];
  }

  function renderSkills() {
    const skills = state.data.skills;
    return [
      sectionBlock("标题", [
        div("grid-2", [
          textField("区块标题", skills, "skills_title"),
          textField("区块副标题", skills, "skills_subtitle"),
        ]),
      ]),
      sectionBlock("技能分组", [
        arrayEditor(
          "技能分组",
          skills.skill_groups,
          () => ({ title: "新分组", subtitle: "", icon: "uil uil-brackets-curly", skills: [] }),
          (group) => [
            div("grid-3", [
              textField("分组标题", group, "title"),
              textField("分组副标题", group, "subtitle"),
              textField("图标 class", group, "icon"),
            ]),
            arrayEditor("技能项", ensureItemArray(group, "skills"), () => ({ name: "新技能", percentage: "80%", class: "custom" }), (skill) => [
              div("grid-3", [
                textField("技能名称", skill, "name"),
                textField("百分比", skill, "percentage", { placeholder: "80%" }),
                textField("样式 class", skill, "class", { placeholder: "python" }),
              ]),
            ]),
          ],
        ),
      ]),
    ];
  }

  function renderQualification() {
    const qualification = state.data.qualification;
    return [
      sectionBlock("标题", [
        div("grid-2", [
          textField("区块标题", qualification, "qualification_title"),
          textField("区块副标题", qualification, "qualification_subtitle"),
        ]),
      ]),
      sectionBlock("时间线", [
        arrayEditor(
          "经历分类",
          qualification.content,
          () => ({ title: "新分类", icon: "uil uil-briefcase-alt", id: `section-${Date.now()}`, details: [] }),
          (group) => [
            div("grid-3", [
              textField("分类标题", group, "title"),
              textField("图标 class", group, "icon"),
              textField("分类 ID", group, "id", { placeholder: "education" }),
            ]),
            arrayEditor("经历条目", ensureItemArray(group, "details"), () => ({ title: "新经历", subtitle: "", dates: "" }), (item) => [
              div("grid-3", [
                textField("标题", item, "title"),
                textField("副标题", item, "subtitle"),
                textField("日期", item, "dates", { placeholder: "2024 - 2025" }),
              ]),
            ]),
          ],
        ),
      ]),
    ];
  }

  function renderProjects() {
    const project = state.data.project;
    return [
      sectionBlock("标题", [
        div("grid-2", [
          textField("区块标题", project, "portfolio_title"),
          textField("区块副标题", project, "portfolio_subtitle", {
            hint: "支持 <a> 等少量 HTML。",
          }),
        ]),
      ]),
      sectionBlock("项目列表", [
        arrayEditor("项目", project.projects, () => ({
          image_path: "assets/img/portfolio1.jpg",
          alt: "项目图片",
          title: "新项目",
          description: "",
          link: "",
          button_text: "立即访问",
        }), (item) => [
          imageField("项目图片", item, "image_path"),
          div("grid-2", [
            textField("图片 alt", item, "alt"),
            textField("项目标题", item, "title"),
          ]),
          textField("项目描述", item, "description", {
            multiline: true,
            hint: "支持 <br>、<a> 等少量 HTML。",
          }),
          div("grid-2", [
            textField("项目链接", item, "link"),
            textField("按钮文字", item, "button_text"),
          ]),
        ]),
      ]),
    ];
  }

  function renderContact() {
    const contact = state.data.contact;
    return [
      sectionBlock("标题", [
        div("grid-2", [
          textField("区块标题", contact, "contact_title"),
          textField("区块副标题", contact, "contact_subtitle"),
        ]),
      ]),
      sectionBlock("联系方式", [
        arrayEditor("联系方式", contact.contact_info, () => ({ icon: "uil-envelope", title: "Email", subtitle: "" }), (item) => [
          div("grid-3", [
            textField("图标 class", item, "icon", { placeholder: "uil-envelope" }),
            textField("标题", item, "title"),
            textField("内容", item, "subtitle"),
          ]),
        ]),
      ]),
    ];
  }

  function renderFooter() {
    const footer = state.data.footer;
    return [
      sectionBlock("底部标题", [
        div("grid-2", [
          textField("标题", footer, "more_info_title"),
          textField("副标题", footer, "more_info_subtitle"),
        ]),
        div("grid-2", [
          textField("版权", footer, "copyright"),
          textField("备案号", footer, "beian"),
        ]),
      ]),
      sectionBlock("页脚链接", [
        arrayEditor("链接列", footer.links, () => [{ text: "新分组", url: "" }], (column, columnIndex) => {
          if (!Array.isArray(column)) {
            footer.links[columnIndex] = [];
          }
          return arrayEditor("本列链接", footer.links[columnIndex], () => ({ text: "新链接", url: "" }), (item) => [
            div("grid-2", [
              textField("文字", item, "text"),
              textField("链接", item, "url", { placeholder: "留空则作为标题" }),
            ]),
          ]);
        }),
      ]),
      sectionBlock("社交图标", [
        arrayEditor("社交图标", footer.social_media, () => ({ icon: "uil uil-github-alt", url: "" }), (item) => [
          div("grid-2", [
            textField("图标 class 或图片路径", item, "icon"),
            textField("链接", item, "url"),
          ]),
        ]),
      ]),
      sectionBlock("致谢", [
        arrayEditor("致谢链接", footer.credits, () => ({ name: "Name", url: "" }), (item) => [
          div("grid-2", [
            textField("名称", item, "name"),
            textField("链接", item, "url"),
          ]),
        ]),
      ]),
    ];
  }

  function textField(label, object, key, options = {}) {
    const input = options.multiline ? document.createElement("textarea") : document.createElement("input");
    if (!options.multiline) input.type = "text";
    if (options.placeholder) input.placeholder = options.placeholder;
    if (options.rows) input.rows = options.rows;
    input.value = object[key] ?? "";
    input.addEventListener("input", () => {
      object[key] = input.value;
      markDirty();
    });
    return fieldShell(label, input, options.hint);
  }

  function valueField(label, array, index, options = {}) {
    const input = options.multiline ? document.createElement("textarea") : document.createElement("input");
    if (!options.multiline) input.type = "text";
    input.value = array[index] ?? "";
    input.addEventListener("input", () => {
      array[index] = input.value;
      markDirty();
    });
    return fieldShell(label, input, options.hint);
  }

  function imageField(label, object, key, options = {}) {
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "assets/img/example.png 或 https://...";
    input.value = object[key] ?? "";

    const preview = document.createElement("img");
    preview.className = "media-preview";
    preview.alt = label;
    preview.src = input.value || "";

    input.addEventListener("input", () => {
      object[key] = input.value;
      preview.src = input.value;
      markDirty();
    });

    const uploadInput = document.createElement("input");
    uploadInput.type = "file";
    uploadInput.accept = options.accept || "image/*";
    uploadInput.hidden = true;

    const uploadButton = makeButton("上传图片", "", () => uploadInput.click());
    uploadButton.disabled = !state.backend;
    uploadButton.title = state.backend ? "上传到 assets/img/uploads/" : "上传需要运行 python admin.py";
    uploadInput.addEventListener("change", async () => {
      const file = uploadInput.files[0];
      if (!file) return;
      try {
        const path = await uploadImage(file);
        object[key] = path;
        input.value = path;
        preview.src = path;
        markDirty();
        setMessage(`已上传图片：${path}`, "ok");
      } catch (error) {
        setMessage(`上传失败：${error.message}`, "error");
      } finally {
        uploadInput.value = "";
      }
    });

    const controls = div("", [
      input,
      div("button-row", [uploadButton]),
      uploadInput,
    ]);
    return fieldShell(label, div("media-field", [controls, preview]));
  }

  function fieldShell(label, control, hint = "") {
    return div("field", [
      create("label", {}, [label]),
      control,
      hint ? create("p", { class: "hint" }, [hint]) : null,
    ]);
  }

  function sectionBlock(title, children) {
    return div("section-block", [
      create("h3", {}, [title]),
      ...flatten(children),
    ]);
  }

  function arrayEditor(title, items, createItem, renderItem) {
    const block = div("array-block");
    const count = create("span", { class: "array-count" }, [`${items.length} 项`]);
    const addButton = makeButton("新增", "primary", () => {
      items.push(createItem());
      markDirty();
      renderTab();
    });

    appendMany(block, [
      div("array-header", [
        create("h3", {}, [title, " ", count]),
        addButton,
      ]),
    ]);

    if (!items.length) {
      block.appendChild(create("div", { class: "empty" }, ["暂无内容，点击“新增”添加。"]));
      return block;
    }

    items.forEach((item, index) => {
      const itemTitle = create("strong", {}, [`${title} ${index + 1}`]);
      const actions = div("item-actions", [
        makeButton("上移", "", () => moveItem(items, index, -1), index === 0),
        makeButton("下移", "", () => moveItem(items, index, 1), index === items.length - 1),
        makeButton("复制", "", () => {
          items.splice(index + 1, 0, clone(item));
          markDirty();
          renderTab();
        }),
        makeButton("删除", "danger", () => {
          if (!window.confirm("确认删除这一项？")) return;
          items.splice(index, 1);
          markDirty();
          renderTab();
        }),
      ]);

      const card = div("list-item", [
        div("item-header", [itemTitle, actions]),
        ...flatten(renderItem(item, index)),
      ]);
      block.appendChild(card);
    });

    return block;
  }

  function moveItem(items, index, direction) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= items.length) return;
    [items[index], items[nextIndex]] = [items[nextIndex], items[index]];
    markDirty();
    renderTab();
  }

  async function uploadImage(file) {
    const dataUrl = await readFileAsDataUrl(file);
    const result = await requestJson("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dataUrl,
        filename: file.name,
        folder: sanitizeName(state.currentName),
      }),
    });
    return result.path;
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(reader.result));
      reader.addEventListener("error", () => reject(reader.error));
      reader.readAsDataURL(file);
    });
  }

  function ensureShape() {
    const data = state.data || createEmptyResume();
    state.data = data;
    if (!data.title) data.title = "";
    if (!data.ico) data.ico = "./assets/img/favicon.ico";

    const header = ensureObject(data, "header");
    ensureArray(header, "navLeft");
    ensureArray(header, "navRight");

    const home = ensureObject(data, "home");
    ensureArray(home, "social_links");
    ensureObject(home, "personal_info");
    ensureObject(home, "cta_button");
    ensureObject(home, "scroll_message");

    const about = ensureObject(data, "about");
    ensureArray(about, "about_description");
    ensureArray(about, "experience");

    const skills = ensureObject(data, "skills");
    ensureArray(skills, "skill_groups");
    skills.skill_groups.forEach((group) => ensureArray(group, "skills"));

    const qualification = ensureObject(data, "qualification");
    ensureArray(qualification, "content");
    qualification.content.forEach((group) => ensureArray(group, "details"));

    const project = ensureObject(data, "project");
    ensureArray(project, "projects");

    const contact = ensureObject(data, "contact");
    ensureArray(contact, "contact_info");

    const footer = ensureObject(data, "footer");
    ensureArray(footer, "links");
    footer.links = footer.links.map((column) => (Array.isArray(column) ? column : []));
    ensureArray(footer, "social_media");
    ensureArray(footer, "credits");
  }

  function createEmptyResume() {
    return {
      title: "",
      ico: "./assets/img/favicon.ico",
      header: { navLeft: [], navRight: [] },
      home: {
        img: "",
        social_links: [],
        personal_info: { title: "", nickname: "", description: "" },
        cta_button: { text: "Contact Me", icon: "uil uil-message" },
        scroll_message: { name: "往下滑", url: "#about" },
      },
      about: {
        about_title: "个人简介",
        about_subtitle: "关于我",
        about_image: "",
        about_description: [],
        experience: [],
        resume_link: "",
        download_resume_text: "下载我的简历",
      },
      skills: { skills_title: "我的技能", skills_subtitle: "", skill_groups: [] },
      qualification: { qualification_title: "个人经历", qualification_subtitle: "", content: [] },
      project: { portfolio_title: "我的作品集", portfolio_subtitle: "", projects: [] },
      contact: { contact_title: "联系我", contact_subtitle: "", contact_info: [] },
      footer: { more_info_title: "", more_info_subtitle: "", links: [], social_media: [], copyright: "", beian: "", credits: [] },
    };
  }

  function ensureObject(parent, key) {
    if (!parent[key] || typeof parent[key] !== "object" || Array.isArray(parent[key])) {
      parent[key] = {};
    }
    return parent[key];
  }

  function ensureArray(parent, key) {
    if (!Array.isArray(parent[key])) {
      parent[key] = [];
    }
    return parent[key];
  }

  function ensureItemArray(item, key) {
    if (!Array.isArray(item[key])) {
      item[key] = [];
    }
    return item[key];
  }

  function updateRawJson() {
    dom.rawJson.value = JSON.stringify(state.data, null, 2);
  }

  function syncRawToData() {
    if (state.tab !== "raw") return true;
    try {
      state.data = JSON.parse(dom.rawJson.value || "{}");
      ensureShape();
      return true;
    } catch (error) {
      setMessage(`JSON 格式错误：${error.message}`, "error");
      return false;
    }
  }

  function populateResumeSelect(names) {
    dom.resumeSelect.innerHTML = "";
    names.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = `${name}.json`;
      dom.resumeSelect.appendChild(option);
    });
    dom.resumeSelect.value = state.currentName;
  }

  function addResumeName(name) {
    if (!state.names.includes(name)) {
      state.names.push(name);
      state.names.sort();
      populateResumeSelect(state.names);
    }
    dom.resumeSelect.value = name;
  }

  function setCurrentName(name, syncSelect = true) {
    const safeName = sanitizeName(name);
    state.currentName = safeName;
    dom.resumeName.value = safeName;
    if (syncSelect && state.names.includes(safeName)) {
      dom.resumeSelect.value = safeName;
    }
    dom.previewLink.href = `${safeName}/`;
  }

  function sanitizeName(name) {
    const safe = String(name || "").trim().replace(/[^A-Za-z0-9_-]/g, "");
    return safe || "resume";
  }

  function markDirty() {
    state.dirty = true;
    dom.dirtyStatus.textContent = "有未保存修改";
    dom.dirtyStatus.className = "badge warn";
  }

  function markClean() {
    state.dirty = false;
    dom.dirtyStatus.textContent = "已保存状态";
    dom.dirtyStatus.className = "badge ok";
  }

  function setBackendStatus(connected) {
    state.backend = connected;
    dom.backendStatus.textContent = connected ? "本地后台已连接" : "纯静态模式";
    dom.backendStatus.className = connected ? "badge ok" : "badge warn";
  }

  function setMessage(text, type = "") {
    dom.message.textContent = text;
    dom.message.className = `hint message ${type}`.trim();
  }

  function makeButton(label, className, onClick, disabled = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    if (className) button.className = className;
    button.disabled = disabled;
    button.addEventListener("click", onClick);
    return button;
  }

  function div(className = "", children = []) {
    return create("div", className ? { class: className } : {}, children);
  }

  function create(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      if (key === "class") {
        node.className = value;
      } else {
        node.setAttribute(key, value);
      }
    });
    appendMany(node, children);
    return node;
  }

  function appendMany(parent, children) {
    flatten(children).forEach((child) => {
      if (child === null || child === undefined) return;
      if (child instanceof Node) {
        parent.appendChild(child);
      } else {
        parent.appendChild(document.createTextNode(String(child)));
      }
    });
    return parent;
  }

  function flatten(value) {
    return Array.isArray(value) ? value.flat(Infinity) : [value];
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
})();
