'use strict';

/**
 * UI module — pure rendering helpers, modal control, toast notifications.
 * Depends on: Assessment (for norm comparison colours).
 * Exposed globally as window.UI.
 */
const UI = (() => {

  const LOGO = 'https://raw.githubusercontent.com/onlinetochilka/theme/main/tochilka-logo.svg';

  // ── Helpers ───────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str ?? '')));
    return d.innerHTML;
  }

  function show(el) { if (el) el.style.display = ''; }
  function hide(el) { if (el) el.style.display = 'none'; }
  function showFlex(el) { if (el) el.style.display = 'flex'; }

  // ── Toast ─────────────────────────────────────────────────────────────────

  function showToast(message, type = 'success', undoCallback = null) {
    const t = document.createElement('div');
    t.className = `toast toast--${type}`;
    t.textContent = message;
    if (undoCallback) {
      const btn = document.createElement('button');
      btn.className = 'toast-undo-btn';
      btn.textContent = 'Отменить';
      btn.onclick = () => { undoCallback(); t.remove(); };
      t.appendChild(btn);
    }
    document.body.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('toast--visible')));
    setTimeout(() => {
      t.classList.remove('toast--visible');
      setTimeout(() => t.remove(), 350);
    }, undoCallback ? 5000 : 2800);
  }

  // ── Empty State ───────────────────────────────────────────────────────────

  function emptyState(title, subtitle, actionLabel, actionCb) {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.innerHTML = `
      <img src="${LOGO}" alt="Точилка" class="empty-logo" />
      <h3 class="empty-title">${escapeHtml(title)}</h3>
      <p class="empty-sub">${escapeHtml(subtitle)}</p>
      ${actionLabel ? `<button class="btn btn--primary empty-action">${escapeHtml(actionLabel)}</button>` : ''}
    `;
    if (actionLabel && actionCb) {
      div.querySelector('.empty-action').addEventListener('click', actionCb);
    }
    return div;
  }

  // ── Base Tab ──────────────────────────────────────────────────────────────

  function getStudentDeclension(count) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod100 >= 11 && mod100 <= 19) return count + ' учеников';
    if (mod10 === 1) return count + ' ученик';
    if (mod10 >= 2 && mod10 <= 4) return count + ' ученика';
    return count + ' учеников';
  }

  function renderClasses(classes, container, { onDeleteClass, onDeleteStudent, onAddStudent, onEditClass, onMoveStudent } = {}) {
    container.innerHTML = '';
    if (classes.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48" style="opacity:0.4;margin-bottom:12px;">
            <path d="M12 4v16m8-8H4"></path>
          </svg>
          <p>Нет классов. Создайте свой первый класс!</p>
        </div>`;
      return;
    }

    classes.forEach(cls => {
      const card = document.createElement('div');
      card.className = 'class-card card';
      card.innerHTML = `
        <div class="class-card__header">
          <div class="class-card__info">
            <h3 class="class-card__name">${escapeHtml(cls.name)}</h3>
            <span class="badge">${getStudentDeclension(cls.students.length)}</span>
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="btn-icon btn--ghost" data-action="edit-class" data-class-id="${cls.id}" title="Переименовать класс" aria-label="Переименовать класс">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
            </button>
            <button class="btn-icon btn--ghost" data-action="add-student" data-class-id="${cls.id}" title="Добавить ученика" aria-label="Добавить ученика">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd"/></svg>
            </button>
            <button class="btn-icon btn--danger" data-action="delete-class" data-class-id="${cls.id}" title="Удалить класс" aria-label="Удалить">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zm-2 7a1 1 0 012 0v4a1 1 0 11-2 0V9zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V9a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
            </button>
          </div>
        </div>
        <div class="class-card__students">
          ${cls.students.map((s, i) => `
            <div class="student-list-item" tabindex="0">
              <span class="student-list-item__name">${i + 1}. ${escapeHtml(s.name)}</span>
              <div style="display: flex; gap: 6px;">
                <button class="btn-icon btn--ghost btn-move-student" data-action="move-student" data-class-id="${cls.id}" data-student-id="${s.id}" title="Перевести в другой класс" style="width: 24px; height: 24px; font-size: 10px;">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path d="M8 5a1 1 0 100 2h5.586l-1.293 1.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L13.586 5H8zM12 15a1 1 0 100-2H6.414l1.293-1.293a1 1 0 10-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L6.414 15H12z"/></svg>
                </button>
                <button class="btn-del-student" data-action="delete-student" data-class-id="${cls.id}" data-student-id="${s.id}" title="Удалить ученика" style="width: 24px; height: 24px;">×</button>
              </div>
            </div>`).join('')}
        </div>
      `;
      if (onDeleteClass) {
        card.querySelector('.btn--danger').addEventListener('click', e => {
          onDeleteClass(e.currentTarget.dataset.classId);
        });
      }
      if (onEditClass) {
        card.querySelector('.btn-icon[data-action="edit-class"]').addEventListener('click', e => {
          onEditClass(e.currentTarget.dataset.classId);
        });
      }
      if (onDeleteStudent) {
        card.querySelectorAll('.btn-del-student').forEach(btn => {
          btn.addEventListener('click', e => {
            onDeleteStudent(e.currentTarget.dataset.classId, e.currentTarget.dataset.studentId);
          });
        });
      }
      if (onMoveStudent) {
        card.querySelectorAll('.btn-move-student').forEach(btn => {
          btn.addEventListener('click', e => {
            onMoveStudent(e.currentTarget.dataset.classId, e.currentTarget.dataset.studentId);
          });
        });
      }
      if (onAddStudent) {
        card.querySelector('.btn-icon[data-action="add-student"]').addEventListener('click', e => {
          onAddStudent(e.currentTarget.dataset.classId);
        });
      }
      container.appendChild(card);
    });
  }

  // ── Selects ───────────────────────────────────────────────────────────────

  function renderStudentSelect(classes, selectEl) {
    selectEl.innerHTML = '<option value="">— Выберите ученика —</option>';
    classes.forEach(cls => {
      const group = document.createElement('optgroup');
      group.label = cls.name;
      cls.students.forEach(s => {
        const opt = document.createElement('option');
        opt.value = `${cls.id}::${s.id}`;
        opt.textContent = s.name;
        group.appendChild(opt);
      });
      selectEl.appendChild(group);
    });
  }

  function renderTextSelect(texts, selectEl) {
    selectEl.innerHTML = '<option value="">— Выберите текст —</option>';
    texts.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `${t.title} · ${t.grade} кл. · ~${t.words} сл.`;
      selectEl.appendChild(opt);
    });
  }

  // ── Text Display ──────────────────────────────────────────────────────────

  /**
   * Render text into container, wrapping each word in a <span class="word">.
   * @param {object}  textData
   * @param {Element} container
   * @param {object}  opts
   * @param {boolean} opts.clickable  - add word--clickable class
   * @param {boolean} opts.large      - add text-display--large class
   */
  function renderTextForReading(textData, container, { clickable = false, large = false } = {}) {
    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = `text-display${large ? ' text-display--large' : ''}`;

    let wordIdx = 0;
    // Split preserving whitespace tokens
    const tokens = textData.content.split(/(\s+)/);
    tokens.forEach(token => {
      if (/^\s+$/.test(token)) {
        wrap.appendChild(document.createTextNode(token));
      } else {
        const span = document.createElement('span');
        span.className = 'word' + (clickable ? ' word--clickable' : '');
        span.dataset.index = wordIdx++;
        span.textContent = token;
        wrap.appendChild(span);
      }
    });

    container.appendChild(wrap);
  }

  /** Highlight all words up to (and including) the given index. */
  function highlightWordsUpTo(container, index) {
    container.querySelectorAll('.word').forEach(w => {
      w.classList.toggle('word--selected', parseInt(w.dataset.index) <= index);
    });
  }

  /** Clear word selections. */
  function clearWordSelection(container) {
    container.querySelectorAll('.word').forEach(w => w.classList.remove('word--selected'));
  }

  // ── Statistics Table ──────────────────────────────────────────────────────

  function renderStatistics(results) {
    const emptyEl   = document.getElementById('stats-empty');
    const wrapperEl = document.getElementById('stats-table-wrapper');
    const tbody     = document.querySelector('#stats-table tbody');

    if (!results.length) {
      if (emptyEl)   { emptyEl.style.display = 'flex'; }
      if (wrapperEl) hide(wrapperEl);
      return;
    }

    if (emptyEl)   hide(emptyEl);
    if (wrapperEl) show(wrapperEl);

    tbody.innerHTML = '';

    const sorted = [...results].sort((a, b) => new Date(b.date) - new Date(a.date));

    sorted.forEach(r => {
      const tr   = document.createElement('tr');
      const date = new Date(r.date).toLocaleDateString('ru-RU');

      const totalErrors =
        (r.errors?.distortion || 0) +
        (r.errors?.accent     || 0) +
        (r.errors?.ending     || 0) +
        (r.errors?.regression || 0);

      const normResult = r.grade ? Assessment.compareWithNorm(r.wpm, r.grade, r.date) : 'unknown';
      const wpmClass   =
        normResult === 'above'  ? 'wpm--above'  :
        normResult === 'below'  ? 'wpm--below'  :
        normResult === 'normal' ? 'wpm--normal' : '';

      const comp = r.comprehensionScore ? r.comprehensionScore :
                   Array.isArray(r.comprehension) && r.comprehension.length
                     ? `${r.comprehension.filter(c => c.correct).length} / ${r.comprehension.length}`
                     : '—';

      const modeLabel = r.mode === 'self' ? '<span class="badge badge--self">Экран</span>' : '<span class="badge badge--teacher">Бумага</span>';

      tr.innerHTML = `
        <td>${date}</td>
        <td>
          ${escapeHtml(r.studentName || '—')}
          ${r.studentId ? `<button class="btn-icon btn--ghost btn-chart" style="width:24px;height:24px;margin-left:4px;font-size:12px;" data-student-id="${r.studentId}" data-student-name="${escapeHtml(r.studentName || '')}" title="График динамики">📈</button>` : ''}
          <div style="font-size: 0.75rem; color: rgba(27,58,107,0.6); margin-top: 4px; line-height: 1.3; max-width: 250px;">
            ${escapeHtml(Assessment.generateSmartSummary(r))}
          </div>
        </td>
        <td>${escapeHtml(r.className  || '—')}</td>
        <td>${escapeHtml(r.textTitle  || '—')}</td>
        <td class="wpm-cell">
          <div style="display:flex; align-items:center; justify-content:center; gap:6px;">
            ${r.wpm || 0}
            ${normResult !== 'unknown' ? `<span class="norm-dot norm-dot--${normResult}"></span>` : ''}
          </div>
        </td>
        <td>${totalErrors > 0 ? totalErrors : '—'}</td>
        <td>${comp}</td>
        <td>${modeLabel}</td>
        <td>
          <button class="btn-icon btn--danger btn-del-result" data-rid="${r.id}" title="Удалить">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zm-2 7a1 1 0 012 0v4a1 1 0 11-2 0V9zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V9a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ── Modal ─────────────────────────────────────────────────────────────────

  /**
   * Open the post-analysis modal.
   * @param {object}   session  - current session state
   * @param {object[]} texts    - loaded texts array
   */
  function showModal(session, texts) {
    const overlay  = document.getElementById('modal-overlay');
    const textData = texts.find(t => t.id === session.textId);

    // Header info
    document.getElementById('modal-student').textContent    = session.studentName || 'Самопроверка';
    document.getElementById('modal-text-title').textContent = textData?.title ?? (session.textId || '—');
    document.getElementById('modal-elapsed').textContent    = Timer.formatTime(session.elapsed);

    // WPM block
    const wpmDisplay = document.getElementById('modal-wpm-display');
    document.getElementById('modal-wpm-value').textContent   = session.wpm || 0;
    document.getElementById('modal-words-value').textContent = session.wordCount || 0;
    document.getElementById('modal-time-value').textContent  = Timer.formatTime(session.elapsed);
    show(wpmDisplay);

    // summarySection has been removed

    // Reset errors if they exist in UI
    ['distortion','accent','regression'].forEach(k => {
      const el = document.getElementById(`counter-${k}-modal`);
      if (el) el.textContent = session.errors?.[k] || 0;
    });

    // Comprehension questions
    const qContainer = document.getElementById('modal-questions');
    qContainer.innerHTML = '';

    if (textData?.questions?.length) {
      // Initialise comprehension array if needed
      if (!session.comprehension) session.comprehension = [];

      textData.questions.forEach((q, i) => {
        const row = document.createElement('div');
        row.className = 'question-row';
        const cur = session.comprehension[i];
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.marginBottom = '8px';
        row.style.gap = '12px';
        row.innerHTML = `
          <span class="question-text" style="flex:1; font-size:0.9rem; line-height:1.3;">
            ${i + 1}. ${escapeHtml(q.q)} 
            <span style="opacity:0.7">(${q.a ? escapeHtml(q.a) : 'Ответ не указан'})</span>
          </span>
          <div class="question-btns" style="display:flex; gap:8px; flex-shrink:0;">
            <button class="btn-answer btn-yes${cur?.correct === true  ? ' active' : ''}" data-action="answer-yes" data-qi="${i}" data-ans="true"  title="Верно">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </button>
            <button class="btn-answer btn-no ${cur?.correct === false ? ' active' : ''}" data-action="answer-no" data-qi="${i}" data-ans="false" title="Неверно">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        `;
        qContainer.appendChild(row);
      });
    } else {
      qContainer.innerHTML = '<p class="muted">Вопросы для этого текста не заданы.</p>';
    }

    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function hideModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.body.style.overflow = '';
  }

  // ── Print Preview (clean — no word markers) ──────────────────────────────

  /**
   * Render a clean print-ready preview.
   * The #print-content element is the only thing shown when window.print() is called.
   */
  function renderPrintPreview(textData, container) {
    container.innerHTML = '';
    if (!textData) return;

    container.innerHTML = `
      <div class="print-preview card">
        <div class="print-body-inner">
          <h2 class="print-title">${escapeHtml(textData.title)}</h2>
          <div class="print-text" style="white-space: pre-wrap;">${escapeHtml(textData.content)}</div>
        </div>
      </div>
    `;
  }

  function renderPrintBlank(container) {
    container.innerHTML = `
      <div class="print-preview card" style="max-width: 100%; margin: 0; padding: 0;">
        <div style="padding: 0 !important; font-family: 'Inter', system-ui, sans-serif !important; color: #1e293b !important; display: block !important;">
          
          <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom: 32px;">
            <div style="flex: 1;">
              <div style="display:flex; align-items:center; gap: 16px; margin-bottom: 24px;">
                <img src="${LOGO}" alt="Точилка" style="width: 48px; height: 48px;" />
                <h2 class="print-title" style="margin: 0; font-size: 22pt !important; font-family: 'Inter', system-ui, sans-serif !important; font-weight: 700; color: var(--blue, #1b3a6b) !important; letter-spacing: -0.5px;">Бланк проверки техники чтения</h2>
              </div>
              <div style="display:flex; gap: 48px;">
                <div style="display:flex; align-items:baseline; width: 240px;">
                  <span style="font-weight: 600; color: #64748b; margin-right: 12px; font-size: 11pt; text-transform: uppercase; letter-spacing: 0.5px;">Класс</span>
                  <div style="border-bottom: 2px solid #e2e8f0; flex: 1;"></div>
                </div>
                <div style="display:flex; align-items:baseline; width: 240px;">
                  <span style="font-weight: 600; color: #64748b; margin-right: 12px; font-size: 11pt; text-transform: uppercase; letter-spacing: 0.5px;">Дата</span>
                  <div style="border-bottom: 2px solid #e2e8f0; flex: 1;"></div>
                </div>
              </div>
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 11pt; font-family: 'Inter', system-ui, sans-serif !important;">
            <thead>
              <tr>
                <th style="border: 1px solid #cbd5e1; border-bottom: 2px solid #94a3b8; padding: 14px 16px; width: 40%; text-align: left; font-weight: 600; color: #475569; text-transform: uppercase; font-size: 9pt; letter-spacing: 0.5px; background: #f8fafc;">ФИО ученика</th>
                <th style="border: 1px solid #cbd5e1; border-bottom: 2px solid #94a3b8; padding: 14px 16px; width: 12%; text-align: center; font-weight: 600; color: #475569; text-transform: uppercase; font-size: 9pt; letter-spacing: 0.5px; background: #f8fafc;">Сл/мин</th>
                <th style="border: 1px solid #cbd5e1; border-bottom: 2px solid #94a3b8; padding: 14px 16px; width: 18%; text-align: center; font-weight: 600; color: #475569; text-transform: uppercase; font-size: 9pt; letter-spacing: 0.5px; background: #f8fafc;">Ошибки</th>
                <th style="border: 1px solid #cbd5e1; border-bottom: 2px solid #94a3b8; padding: 14px 16px; width: 30%; text-align: left; font-weight: 600; color: #475569; text-transform: uppercase; font-size: 9pt; letter-spacing: 0.5px; background: #f8fafc;">Осознанность / Выразительность</th>
              </tr>
            </thead>
            <tbody>
              ${Array(22).fill('<tr><td style="border: 1px solid #cbd5e1; height: 44px;"></td><td style="border: 1px solid #cbd5e1;"></td><td style="border: 1px solid #cbd5e1;"></td><td style="border: 1px solid #cbd5e1;"></td></tr>').join('')}
            </tbody>
          </table>

        </div>
      </div>
    `;
  }

  // ── Student List for Check Column ─────────────────────────────────────────

  /**
   * Render the student list in the left check column as Accordions.
   * @param {Array}       classes          - all classes array
   * @param {string|null} currentStudentId - id of selected student
   * @param {Element}     container
   * @param {Function}    onSelect         - callback when student is selected
   */
  function renderStudentListForCheck(classes, currentStudentId, container, onSelect) {
    container.innerHTML = '';
    if (!classes || !classes.length) {
      container.innerHTML = '<p class="muted" style="font-size:0.8rem;padding:4px 0">Создайте класс на вкладке «Ученики»</p>';
      return;
    }
    
    classes.forEach((cls, idx) => {
      const item = document.createElement('div');
      item.className = 'accordion-item';
      
      const isSelectedClass = cls.students.some(s => s.id === currentStudentId);
      // Open first class by default if none selected, or open the selected one
      const isOpen = isSelectedClass || (!currentStudentId && idx === 0);
      if (isOpen) item.classList.add('open');
      
      item.innerHTML = `
        <div class="accordion-header" data-action="toggle-accordion" tabindex="0">
          <span>${escapeHtml(cls.name)}</span>
          <svg class="chevron" viewBox="0 0 20 20" fill="currentColor" width="16" height="16" style="transition:transform 0.3s; transform: rotate(${isOpen ? '180deg' : '0deg'})"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
        </div>
        <div class="accordion-content">
          ${cls.students.map(s => `
            <div class="student-check-item ${s.id === currentStudentId ? 'current' : ''}" data-action="select-student" data-class-id="${cls.id}" data-student-id="${s.id}" tabindex="0">
              ${escapeHtml(s.name)}
            </div>
          `).join('')}
        </div>
      `;
      
      item.querySelector('.accordion-header').addEventListener('click', (e) => {
        const currentlyOpen = item.classList.contains('open');
        // Close all
        container.querySelectorAll('.accordion-item').forEach(i => {
          i.classList.remove('open');
          i.querySelector('.chevron').style.transform = 'rotate(0deg)';
        });
        if (!currentlyOpen) {
          item.classList.add('open');
          item.querySelector('.chevron').style.transform = 'rotate(180deg)';
        }
      });
      
      if (onSelect) {
        item.querySelectorAll('.student-check-item').forEach(el => {
          el.addEventListener('click', () => {
            onSelect(el.dataset.classId, el.dataset.studentId);
            // Visual update
            container.querySelectorAll('.student-check-item').forEach(i => i.classList.remove('current'));
            el.classList.add('current');
          });
        });
      }
      
      container.appendChild(item);
    });
  }

  // ── Library List ──────────────────────────────────────────────────────────

  function renderLibraryList(texts, container, selectedIds = []) {
    container.innerHTML = '';
    
    if (!texts || !texts.length) {
      return;
    }

    texts.forEach(t => {
      const isChecked = selectedIds.includes(String(t.id)) || selectedIds.includes(t.id) ? 'checked' : '';
      const card = document.createElement('div');
      card.className = 'text-card';
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; padding: 12px;">
          <div style="display:flex; align-items:center; gap: 12px;">
            <input type="checkbox" class="text-checkbox" value="${t.id}" ${isChecked} style="width:18px; height:18px; cursor:pointer;" />
            <div>
              <h3 style="margin-bottom:2px; font-size:1rem;">${escapeHtml(t.title)}</h3>
              <p class="muted" style="font-size:0.8rem">${t.grade} класс · ~${t.words} слов</p>
            </div>
          </div>
          <svg class="chevron" viewBox="0 0 20 20" fill="currentColor" width="18" height="18" style="transition:transform 0.3s; color:var(--blue);"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
        </div>
        <div class="accordion-content">
          <div style="padding: 0 14px 14px 44px; font-size:0.95rem; line-height:1.6; color:var(--blue); white-space: pre-wrap;">${escapeHtml(t.content)}</div>
        </div>
      `;
      
      const cb = card.querySelector('.text-checkbox');
      cb.addEventListener('click', (e) => {
        e.stopPropagation();
      });

      card.addEventListener('click', (e) => {
        if (e.target.tagName.toLowerCase() === 'input') return;
        const isOpen = card.classList.toggle('open');
        card.querySelector('.chevron').style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
      });

      container.appendChild(card);
    });
  }

  return {
    escapeHtml,
    show, hide, showFlex,
    showToast,
    emptyState,
    renderClasses,
    renderStudentSelect,
    renderTextSelect,
    renderTextForReading,
    highlightWordsUpTo,
    clearWordSelection,
    renderStatistics,
    showModal,
    hideModal,
    renderPrintPreview,
    renderPrintBlank,
    renderStudentListForCheck,
    renderLibraryList,
  };
})();
