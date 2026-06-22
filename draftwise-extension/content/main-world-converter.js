// DraftWise - Main World Image Converter
(function() {
  'use strict';

  if (window.__draftwiseMainWorldConverterReady) return;
  window.__draftwiseMainWorldConverterReady = true;

  window.addEventListener('draftwise-convert-request', async (event) => {
    const { requestId, blobUrl, selector } = event.detail || {};
    if (!requestId) return;

    const result = await convertBlobOrSelectorToBase64(blobUrl, selector);
    
    const responseEvent = new CustomEvent('draftwise-convert-response', {
      detail: { requestId, ...result }
    });
    window.dispatchEvent(responseEvent);
  });

  async function convertBlobOrSelectorToBase64(blobUrl, selector) {
    if (blobUrl && blobUrl.startsWith('blob:')) {
      try {
        const response = await fetch(blobUrl);
        const blob = await response.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve({ success: true, base64: reader.result });
          reader.onerror = () => resolve({ error: 'FileReader failed' });
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.warn('Main world direct fetch of blobUrl failed:', e);
      }
    }

    if (selector) {
      const img = document.querySelector(selector);
      if (!img) return { error: 'Image not found by selector' };
      
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 300;
        canvas.height = img.naturalHeight || img.height || 300;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const base64 = canvas.toDataURL('image/png');
        if (base64 && base64.startsWith('data:image')) {
          return { success: true, base64 };
        }
      } catch (e) {
        console.warn('Main world canvas failed, trying fetch', e);
      }

      const src = img.getAttribute('src');
      if (src && (src.startsWith('blob:') || src.startsWith('data:'))) {
        try {
          const response = await fetch(src);
          const blob = await response.blob();
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve({ success: true, base64: reader.result });
            reader.onerror = () => resolve({ error: 'FileReader failed' });
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          return { error: 'Main world fetch failed: ' + e.message };
        }
      }
    }

    return { error: 'Unsupported parameters or image format' };
  }
})();
