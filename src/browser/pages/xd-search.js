export function renderSearch({ url, registry, data, navigate }) {
  const root = document.createElement('section');
  root.className = 'xd-search';
  const query = url.searchParams.get('q') ?? '';
  root.classList.toggle('xd-search-results', Boolean(query));
  const logo = document.createElement('h1');
  logo.className = 'xd-search-logo';
  logo.setAttribute('aria-label', 'XD Search');
  for (const text of ['X', 'D', ' Search']) {
    const letter = document.createElement('span');
    letter.textContent = text;
    logo.append(letter);
  }
  const form = document.createElement('form');
  form.className = 'xd-search-form';
  const input = document.createElement('input');
  input.type = 'search';
  input.maxLength = 300;
  input.value = query;
  input.setAttribute('aria-label', 'Recherche XD Search');
  const button = document.createElement('button');
  button.textContent = 'Rechercher';
  button.className = 'xp-button';
  form.append(input, button);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    navigate(`http://www.xdsearch.fr/?q=${encodeURIComponent(input.value.trim())}`);
  });
  root.append(logo, form);
  if (query) {
    const results = registry.search(query, data);
    if (!results.length) {
      const empty = document.createElement('p');
      empty.className = 'xd-search-empty';
      empty.textContent = `Aucun résultat trouvé pour « ${query} ».`;
      const suggestion = document.createElement('p');
      suggestion.textContent = "Vérifiez l'orthographe des termes recherchés.";
      root.append(empty, suggestion);
    }
    for (const page of results) {
      const result = document.createElement('article');
      result.className = 'xd-search-result';
      const link = document.createElement('a');
      link.href = '#';
      link.dataset.browserLink = page.url;
      link.textContent = page.title;
      const address = document.createElement('div');
      address.className = 'xd-result-url';
      address.textContent = page.url;
      const description = document.createElement('p');
      description.textContent = page.description ?? '';
      result.append(link, address, description);
      root.append(result);
    }
  } else {
    const directory = document.createElement('section');
    directory.className = 'xd-sites';
    const heading = document.createElement('h2');
    heading.textContent = 'Sites Web';
    const list = document.createElement('ul');
    for (const site of registry.sites(data)) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = '#';
      link.dataset.browserLink = site.url;
      link.textContent = site.siteName ?? site.title;
      const description = document.createElement('p');
      description.textContent = site.description ?? '';
      item.append(link, description);
      list.append(item);
    }
    directory.append(heading, list);
    root.append(directory);
    const footer = document.createElement('p');
    footer.className = 'xd-search-footer';
    footer.textContent = '© 2009 XD Search';
    root.append(footer);
  }
  return root;
}
