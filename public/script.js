const API = "https://kitanime-api.vercel.app/v1";

let currentPage = 1;
let currentMode = "ongoing"; // "ongoing" | "complete" | "search"
let currentKeyword = "";

// Helper fetch JSON with better error handling
async function fetchJSON(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Cache-Control': 'no-cache'
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}

// Helper buat element
function el(tag, cls, html) {
  const d = document.createElement(tag);
  if (cls) d.className = cls;
  if (html !== undefined) d.innerHTML = html;
  return d;
}

// Load anime list
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
    let list = r.data || r.anime || r;

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
      card.innerHTML = `
        <img src="${img}" alt="${title}" onerror="this.style.opacity=.4">
        <div style="margin-top:6px">${title}</div>
      `;

      card.addEventListener('click', () => {
        if (a.slug) {
          loadEpisodes(a.slug, title);
        } else {
          alert("Slug tidak tersedia untuk anime ini.");
        }
      });

      wrap.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    document.getElementById('anime-list').innerHTML =
      '<div class="muted">Failed to load anime list</div>';
  }
}

// Load episodes & tampilkan player section
async function loadEpisodes(slug, animeTitle) {
  try {
    const r = await fetchJSON(`${API}/anime/${encodeURIComponent(slug)}/episodes`);
    let episodes = r.data?.episodes || r.data || r.episodes || r;

    if (!Array.isArray(episodes) || episodes.length === 0) {
      alert('No episodes found for ' + slug);
      return;
    }

    // Tampilkan player section
    document.getElementById("player-section").style.display = "block";

    const wrap = document.getElementById('episode-list');
    wrap.innerHTML = '';
    const title = document.getElementById('video-title');
    title.textContent = animeTitle || slug;

    episodes.forEach(ep => {
      // Ekstrak nomor episode dari berbagai format
      const episodeNum = extractEpisodeNumber(ep);
      if (!episodeNum) return;

      const btn = el('button', 'btn small', 'Episode ' + episodeNum);
      btn.addEventListener('click', () => playEpisode(slug, episodeNum, `${animeTitle || slug} - Episode ${episodeNum}`));
      wrap.appendChild(btn);
    });
  } catch (err) {
    console.error(err);
    alert('Failed to load episodes: ' + err.message);
  }
}

// Extract episode number dari berbagai format
function extractEpisodeNumber(episode) {
  // Coba dari field episode yang sudah dibersihkan (sesuai dengan server code)
  if (episode.episode && !isNaN(episode.episode)) {
    return episode.episode;
  }
  
  // Coba dari slug
  if (episode.slug) {
    const match = episode.slug.match(/episode[s]?[-_]?(\d+)/i);
    if (match) return match[1];
  }
  
  // Coba dari field lain
  if (episode.episode_number) return episode.episode_number;
  if (episode.number) return episode.number;
  
  // Regex untuk ekstrak nomor dari string
  if (episode.episode) {
    const match = episode.episode.match(/Episode\s+(\d+)/i) || 
                  episode.episode.match(/(\d+)/);
    if (match) return match[1];
  }
  
  return null;
}

// Play episode dengan format yang sesuai server
async function playEpisode(animeSlug, episodeNumber, title) {
  try {
    console.log(`Loading episode ${episodeNumber} for anime ${animeSlug}`);
    
    // Gunakan endpoint yang sesuai dengan struktur server
    const episodeData = await fetchJSON(`${API}/anime/${encodeURIComponent(animeSlug)}/episodes/${episodeNumber}`);
    
    console.log('Episode data:', episodeData);

    const wrap = document.getElementById('video-player');
    wrap.innerHTML = '';
    document.getElementById('video-title').textContent = title;

    // Extract video sources berdasarkan struktur server
    const sources = extractVideoSourcesFromServer(episodeData);

    if (!sources || sources.length === 0) {
      wrap.innerHTML = '<div class="muted">No video sources available for this episode.</div>';
      return;
    }

    // Create source selector jika ada multiple qualities
    if (sources.length > 1) {
      const sourceSelector = el('div', 'source-selector');
      sourceSelector.innerHTML = '<strong>Select Quality:</strong><br>';
      
      sources.forEach((source) => {
        const btn = el('button', 'btn small', `${source.quality}p`);
        btn.style.margin = '2px';
        btn.addEventListener('click', () => loadVideoPlayer(source.url, wrap, false));
        sourceSelector.appendChild(btn);
      });
      
      wrap.appendChild(sourceSelector);
      wrap.appendChild(el('hr'));
    }

    // Load highest quality by default
    const defaultSource = sources.find(s => s.quality === Math.max(...sources.map(s => s.quality))) || sources[0];
    loadVideoPlayer(defaultSource.url, wrap, false);

  } catch (err) {
    console.error('Play episode error:', err);
    const wrap = document.getElementById('video-player');
    wrap.innerHTML = `<div class="muted">Failed to load episode: ${err.message}</div>`;
  }
}

// Extract video sources berdasarkan struktur server yang sebenarnya
function extractVideoSourcesFromServer(data) {
  const sources = [];
  
  // Berdasarkan server code, data memiliki struktur:
  // steramList: { "360p": "url", "480p": "url", "720p": "url" }
  if (data.data && data.data.steramList) {
    Object.entries(data.data.steramList).forEach(([quality, url]) => {
      if (url && url !== 'aaaaaaaaaaa') { // exclude dummy URLs
        sources.push({
          quality: parseInt(quality.replace('p', '')),
          url: url,
          type: 'stream'
        });
      }
    });
  }

  // Fallback ke stream_url jika steramList kosong
  if (sources.length === 0 && data.data && data.data.stream_url) {
    sources.push({
      quality: 480,
      url: data.data.stream_url,
      type: 'stream'
    });
  }

  // Sort by quality (highest first)
  sources.sort((a, b) => b.quality - a.quality);
  
  console.log('Extracted sources:', sources);
  return sources;
}

// Load video player dengan handling yang lebih baik untuk berbagai domain
function loadVideoPlayer(url, container, clearContainer = true) {
  if (clearContainer) {
    container.innerHTML = '';
  }

  const playerDiv = el('div', 'video-container');
  playerDiv.style.marginTop = '10px';
  
  console.log('Loading video URL:', url);
  const lower = url.toLowerCase();

  // Handling untuk berbagai jenis domain/URL
  if (url.includes('pixeldrain.com')) {
    // Pixeldrain membutuhkan akses langsung
    const directBtn = el('button', 'btn', 'Open Video (Direct Access Required)');
    directBtn.style.width = '100%';
    directBtn.style.padding = '15px';
    directBtn.style.fontSize = '16px';
    directBtn.onclick = () => window.open(url, '_blank');
    
    const info = el('div', 'muted', 'This video requires direct access. Click the button above to open it in a new tab.');
    info.style.marginTop = '10px';
    info.style.textAlign = 'center';
    
    playerDiv.appendChild(directBtn);
    playerDiv.appendChild(info);
    
  } else if (url.includes('drive.google.com') || url.includes('blogger.com') || url.includes('blogspot.com')) {
    // Google Drive/Blogger - embed langsung
    const iframe = el('iframe');
    iframe.src = url;
    iframe.width = '100%';
    iframe.height = '500';
    iframe.frameBorder = '0';
    iframe.allow = 'autoplay; encrypted-media; fullscreen';
    iframe.setAttribute("allowfullscreen", "true");
    
    iframe.onerror = () => {
      console.error('Google embed failed:', url);
      playerDiv.innerHTML = `
        <div class="muted">
          Failed to embed video. <br>
          <a href="${url}" target="_blank" style="color: #007bff;">Open in new tab →</a>
        </div>`;
    };

    playerDiv.appendChild(iframe);
    
  } else if (url.includes('desustream.info') || url.includes('/stream?url=')) {
    // Desustream atau stream endpoint server
    const iframe = el('iframe');
    iframe.src = url;
    iframe.width = '100%';
    iframe.height = '500';
    iframe.frameBorder = '0';
    iframe.allow = 'autoplay; encrypted-media; fullscreen';
    iframe.setAttribute("allowfullscreen", "true");
    iframe.setAttribute("sandbox", "allow-same-origin allow-scripts allow-popups allow-forms");
    
    iframe.onerror = () => {
      console.error('Stream iframe failed:', url);
      playerDiv.innerHTML = `
        <div class="muted">
          Failed to load stream. <br>
          <a href="${url}" target="_blank" style="color: #007bff;">Try direct link →</a>
        </div>`;
    };

    playerDiv.appendChild(iframe);
    
  } else if (lower.includes('.mp4') || lower.includes('.webm') || lower.includes('.m3u8')) {
    // Direct video files - coba proxy dulu, fallback ke direct link
    const vid = el('video');
    vid.controls = true;
    vid.style.width = '100%';
    vid.style.maxHeight = '70vh';
    
    // Try proxy first
    vid.src = `/proxy?url=${encodeURIComponent(url)}`;
    
    vid.onerror = () => {
      console.error('Proxy video failed, trying direct:', url);
      // Fallback: coba direct link
      vid.src = url;
      
      vid.onerror = () => {
        console.error('Direct video also failed:', url);
        playerDiv.innerHTML = `
          <div class="muted">
            Video failed to load. <br>
            <a href="${url}" target="_blank" style="color: #007bff;">Try direct link →</a>
          </div>`;
      };
    };

    const fsBtn = el('button', 'btn small', 'Fullscreen');
    fsBtn.style.marginTop = "8px";
    fsBtn.onclick = () => {
      if (vid.requestFullscreen) vid.requestFullscreen();
      else if (vid.webkitRequestFullscreen) vid.webkitRequestFullscreen();
      else if (vid.msRequestFullscreen) vid.msRequestFullscreen();
    };

    playerDiv.appendChild(vid);
    playerDiv.appendChild(fsBtn);
    
  } else if (url.includes('otakufiles') || url.includes('streamtape')) {
    // Known problematic domains - provide alternatives
    const warningDiv = el('div', '', `
      <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin-bottom: 10px;">
        <strong>⚠️ External Player Required</strong><br>
        This video source may require opening in a new tab due to restrictions.
      </div>
    `);
    
    // Try iframe first
    const iframe = el('iframe');
    iframe.src = `/proxy?url=${encodeURIComponent(url)}`;
    iframe.width = '100%';
    iframe.height = '500';
    iframe.frameBorder = '0';
    iframe.allow = 'autoplay; encrypted-media; fullscreen';
    iframe.setAttribute("allowfullscreen", "true");
    iframe.setAttribute("sandbox", "allow-same-origin allow-scripts allow-popups allow-forms");
    
    // Add direct link button
    const directBtn = el('button', 'btn small', 'Open in New Tab');
    directBtn.style.marginTop = '10px';
    directBtn.onclick = () => window.open(url, '_blank');
    
    iframe.onerror = () => {
      console.error('Problematic domain iframe failed:', url);
      iframe.style.display = 'none';
      const errorDiv = el('div', 'muted', 'Failed to load in embedded player. Please use the "Open in New Tab" button below.');
      playerDiv.insertBefore(errorDiv, directBtn);
    };

    playerDiv.appendChild(warningDiv);
    playerDiv.appendChild(iframe);
    playerDiv.appendChild(directBtn);
    
  } else {
    // Generic handling untuk URL lainnya
    const iframe = el('iframe');
    iframe.src = `/proxy?url=${encodeURIComponent(url)}`;
    iframe.width = '100%';
    iframe.height = '500';
    iframe.frameBorder = '0';
    iframe.allow = 'autoplay; encrypted-media; fullscreen';
    iframe.setAttribute("allowfullscreen", "true");
    
    iframe.onerror = () => {
      console.error('Generic iframe failed:', url);
      playerDiv.innerHTML = `
        <div class="muted">
          Failed to load content. <br>
          <a href="${url}" target="_blank" style="color: #007bff;">Open direct link →</a>
        </div>`;
    };

    playerDiv.appendChild(iframe);
  }

  container.appendChild(playerDiv);
}

// Search event
document.getElementById('search-btn').addEventListener('click', () => {
  currentMode = "search";
  currentKeyword = document.getElementById('search-input').value.trim();
  currentPage = 1;
  if (currentKeyword) {
    loadAnime(currentPage);
  }
});

// Enter key for search
document.getElementById('search-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('search-btn').click();
  }
});

// Mode switching
document.addEventListener('DOMContentLoaded', () => {
  // Add mode switcher buttons if they don't exist
  const modeContainer = document.getElementById('mode-container');
  if (modeContainer) {
    const ongoingBtn = el('button', 'btn', 'Ongoing');
    const completeBtn = el('button', 'btn', 'Complete');
    
    ongoingBtn.addEventListener('click', () => {
      currentMode = "ongoing";
      currentPage = 1;
      loadAnime(currentPage);
    });
    
    completeBtn.addEventListener('click', () => {
      currentMode = "complete";
      currentPage = 1;
      loadAnime(currentPage);
    });
    
    modeContainer.appendChild(ongoingBtn);
    modeContainer.appendChild(completeBtn);
  }
});

// Load more event
document.getElementById('load-more').addEventListener('click', () => {
  currentPage++;
  loadAnime(currentPage, true);
});

// Initial load
loadAnime();