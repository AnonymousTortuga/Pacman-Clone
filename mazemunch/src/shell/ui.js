// DOM overlays drawn above the canvas: high-score initials entry and settings.
// Built with createElement/textContent only (no innerHTML), so the strict
// Content-Security-Policy in the nginx config needs no exceptions.

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k in node) node[k] = v;
    else node.setAttribute(k, v);
  }
  for (const child of children) node.append(child);
  return node;
}

export function createUI(root, { settings, onSettingsChange, onOpenChange }) {
  let openCount = 0;
  const opened = (delta) => {
    openCount += delta;
    onOpenChange(openCount > 0);
  };

  // ------------------------------------------------------------ settings
  const reduced = el('input', { type: 'checkbox', id: 'opt-flash', checked: settings.reducedFlash });
  const markers = el('input', { type: 'checkbox', id: 'opt-markers', checked: settings.markers });
  const speed = el('select', { id: 'opt-speed' }, [
    el('option', { value: '1', text: '100%' }),
    el('option', { value: '0.85', text: '85%' }),
    el('option', { value: '0.7', text: '70%' }),
  ]);
  speed.value = String(settings.speed);

  const panel = el('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'settings-title', hidden: true }, [
    el('h2', { id: 'settings-title', text: 'Settings' }),
    el('label', { class: 'row' }, [reduced, el('span', { text: 'Reduce flashing' })]),
    el('label', { class: 'row' }, [markers, el('span', { text: 'Shape markers on chasers' })]),
    el('label', { class: 'row' }, [el('span', { text: 'Game speed' }), speed]),
  ]);
  const close = el('button', { type: 'button', class: 'primary', text: 'Done' });
  panel.append(close);

  const gear = el('button', { type: 'button', class: 'gear', 'aria-label': 'Settings', title: 'Settings', text: '⚙' });

  function emitSettings() {
    onSettingsChange({ reducedFlash: reduced.checked, markers: markers.checked, speed: Number(speed.value) });
  }
  [reduced, markers, speed].forEach((input) => input.addEventListener('change', emitSettings));

  function openSettings() {
    if (!panel.hidden) return;
    panel.hidden = false;
    opened(+1);
    reduced.focus();
  }
  function closeSettings() {
    if (panel.hidden) return;
    panel.hidden = true;
    opened(-1);
    gear.focus();
  }
  gear.addEventListener('click', openSettings);
  close.addEventListener('click', closeSettings);
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closeSettings();
    }
  });

  // ------------------------------------------------------------ initials
  const initials = el('input', {
    id: 'initials',
    maxLength: 3,
    autocomplete: 'off',
    autocapitalize: 'characters',
    spellcheck: false,
    'aria-label': 'Your initials',
  });
  const scoreLine = el('p', { class: 'score-line' });
  const save = el('button', { type: 'submit', class: 'primary', text: 'Save' });
  const form = el('form', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'hs-title', hidden: true }, [
    el('h2', { id: 'hs-title', text: 'New high score!' }),
    scoreLine,
    el('label', { class: 'row', for: 'initials' }, [el('span', { text: 'Initials' }), initials]),
    save,
  ]);
  initials.addEventListener('input', () => {
    initials.value = initials.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  });

  function promptInitials(score) {
    return new Promise((resolve) => {
      scoreLine.textContent = String(score);
      initials.value = '';
      form.hidden = false;
      opened(+1);
      initials.focus();
      const done = (e) => {
        e.preventDefault();
        form.removeEventListener('submit', done);
        form.hidden = true;
        opened(-1);
        resolve(initials.value || '???');
      };
      form.addEventListener('submit', done);
    });
  }

  root.append(gear, panel, form);
  return { promptInitials, openSettings };
}
