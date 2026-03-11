const BASE_FONT = "Georgia, serif";

let topWindowDepth = 1200;

export function buildModalShell({ title, subtitle, width, iconKey, body, footer = "" }) {
  return `
    <div data-modal-shell style="width: ${width}px; min-width: 360px; min-height: 240px; display: grid; grid-template-rows: auto 1fr auto; gap: 12px; padding: 18px; border: 1px solid rgba(235, 230, 196, 0.24); border-radius: 22px; background: linear-gradient(180deg, rgba(12, 24, 19, 0.96), rgba(8, 17, 14, 0.92)); box-shadow: 0 22px 60px rgba(0, 0, 0, 0.38); color: #f6f2df; font-family: ${BASE_FONT}; backdrop-filter: blur(4px); position: relative; overflow: hidden;">
      <div data-modal-drag-handle style="display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center; cursor: move; user-select: none; padding-right: 8px;">
        ${iconKey ? `<img src="${iconKey}" alt="" style="width: 36px; height: 36px; filter: drop-shadow(0 6px 10px rgba(0,0,0,0.28)); pointer-events: none;" />` : ""}
        <div style="display: grid; gap: 4px; pointer-events: none;">
          <strong style="font-size: 24px; letter-spacing: 0.2px;">${title}</strong>
          <span style="font-size: 13px; color: #b7d2c2; line-height: 1.35;">${subtitle}</span>
        </div>
        <button type="button" data-action="close-window" data-no-drag="true" aria-label="Close window" style="width: 34px; height: 34px; border: 1px solid rgba(215, 196, 110, 0.35); border-radius: 10px; background: rgba(34, 54, 45, 0.92); color: #f6f2df; font-size: 18px; cursor: pointer;">×</button>
      </div>
      <div data-modal-body style="display: grid; gap: 12px; min-height: 0; overflow: auto; padding-right: 4px;">${body}</div>
      <div data-modal-footer>${footer}</div>
      <div data-modal-resize-handle data-no-drag="true" title="Resize window" style="position: absolute; right: 8px; bottom: 8px; width: 18px; height: 18px; cursor: nwse-resize; background: linear-gradient(135deg, transparent 0 42%, rgba(215, 196, 110, 0.78) 42% 56%, transparent 56% 100%); opacity: 0.88;"></div>
    </div>
  `;
}

export function attachModalWindowBehavior(root, options = {}) {
  const host = root.node;
  const shell = host.querySelector("[data-modal-shell]") ?? host;
  const dragHandle = shell.querySelector("[data-modal-drag-handle]");
  const resizeHandle = shell.querySelector("[data-modal-resize-handle]");
  const minWidth = options.minWidth ?? 380;
  const minHeight = options.minHeight ?? 260;
  const maxWidth = options.maxWidth ?? 920;
  const maxHeight = options.maxHeight ?? 760;
  const state = {
    dragging: false,
    resizing: false,
    startMouseX: 0,
    startMouseY: 0,
    startX: root.x,
    startY: root.y,
    startWidth: 0,
    startHeight: 0,
    activePointerId: null,
  };

  function applySize(width, height) {
    const boundedWidth = Math.max(minWidth, Math.min(maxWidth, width));
    const boundedHeight = Math.max(minHeight, Math.min(maxHeight, height));
    host.style.width = `${boundedWidth}px`;
    host.style.height = `${boundedHeight}px`;
    shell.style.width = `${boundedWidth}px`;
    shell.style.height = `${boundedHeight}px`;
    shell.style.boxSizing = "border-box";
  }

  function bringToFront() {
    topWindowDepth += 1;
    root.setDepth(topWindowDepth);
  }

  function handlePointerMove(event) {
    if (state.activePointerId !== null && event.pointerId !== state.activePointerId) {
      return;
    }

    if (state.dragging) {
      root.x = state.startX + (event.clientX - state.startMouseX);
      root.y = state.startY + (event.clientY - state.startMouseY);
      return;
    }

    if (state.resizing) {
      const nextWidth = Math.max(minWidth, Math.min(maxWidth, state.startWidth + (event.clientX - state.startMouseX)));
      const nextHeight = Math.max(minHeight, Math.min(maxHeight, state.startHeight + (event.clientY - state.startMouseY)));
      shell.style.width = `${nextWidth}px`;
      shell.style.height = `${nextHeight}px`;
      host.style.width = `${nextWidth}px`;
      host.style.height = `${nextHeight}px`;
    }
  }

  function stopInteractions() {
    state.dragging = false;
    state.resizing = false;
    state.activePointerId = null;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", stopInteractions);
    window.removeEventListener("pointercancel", stopInteractions);
  }

  dragHandle?.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || target.closest("[data-no-drag='true']")) {
      return;
    }

    event.preventDefault();
    bringToFront();
    state.dragging = true;
    state.activePointerId = event.pointerId;
    state.startMouseX = event.clientX;
    state.startMouseY = event.clientY;
    state.startX = root.x;
    state.startY = root.y;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopInteractions);
    window.addEventListener("pointercancel", stopInteractions);
  });

  resizeHandle?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    bringToFront();
    const rect = shell.getBoundingClientRect();
    state.resizing = true;
    state.activePointerId = event.pointerId;
    state.startMouseX = event.clientX;
    state.startMouseY = event.clientY;
    state.startWidth = rect.width;
    state.startHeight = rect.height;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopInteractions);
    window.addEventListener("pointercancel", stopInteractions);
  });

  shell.addEventListener("pointerdown", () => {
    bringToFront();
  });

  return {
    setSize(width, height) {
      applySize(width, height);
    },
    destroy() {
      stopInteractions();
    },
  };
}

export function modalSectionStyle() {
  return "display: grid; gap: 8px; padding: 12px; border-radius: 16px; background: rgba(16, 36, 28, 0.72); border: 1px solid rgba(111, 141, 124, 0.28);";
}

export function modalInputStyle() {
  return "padding: 10px 12px; border-radius: 10px; border: 1px solid #456557; background: #10241c; color: #f6f2df; font-family: Georgia, serif;";
}

export function modalButtonStyle(variant = "muted") {
  const palette = {
    primary: { background: "#d7c46e", color: "#08110e" },
    success: { background: "#4d8f6f", color: "#08110e" },
    warning: { background: "#e0ba63", color: "#08110e" },
    muted: { background: "#9aa9a1", color: "#08110e" },
    ghost: { background: "#22362d", color: "#f6f2df" },
  };
  const active = palette[variant] ?? palette.muted;
  return `padding: 10px 12px; border: none; border-radius: 10px; background: ${active.background}; color: ${active.color}; font-weight: 700; cursor: pointer; font-family: Georgia, serif;`;
}

export function modalInsetStyle() {
  return "padding: 12px; border-radius: 14px; background: rgba(12, 24, 19, 0.78); border: 1px solid rgba(111,141,124,0.24); font-size: 12px; color: #c6d6cb;";
}

export function modalBadgeStyle() {
  return "display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px; background: rgba(34,54,45,0.92); color: #d7e6da; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px;";
}