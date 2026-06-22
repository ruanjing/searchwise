(function () {
  'use strict';

  let tooltip = null;
  let tooltipTimer = null;

  async function init() {
    if (!chrome.runtime?.id) return;
    try {
      const response = await chrome.runtime.sendMessage({ type: 'LIST_CLIPS', filters: {} });
      if (response) {
        highlightPageClips(response);
      }
    } catch (e) {
      console.warn('GrowthVault failed to load page highlights:', e);
    }
  }

  function highlightPageClips(clips) {
    const currentUrl = window.location.href;
    const currentHost = window.location.hostname.toLowerCase().replace(/^www\./, '');

    const pageClips = clips.filter((clip) => {
      if (clip.url === currentUrl) return true;
      if (clip.domain && currentHost.includes(clip.domain.toLowerCase())) return true;
      return false;
    });

    pageClips.forEach((clip) => {
      highlightText(clip.text, clip);
    });
  }

  function highlightText(text, clip) {
    if (!text || text.trim().length < 3) return;

    const walk = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName.toLowerCase();
          if (['script', 'style', 'noscript', 'textarea', 'input'].includes(tag)) {
            return NodeFilter.FILTER_REJECT;
          }
          // Avoid double highlighting
          if (parent.classList.contains('growthvault-highlight')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textNodes = [];
    let node;
    while ((node = walk.nextNode())) {
      textNodes.push(node);
    }

    for (const node of textNodes) {
      const val = node.nodeValue || '';
      const index = val.indexOf(text);
      if (index !== -1) {
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + text.length);

        const span = document.createElement('span');
        span.className = 'growthvault-highlight';
        span.dataset.clipId = clip.id;
        span.style.backgroundColor = 'rgba(255, 235, 59, 0.35)';
        span.style.borderBottom = '2px dashed #fbc02d';
        span.style.cursor = 'pointer';

        try {
          range.surroundContents(span);
          span.addEventListener('mouseenter', (e) => showTooltip(e, clip));
          span.addEventListener('mouseleave', hideTooltip);
        } catch (e) {
          // If range spans nodes, surroundContents fails. Skip gracefully.
        }
      }
    }
  }

  function showTooltip(event, clip) {
    clearTimeout(tooltipTimer);
    if (tooltip) {
      tooltip.remove();
    }

    tooltip = document.createElement('div');
    tooltip.className = 'growthvault-tooltip';
    tooltip.style.position = 'fixed';
    tooltip.style.zIndex = '2147483647';
    tooltip.style.background = '#202124';
    tooltip.style.color = '#fff';
    tooltip.style.padding = '12px';
    tooltip.style.borderRadius = '8px';
    tooltip.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)';
    tooltip.style.fontFamily = 'Arial, sans-serif';
    tooltip.style.fontSize = '12px';
    tooltip.style.maxWidth = '320px';
    tooltip.style.pointerEvents = 'auto';

    const typeLabel = clip.type || 'Idea';

    tooltip.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 6px; color: #8ab4f8; display:flex; justify-content:space-between; align-items:center;">
        <span>GrowthVault (${typeLabel})</span>
        <button id="gv-tooltip-delete" style="background:none; border:none; color:#f28b82; cursor:pointer; font-size:11px; padding:0 4px; font-weight:600;">删除</button>
      </div>
      <div style="margin-bottom: 6px; white-space: pre-wrap; font-style: italic; color: #e8eaed;">"${escapeHtml(clip.text.slice(0, 150))}${clip.text.length > 150 ? '...' : ''}"</div>
      ${clip.note ? `<div style="border-top: 1px solid #3c4043; padding-top: 6px; color: #bdc1c6; margin-top:4px;">备注: ${escapeHtml(clip.note)}</div>` : ''}
    `;

    document.body.appendChild(tooltip);

    const rect = event.target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let top = rect.top - tooltipRect.height - 8;
    if (top < 8) {
      top = rect.bottom + 8;
    }

    let left = rect.left + (rect.width - tooltipRect.width) / 2;
    if (left < 8) left = 8;
    if (left + tooltipRect.width > window.innerWidth - 8) {
      left = window.innerWidth - tooltipRect.width - 8;
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;

    tooltip.querySelector('#gv-tooltip-delete').addEventListener('click', async () => {
      if (confirm('确定要删除这条素材吗？')) {
        await chrome.runtime.sendMessage({ type: 'DELETE_CLIP', clipId: clip.id });
        const parent = event.target.parentNode;
        if (parent) {
          while (event.target.firstChild) {
            parent.insertBefore(event.target.firstChild, event.target);
          }
          event.target.remove();
        }
        hideTooltip();
      }
    });

    tooltip.addEventListener('mouseenter', () => {
      clearTimeout(tooltipTimer);
    });
    tooltip.addEventListener('mouseleave', () => {
      hideTooltip();
    });
  }

  function hideTooltip() {
    clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(() => {
      if (tooltip) {
        tooltip.remove();
        tooltip = null;
      }
    }, 150);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Run on page load after brief delay
  if (document.readyState === 'complete') {
    setTimeout(init, 500);
  } else {
    window.addEventListener('load', () => setTimeout(init, 500));
  }
})();
