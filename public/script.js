const API = "https://kitanime-api.vercel.app/v1";

async function fetchJSON(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error('HTTP '+res.status);
  return res.json();
}

function el(tag, cls, html){ const d = document.createElement(tag); if(cls) d.className = cls; if(html!==undefined) d.innerHTML = html; return d; }

async function loadAnime(){
  try{
    const r = await fetchJSON(API + "/ongoing-anime/1");
    // adapt to possible shapes
    let list = r;
    if(r && r.data && Array.isArray(r.data)) list = r.data;
    const wrap = document.getElementById('anime-list');
    wrap.innerHTML = '';
    if(!Array.isArray(list) || list.length===0){ wrap.appendChild(el('div','muted','No anime found')); return; }
    list.forEach(a => {
      const title = a.title || a.name || a.anime_title || a.name_romaji || a.slug || 'Untitled';
      const img = a.image || a.thumb || a.poster || a.cover || '';
      const card = el('div','anime-card');
      card.innerHTML = `<img src="${img}" alt="${title}" onerror="this.style.opacity=.4"><div style="margin-top:6px">${title}</div>`;
      card.addEventListener('click', ()=> loadEpisodes(a.slug || a.id || a.link || title));
      wrap.appendChild(card);
    });
  }catch(err){
    console.error(err);
    document.getElementById('anime-list').innerHTML = '<div class="muted">Failed to load anime list</div>';
  }
}

async function loadEpisodes(slug){
  try{
    const r = await fetchJSON(API + "/anime/" + encodeURIComponent(slug) + "/episodes");
    // r.data or r itself may contain episodes
    let episodes = r;
    if(r && r.data && Array.isArray(r.data)) episodes = r.data;
    if(r && r.data && Array.isArray(r.data.episodes)) episodes = r.data.episodes;
    if(!Array.isArray(episodes) || episodes.length===0){
      alert('No episodes found for '+slug);
      return;
    }
    // show first 8 episodes as buttons
    const wrap = document.getElementById('video-player');
    wrap.innerHTML = '';
    const title = document.getElementById('video-title');
    title.textContent = 'Episodes for ' + slug;
    episodes.slice(0,12).forEach(ep => {
      const epSlug = ep.slug || ep.episode_slug || ep.id || ep.link || ep.episode || ep.number || ep;
      const label = ep.episode || ep.number || ep.title || ep.label || epSlug;
      const btn = el('button','btn small', 'Ep ' + label);
      btn.addEventListener('click', ()=> playEpisodeBySlug(String(epSlug), title.textContent + ' - Ep ' + label));
      wrap.appendChild(btn);
    });
  }catch(err){
    console.error(err);
    alert('Failed to load episodes: '+err.message);
  }
}

// helper to pick playable URL from episode detail
function pickPlayable(data){
  if(!data) return null;
  // prefer steramList (note the api uses misspelling 'steramList')
  if(data.steramList){
    const vals = Object.values(data.steramList);
    if(vals.length) return vals[0];
  }
  // download_urls.mp4 array -> take first provider url
  if(data.download_urls && data.download_urls.mp4 && Array.isArray(data.download_urls.mp4) && data.download_urls.mp4.length){
    const first = data.download_urls.mp4[0];
    if(first.urls && first.urls.length) return first.urls[0].url;
  }
  // stream_url may be an embed page -> return it (iframe)
  if(data.stream_url) return data.stream_url;
  return null;
}

async function playEpisodeBySlug(epSlug, title){
  try{
    const r = await fetchJSON(API + "/episode/" + encodeURIComponent(epSlug));
    const data = r.data || r;
    console.log('episode detail', data);
    const playable = pickPlayable(data);
    const wrap = document.getElementById('video-player');
    wrap.innerHTML = '';
    document.getElementById('video-title').textContent = title;
    if(!playable){
      wrap.innerHTML = '<div class="muted">No playable URL available. Check download links in console.</div>';
      console.log('episode data', data);
      return;
    }
    // if playable looks like direct file (mp4/webm/m3u8) use video tag with proxy
    const lower = playable.toLowerCase();
    if(lower.endsWith('.mp4') || lower.endsWith('.webm')){
      const vid = el('video','', '');
      vid.controls = true; vid.autoplay = true; vid.style.width = '100%';
      // use proxy to avoid CORS
      vid.src = '/proxy?url=' + encodeURIComponent(playable);
      wrap.appendChild(vid);
      return;
    }
    if(lower.endsWith('.m3u8')){
      // create video and use hls.js via browser if supported (we didn't include hls lib here),
      // but proxy + direct m3u8 might work in some browsers
      const vid = el('video','', '');
      vid.controls = true; vid.autoplay = true; vid.style.width = '100%';
      vid.src = '/proxy?url=' + encodeURIComponent(playable);
      wrap.appendChild(vid);
      return;
    }
    // otherwise treat as iframe/embed page
    const iframe = el('iframe');
    iframe.src = playable;
    iframe.width = '100%';
    iframe.height = '480';
    iframe.frameBorder = '0';
    iframe.allow = 'autoplay; encrypted-media';
    wrap.appendChild(iframe);
  }catch(err){
    console.error(err);
    alert('Failed to play episode: ' + err.message);
  }
}

loadAnime();