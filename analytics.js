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

  // Send event (simulated YTM logging)
  function sendEvent(action, payload = {}) {
    const eventData = {
      action,
      ...payload,
      ...getUTMs(),
      timestamp: new Date().toISOString()
    };
    
    // YTM stub simulation
    console.log(`[YTM Event] action: ${action}`, eventData);
    
    // In real app: window.dataLayer = window.dataLayer || []; window.dataLayer.push(eventData);
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
