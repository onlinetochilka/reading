'use strict';

/**
 * Assessment module — reading norms (ФГОС), result persistence, CSV export.
 * Exposed globally as window.Assessment.
 */
const Assessment = (() => {

  /**
   * Approximate ФГОС reading speed norms (words per minute).
   * h1 = 1st half-year (September–December)
   * h2 = 2nd half-year (January–May)
   * min  = lower boundary (acceptable)
   * good = target norm
   */
  const readingNorms = {
    1: { h1: { min: 25,  good: 30  }, h2: { min: 40,  good: 50  } },
    2: { h1: { min: 50,  good: 60  }, h2: { min: 70,  good: 80  } },
    3: { h1: { min: 70,  good: 80  }, h2: { min: 90,  good: 100 } },
    4: { h1: { min: 100, good: 110 }, h2: { min: 115, good: 120 } },
    5: { h1: { min: 120, good: 130 }, h2: { min: 130, good: 140 } },
  };

  /**
   * Return 'h1' or 'h2' based on current calendar month.
   * June–August is treated as h2 (end of school year norms).
   */
  function getCurrentHalf() {
    const month = new Date().getMonth() + 1; // 1–12
    return month >= 9 ? 'h1' : 'h2';
  }

  /**
   * Get norm object { min, good } for grade + half.
   * @param {number} grade
   * @param {string} [half]  'h1' | 'h2' — defaults to current
   * @returns {{ min: number, good: number } | null}
   */
  function getNorm(grade, half) {
    const h = half || getCurrentHalf();
    return readingNorms[grade]?.[h] ?? null;
  }

  /**
   * Compare wpm against grade norm.
   * @returns {'above' | 'normal' | 'below' | 'unknown'}
   */
  function compareWithNorm(wpm, grade) {
    const norm = getNorm(grade);
    if (!norm) return 'unknown';
    if (wpm >= norm.good) return 'above';
    if (wpm >= norm.min)  return 'normal';
    return 'below';
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  function _load() {
    try { return JSON.parse(localStorage.getItem('tochilka_results')) || []; }
    catch { return []; }
  }

  function _save(results) {
    localStorage.setItem('tochilka_results', JSON.stringify(results));
  }

  /** Save a new result record and return it with generated id/date. */
  function saveResult(data) {
    const results = _load();
    const record  = {
      ...data,
      id:   String(Date.now()),
      date: new Date().toISOString(),
    };
    results.push(record);
    _save(results);
    return record;
  }

  function getResults() { return _load(); }

  function deleteResult(id) {
    _save(_load().filter(r => r.id !== id));
  }

  function clearAll() {
    localStorage.removeItem('tochilka_results');
  }

  // ── Smart Summary ─────────────────────────────────────────────────────────

  function generateSmartSummary(r) {
    let summary = '';
    
    if (r.grade) {
      const normResult = compareWithNorm(r.wpm, r.grade);
      if (normResult === 'above') {
        summary += `Скорость чтения выше нормы (${r.wpm} сл/мин). `;
      } else if (normResult === 'normal') {
        summary += `Скорость чтения в пределах нормы (${r.wpm} сл/мин). `;
      } else if (normResult === 'below') {
        summary += `Скорость чтения ниже нормы (${r.wpm} сл/мин). `;
      } else {
        summary += `Скорость чтения: ${r.wpm} сл/мин. `;
      }
    } else {
      summary += `Скорость чтения: ${r.wpm} сл/мин. `;
    }
    
    if (r.readingMethod) {
      summary += `Читает: ${r.readingMethod.toLowerCase()}. `;
    }
    
    let maxError = 0;
    let maxErrorKey = null;
    if (r.errors) {
      for (const key of ['distortion', 'accent', 'ending', 'regression']) {
        if (r.errors[key] > maxError) {
          maxError = r.errors[key];
          maxErrorKey = key;
        }
      }
    }
    
    if (maxErrorKey) {
      if (maxErrorKey === 'distortion') summary += 'Основная проблема: искажение слов.';
      if (maxErrorKey === 'accent') summary += 'Часто ошибается в ударениях.';
      if (maxErrorKey === 'ending') summary += 'Типичная ошибка: проглатывание/искажение окончаний.';
      if (maxErrorKey === 'regression') summary += 'Склонность к регрессии (повторам).';
    } else {
      summary += 'Технических ошибок не зафиксировано.';
    }
    
    return summary.trim();
  }

  // ── CSV Export ────────────────────────────────────────────────────────────

  /** Export all results to a semicolon-delimited CSV with BOM for Russian Excel. */
  function exportCSV() {
    const results = _load();
    if (!results.length) {
      alert('Нет данных для экспорта.');
      return;
    }

    const BOM = '\uFEFF';
    const headers = [
      'Дата', 'Ученик', 'Класс', 'Текст', 'Время (сек)', 'Слов/мин',
      'Искажения', 'Ударения', 'Окончания', 'Регрессии', 'Способ чтения',
      'Игнор. знаков', 'Монотонность', 'Неверн. ударения',
      'Осознанность (верно/всего)', 'Режим', 'Вывод'
    ];

    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;

    const rows = results.map(r => {
      const date = new Date(r.date).toLocaleDateString('ru-RU');
      const comp = Array.isArray(r.comprehension)
        ? `${r.comprehension.filter(c => c.correct).length}/${r.comprehension.length}`
        : '—';
      return [
        date,
        r.studentName  || '—',
        r.className    || '—',
        r.textTitle    || '—',
        Math.round(r.elapsed || 0),
        r.wpm          || 0,
        r.errors?.distortion  || 0,
        r.errors?.accent      || 0,
        r.errors?.ending      || 0,
        r.errors?.regression  || 0,
        r.readingMethod       || '—',
        r.expressiveness?.ignoreSigns  ? 'Да' : 'Нет',
        r.expressiveness?.monotone     ? 'Да' : 'Нет',
        r.expressiveness?.wrongAccents ? 'Да' : 'Нет',
        comp,
        r.mode === 'self' ? 'Самопроверка' : 'Учитель',
        generateSmartSummary(r)
      ].map(q).join(';');
    });

    const csv  = BOM + headers.map(q).join(';') + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href:     url,
      download: `tochilka_${new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')}.csv`,
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return {
    readingNorms,
    getCurrentHalf,
    getNorm,
    compareWithNorm,
    saveResult,
    getResults,
    deleteResult,
    clearAll,
    exportCSV,
    generateSmartSummary,
  };
})();
