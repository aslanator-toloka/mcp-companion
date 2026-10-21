export function fitNativeCards(root = document) {
  root.querySelectorAll(".sc-card-stage").forEach((stage) => {
    const card = stage.querySelector(".sc-card"),
      panel = stage.querySelector(".sc-rules-panel"),
      content = stage.querySelector(".sc-rules-content");
    if (!card) return;
    const width = Number(stage.dataset.nativeWidth),
      height = Number(stage.dataset.nativeHeight);
    const surface = stage.closest(".stat-card-surface"),
      available = surface?.clientWidth || width;
    const scale = Math.min(
      1,
      Math.min(1050, Math.max(available, width === 1200 ? 900 : 0)) / width,
    );
    stage.style.width = width * scale + "px";
    stage.style.height = height * scale + "px";
    card.style.transform = `scale(${scale})`;
    card.style.height = height + "px";
    for (const title of stage.querySelectorAll(
      ".sc-identity h3,.sc-identity p",
    )) {
      if (
        title.classList.contains("sc-name-styled") ||
        title.parentElement.classList.contains("sc-identity-alternative")
      )
        continue;
      const start =
        title.tagName === "H3" ? Number(title.dataset.nameFont || 35) : 24;
      title.style.whiteSpace = "normal";
      title.style.lineHeight = title.tagName === "H3" ? start + "px" : "24px";
      title.style.fontSize = start + "px";
      for (
        let size = start;
        size >= 12 &&
        (title.scrollWidth > title.clientWidth + 1 ||
          title.scrollHeight > (title.tagName === "H3" ? 50 : 26));
        size--
      ) {
        title.style.fontSize = size + "px";
        if (title.tagName === "H3") title.style.lineHeight = size + "px";
      }
    }
    if (!panel || !content) return;
    panel.style.height = "";
    content.style.transform = "";
    content.style.width = "100%";
    content.style.minHeight = "0";
    const budget =
      panel.clientHeight -
      parseFloat(getComputedStyle(panel).paddingTop) -
      parseFloat(getComputedStyle(panel).paddingBottom);
    const leading = Number(content.dataset.ruleLeading || 20.8);
    content.style.gap = "20px";
    content.style.fontSize = "22px";
    content.style.lineHeight = leading + "px";
    for (const gap of [20, 16, 12, 8, 4, 0]) {
      content.style.gap = gap + "px";
      if (content.scrollHeight <= budget + 1) break;
    }
    for (const size of [22, 21, 20, 19, 18]) {
      content.style.fontSize = size + "px";
      content.style.lineHeight = (size * leading) / 22 + "px";
      if (content.scrollHeight <= budget + 1) break;
    }
    content.querySelectorAll(".sc-ability-heading h4").forEach((title) => {
      title.style.fontSize = "28px";
      for (
        let size = 28;
        size >= 16 && title.scrollWidth > title.clientWidth + 1;
        size--
      )
        title.style.fontSize = size + "px";
    });
    // Preserve the original card ratio even for unusually dense rules.
    if (content.scrollHeight > budget + 1) {
      let low = 0.4,
        high = 1;
      for (let i = 0; i < 12; i++) {
        const ratio = (low + high) / 2;
        content.style.width = 100 / ratio + "%";
        if (content.scrollHeight * ratio <= budget) low = ratio;
        else high = ratio;
      }
      content.style.width = 100 / low + "%";
      content.style.transform = `scale(${low})`;
    }
  });
}

export function fitNativeGameCards(root = document) {
  root.querySelectorAll(".gc-stage").forEach((stage) => {
    const card = stage.querySelector(".gc-card");
    if (!card) return;
    const width = Number(stage.dataset.gameWidth),
      height = Number(stage.dataset.gameHeight),
      available = stage.closest(".gc-surface")?.clientWidth || width;
    const heightLimit = stage.closest(".battle-tactic-card")
      ? 1
      : Math.max(240, innerHeight - 155) / height;
    const scale = Math.min(1, available / width, heightLimit);
    stage.style.width = width * scale + "px";
    stage.style.height = height * scale + "px";
    card.style.transform = `scale(${scale})`;
    const title = card.querySelector(
      ".gc-tactic-title h2,.gc-crisis-heading h2",
    );
    if (title) {
      const base = stage.dataset.gameKind === "crises" ? 28 : 30,
        maxHeight = stage.dataset.gameKind === "crises" ? 69 : 58;
      title.style.fontSize = base + "px";
      for (
        let size = base;
        size >= 18 &&
        (title.scrollHeight > maxHeight ||
          title.scrollWidth > title.clientWidth + 1);
        size--
      )
        title.style.fontSize = size + "px";
    }
    const text = card.querySelector(".gc-tactic-content,.gc-crisis-rules");
    if (!text) return;
    const initial =
      stage.dataset.gameKind === "tactics"
        ? card.classList.contains("gc-squished")
          ? 18
          : 20
        : 16;
    text.style.fontSize = initial + "px";
    text.style.lineHeight = initial * 1.04 + "px";
    const overflows = () => {
      const bounds = card.getBoundingClientRect();
      return [
        ...card.querySelectorAll(
          "h2,h3,.gc-tactic-text,.gc-setup-scoring,.gc-crisis-paragraphs,.sc-ability,.gc-map,footer",
        ),
      ].some((el) => el.getBoundingClientRect().bottom > bounds.bottom + 1);
    };
    for (let size = initial; size >= 12 && overflows(); size--) {
      text.style.fontSize = size + "px";
      text.style.lineHeight = size * 1.04 + "px";
    }
  });
}
