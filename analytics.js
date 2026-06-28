'use strict';

/**
 * Analytics Module — handles UTM parsing and logging YTM events.
 */
const Analytics = (() => {
  // Parse UTMs and store in localStorage
  function parseUTMs() {
    const params = new URLSearchParams(window.location.search);
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    let hasUTM = false;
    const utmData = {};

    utmKeys.forEach(key => {
      if (params.has(key)) {
        utmData[key] = params.get(key);
        hasUTM = true;
      }
    });

    if (hasUTM) {
      localStorage.setItem('tochilka_utm', JSON.stringify(utmData));
      console.log('[Analytics] UTM params saved:', utmData);
    }
  }

  function getUTMs() {
    try {
      return JSON.parse(localStorage.getItem('tochilka_utm')) || {};
    } catch {
      return {};
    }
  }

  // Send event (Yandex.Metrica integration)
  function sendEvent(action, payload = {}) {
    try {
      const eventData = {
        action,
        ...payload,
        ...getUTMs(),
        timestamp: new Date().toISOString()
      };
      
      console.log(`[YTM Event] action: ${action}`, eventData);

      let targetName = null;
      switch (action) {
        case 'save-class':
          targetName = 'add_class';
          break;
        case 'print-selected':
        case 'print-blank':
          targetName = 'print_materials';
          break;
        case 'start-teacher-check':
        case 'start-self-check':
          targetName = 'start_check';
          break;
        case 'save-check-result':
          targetName = 'save_result';
          break;
        case 'print-cards':
        case 'print-single-card':
          targetName = 'print_reports';
          break;
        case 'export-csv':
          targetName = 'export_csv';
          break;
      }

      if (targetName && typeof ym === 'function') {
        ym(110228295, 'reachGoal', targetName, eventData);
      }
    } catch (e) {
      console.error('[Analytics] Error sending event:', e);
    }
  }

  // Bind global click listener for elements with data-action
  function bindActionTracking() {
    document.body.addEventListener('click', (e) => {
      // Find closest element with data-action attribute
      const el = e.target.closest('[data-action]');
      if (el) {
        const action = el.getAttribute('data-action');
        // Extract optional additional data from data-* attributes
        const dataset = { ...el.dataset };
        delete dataset.action; // Remove the action itself
        
        sendEvent(action, dataset);
      }
    });
  }

  function init() {
    parseUTMs();
    bindActionTracking();
  }

  return { init, sendEvent, getUTMs };
})();

document.addEventListener('DOMContentLoaded', Analytics.init);
