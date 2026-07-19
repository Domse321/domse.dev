(() => {
  'use strict';

  document.documentElement.classList.add('js');

  const allowedVideos = new Map([
    ['i3xdJkqxBK8', 'The Script'],
    ['SWRWhE2yYJs', 'LetsHugo Manhunt Clutch'],
    ['6FRGj-8GBlE', 'Rust: Harbor Control']
  ]);

  function setupYear() {
    const year = document.querySelector('#year');
    if (year) year.textContent = String(new Date().getFullYear());
  }

  function setupFlowStudio() {
    const studio = document.querySelector('[data-flow-studio]');
    if (!studio) return;

    const tabs = [...studio.querySelectorAll('[role="tab"][data-flow]')];
    const panels = [...studio.querySelectorAll('[role="tabpanel"][data-flow-panel]')];
    if (!tabs.length || !panels.length) return;

    const select = (nextTab, moveFocus = false) => {
      const id = nextTab.dataset.flow;
      tabs.forEach((tab) => {
        const active = tab === nextTab;
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
      });
      panels.forEach((panel) => {
        const active = panel.dataset.flowPanel === id;
        panel.classList.toggle('is-active', active);
        panel.hidden = !active;
      });
      if (moveFocus) nextTab.focus();
    };

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => select(tab));
      tab.addEventListener('keydown', (event) => {
        let nextIndex = null;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = tabs.length - 1;
        if (nextIndex === null) return;
        event.preventDefault();
        select(tabs[nextIndex], true);
      });
    });

    const selected = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true') || tabs[0];
    select(selected);
  }

  function setupVideoModal() {
    const modal = document.querySelector('#videoModal');
    const player = document.querySelector('#videoPlayer');
    const title = document.querySelector('#videoModalTitle');
    const playbackToggle = document.querySelector('#videoPlaybackToggle');
    const externalLink = document.querySelector('#videoExternalLink');
    if (!modal || !player || !title || !playbackToggle || !externalLink) return;

    const closeButton = modal.querySelector('.video-close');
    let trigger = null;
    let playing = true;

    const sendPlayerCommand = (command) => {
      const frame = player.querySelector('iframe');
      if (!frame?.contentWindow) return;
      frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func: command, args: [] }), 'https://www.youtube-nocookie.com');
    };

    const close = () => {
      if (!modal.open) return;
      player.replaceChildren();
      modal.close();
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
      if (trigger instanceof HTMLElement) trigger.focus();
      trigger = null;
    };

    const open = (button) => {
      const id = button.dataset.videoId || '';
      if (!allowedVideos.has(id)) return;

      trigger = button;
      title.textContent = button.dataset.videoTitle || allowedVideos.get(id);
      externalLink.href = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
      playing = true;
      playbackToggle.textContent = 'Pausieren';

      const frame = document.createElement('iframe');
      frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&controls=0&enablejsapi=1&rel=0`;
      frame.title = `${title.textContent} auf YouTube`;
      frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      frame.allowFullscreen = true;
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.tabIndex = -1;
      frame.setAttribute('aria-hidden', 'true');
      player.replaceChildren(frame);

      modal.showModal();
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('modal-open');
      closeButton?.focus();
    };

    document.querySelectorAll('[data-video-id]').forEach((button) => {
      button.addEventListener('click', () => open(button));
    });
    modal.querySelectorAll('[data-video-close]').forEach((button) => button.addEventListener('click', close));
    playbackToggle.addEventListener('click', () => {
      playing = !playing;
      sendPlayerCommand(playing ? 'playVideo' : 'pauseVideo');
      playbackToggle.textContent = playing ? 'Pausieren' : 'Weiter abspielen';
    });
    modal.addEventListener('cancel', (event) => {
      event.preventDefault();
      close();
    });

    modal.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...modal.querySelectorAll('button:not([disabled]), a[href]')]
        .filter((element) => !element.hidden && element.getClientRects().length);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  setupYear();
  setupFlowStudio();
  setupVideoModal();
})();
