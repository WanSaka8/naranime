const API = "https://kitanime-api.vercel.app/v1";
let currentPage = 1;
let currentMode = "ongoing"; // bisa "ongoing" / "complete" / "search"
let currentKeyword = "";

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

function el(tag, cls, html) {
  const d = document.createElement(tag);
  if (cls) d.className = cls;
  if (html !== undefined) d.innerHTML = html;
  return d;
}

async function loadAnime(page = 1, append = false) {
  try {
    let url = "";
    if (currentMode === "search" && currentKeyword) {
      url = `${API}/search/${encodeURIComponent(currentKeyword)}?page=${page}`;
    } else if (currentMode === "complete") {
      url = `${API}/complete-anime/${page}`;
    } else {
      url = `${API}/ongoing-anime/${page}`;
    }

    const r = await fetchJSON(url);
    let list = r.data || r;
    const wrap = document.getElementById('anime-list');
    if (!append) wrap.innerHTML = '';

    if (!Array.isArray(list) || list.length === 0) {
      wrap.appendChild(el('div', 'muted', 'No anime found'));
      return;
    }

    list.forEach(a => {
      const title = a.title || a.name || a.anime_title || a.name_romaji || a.slug || 'Untitled';
      const img = a.image || a.thumb || a.poster || a.cover || '';
      const card = el('div', 'anime-card');
      card.innerHTML = `<img src="${img}" alt="${title}" onerror="this.style.opacity=.4">
                        <div style="margin-top:6px">${title}</div>`;
      if (!a.slug) {
        console.warn("Slug hilang, data:", a);
      }

      card.addEventListener('click', () => {
        if (a.slug) {
          loadEpisodes(a.slug);
        } else {
          alert("Slug tidak tersedia untuk anime ini, tidak bisa load episode.");
        }
      });

      wrap.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    document.getElementById('anime-list').innerHTML = '<div class="muted">Failed to load anime list</div>';
  }
}

// Episode loader (tidak diubah)
async function loadEpisodes(slug) {
  try {
    const r = await fetchJSON(API + "/anime/" + encodeURIComponent(slug) + "/episodes");
    let episodes = r.data?.episodes || r.data || r;
    if (!Array.isArray(episodes) || episodes.length === 0) {
      alert('No episodes found for ' + slug);
      return;
    }
    const wrap = document.getElementById('video-player');
    wrap.innerHTML = '';
    const title = document.getElementById('video-title');
    title.textContent = 'Episodes for ' + slug;
    episodes.forEach(ep => {
      const epSlug = ep.slug || ep.episode_slug || ep.link;
      if (!epSlug) {
        console.warn("Episode slug hilang:", ep);
        return;
      }

      const label = ep.episode || ep.number || ep.title || ep.label || epSlug;
      const btn = el('button', 'btn small', 'Ep ' + label);
      btn.addEventListener('click', () => playEpisodeBySlug(String(epSlug), title.textContent + ' - Ep ' + label));
      wrap.appendChild(btn);
    });
  } catch (err) {
    console.error(err);
    alert('Failed to load episodes: ' + err.message);
  }
}

// Play episode (sama seperti punyamu)
async function playEpisodeBySlug(epSlug, title) {
  try {
    const r = await fetchJSON(API + "/episode/" + encodeURIComponent(epSlug));
    const data = r.data || r;
    console.log('episode detail', data);
    const playable = pickPlayable(data);
    const wrap = document.getElementById('video-player');
    wrap.innerHTML = '';
    document.getElementById('video-title').textContent = title;

    if (!playable) {
      wrap.innerHTML = '<div class="muted">No playable URL available.</div>';
      return;
    }

    const lower = playable.toLowerCase();
    if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.m3u8')) {
      const vid = el('video', '');
      vid.controls = true; vid.autoplay = true; vid.style.width = '100%';
      vid.src = '/proxy?url=' + encodeURIComponent(playable);
      wrap.appendChild(vid);
      return;
    }

    const iframe = el('iframe');
    iframe.src = playable;
    iframe.width = '100%';
    iframe.height = '480';
    iframe.frameBorder = '0';
    iframe.allow = 'autoplay; encrypted-media';
    wrap.appendChild(iframe);
  } catch (err) {
    console.error(err);
    alert('Failed to play episode: ' + err.message);
  }
}

function pickPlayable(data) {
  if (!data) return null;
  if (data.steramList) {
    const vals = Object.values(data.steramList);
    if (vals.length) return vals[0];
  }
  if (data.download_urls?.mp4?.length) {
    const first = data.download_urls.mp4[0];
    if (first.urls?.length) return first.urls[0].url;
  }
  if (data.stream_url) return data.stream_url;
  return null;
}

// Search event
document.getElementById('search-btn').addEventListener('click', () => {
  currentMode = "search";
  currentKeyword = document.getElementById('search-input').value.trim();
  currentPage = 1;
  loadAnime(currentPage);
});

// Load more event
document.getElementById('load-more').addEventListener('click', () => {
  currentPage++;
  loadAnime(currentPage, true);
});

// initial load
loadAnime();
