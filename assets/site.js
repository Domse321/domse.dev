const curatedDescriptions = {
  'domse.dev-2.0': 'Staging-Repo für die neue professionelle Domse-Webseite mit Portfolio, Medienbereich und GitHub-Integration.',
  'domse.dev': 'Persönliche Website und öffentlicher Web-Auftritt von Domse.',
  'Rust-Scrap-Calculator': 'Interaktiver Rechner rund um Rust-Scrap und Ressourcenplanung.',
  'HyperV-VMs-Auslesen': 'PowerShell-Helfer zum Auslesen und Strukturieren von Hyper-V VM-Informationen.',
  'Win11-Kompabilitaet': 'PowerShell-Projekt zur Prüfung und Dokumentation von Windows-11-Kompatibilität.'
};

const fallbackRepos = [
  { name: 'domse.dev-2.0', description: curatedDescriptions['domse.dev-2.0'], html_url: 'https://github.com/Domse321/domse.dev-2.0', language: 'HTML', stargazers_count: 0, forks_count: 0, updated_at: new Date().toISOString() },
  { name: 'Rust-Scrap-Calculator', description: curatedDescriptions['Rust-Scrap-Calculator'], html_url: 'https://github.com/Domse321/Rust-Scrap-Calculator', language: 'TypeScript', stargazers_count: 0, forks_count: 0, updated_at: new Date().toISOString() },
  { name: 'HyperV-VMs-Auslesen', description: curatedDescriptions['HyperV-VMs-Auslesen'], html_url: 'https://github.com/Domse321/HyperV-VMs-Auslesen', language: 'PowerShell', stargazers_count: 0, forks_count: 0, updated_at: new Date().toISOString() }
];

const languageClasses = {
  HTML: 'lang-html', JavaScript: 'lang-javascript', TypeScript: 'lang-typescript', PowerShell: 'lang-powershell', CSS: 'lang-css', Shell: 'lang-shell'
};

let allRepos = [];

function formatDate(value) {
  try { return new Intl.DateTimeFormat('de-DE', { month: 'short', year: 'numeric' }).format(new Date(value)); }
  catch { return 'aktuell'; }
}

function descriptionFor(repo) {
  return curatedDescriptions[repo.name] || repo.description || 'Öffentliches Projekt von Domse — Details und Code direkt auf GitHub.';
}

function repoCard(repo) {
  const language = repo.language || 'Code';
  const langClass = languageClasses[language] || 'lang-default';
  return `
    <article class="repo-card reveal visible">
      <div class="repo-top">
        <a class="repo-name" href="${repo.html_url}" target="_blank" rel="noopener noreferrer">${repo.name}</a>
        <span class="badge">↗</span>
      </div>
      <p class="repo-description">${descriptionFor(repo)}</p>
      <div class="repo-meta">
        <span class="badge"><span class="language-dot ${langClass}"></span>${language}</span>
        <span class="badge">★ ${repo.stargazers_count ?? 0}</span>
        <span class="badge">⑂ ${repo.forks_count ?? 0}</span>
        <span class="badge">Update ${formatDate(repo.updated_at)}</span>
      </div>
    </article>
  `;
}

function renderRepos(repos) {
  const grid = document.querySelector('#repoGrid');
  const status = document.querySelector('#repoStatus');
  if (!grid || !status) return;
  if (!repos.length) {
    grid.innerHTML = '';
    status.textContent = 'Keine passenden Repositories gefunden.';
    return;
  }
  status.textContent = `${repos.length} öffentliche Repositories angezeigt.`;
  grid.innerHTML = repos.map(repoCard).join('');
}

async function loadRepos() {
  const status = document.querySelector('#repoStatus');
  try {
    const response = await fetch('https://api.github.com/users/Domse321/repos?sort=updated&per_page=100', {
      headers: { Accept: 'application/vnd.github+json' }
    });
    if (!response.ok) throw new Error(`GitHub API ${response.status}`);
    const repos = await response.json();
    allRepos = repos
      .filter(repo => !repo.fork)
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    renderRepos(allRepos);
  } catch (error) {
    allRepos = fallbackRepos;
    if (status) status.textContent = 'GitHub API gerade nicht erreichbar — kuratierter Fallback aktiv.';
    renderRepos(allRepos);
  }
}

function setupSearch() {
  const input = document.querySelector('#repoSearch');
  if (!input) return;
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    const filtered = allRepos.filter(repo => [repo.name, repo.description, repo.language]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(q)));
    renderRepos(filtered);
  });
}

function setupReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    items.forEach(item => item.classList.add('visible'));
    return;
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  items.forEach(item => observer.observe(item));
}

function setupYear() {
  const year = document.querySelector('#year');
  if (year) year.textContent = new Date().getFullYear();
}

setupYear();
setupReveal();
setupSearch();
loadRepos();
