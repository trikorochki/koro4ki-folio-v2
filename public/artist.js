document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.artistData === 'undefined') {
        console.error('ОШИБКА: Данные артистов не найдены.');
        document.body.innerHTML = '<h1>Error: Could not load artist data.</h1>';
        return;
    }

    // --- State Variables ---
    let currentTrackIndex = 0;
    let currentAlbumIndex = -1;
    let currentAlbumType = 'albums';
    let isPlaying = false;
    let currentPlaylist = [];
    let randomTracks = [];
    let showingRandomTracks = 5;
    let artist = null;
    let artistId = null;
    let currentPage = 'artist'; // 'artist' or 'album'

    // --- DOM Elements ---
    const audio = document.getElementById('audio-source');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const progressBar = document.getElementById('progress-bar');
    const currentTimeEl = document.getElementById('current-time');
    const durationEl = document.getElementById('duration');
    const currentTrackTitleEl = document.getElementById('current-track-title');

    // Pages
    const artistPage = document.getElementById('artist-page');
    const albumPage = document.getElementById('album-page');

    // Artist page elements
    const artistAvatar = document.getElementById('artist-avatar');
    const artistName = document.getElementById('artist-name');
    const artistDescLine1 = document.getElementById('artist-description-line1');
    const artistDescLine2 = document.getElementById('artist-description-line2');
    const randomTracksContainer = document.getElementById('random-tracks');
    const randomPlayBtn = document.getElementById('random-play-btn');
    const randomShareBtn = document.getElementById('random-share-btn');

    // Album page elements
    const albumCover = document.getElementById('album-cover');
    const albumTitle = document.getElementById('album-title');
    const albumArtist = document.getElementById('album-artist');
    const albumStats = document.getElementById('album-stats');
    const backToArtistBtn = document.getElementById('back-to-artist');
    const albumPlayBtn = document.getElementById('album-play-btn');
    const albumShareBtn = document.getElementById('album-share-btn-main');
    const albumPlaylist = document.getElementById('album-playlist');

    // Tab elements
    const tabButtons = {
        albums: document.getElementById('albums-tab-btn'),
        eps: document.getElementById('eps-tab-btn'),
        demos: document.getElementById('demos-tab-btn')
    };
    const tabPanes = {
        albums: document.getElementById('albums-pane'),
        eps: document.getElementById('eps-pane'),
        demos: document.getElementById('demos-pane')
    };
    const carousels = {
        albums: document.getElementById('album-carousel-albums'),
        eps: document.getElementById('album-carousel-eps'),
        demos: document.getElementById('album-carousel-demos')
    };

    // --- Utility Functions ---
    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const formatDuration = (totalSeconds) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
        } else {
            return `${minutes}m ${seconds}s`;
        }
    };

    // --- Player Functions ---
    const playTrack = () => { if (currentPlaylist.length > 0) { isPlaying = true; audio.play(); playPauseBtn.textContent = '⏸'; } };
    const pauseTrack = () => { isPlaying = false; audio.pause(); playPauseBtn.textContent = '▶'; };
    const playPauseToggle = () => isPlaying ? pauseTrack() : playTrack();
    const prevTrack = () => { if (currentPlaylist.length > 0) { currentTrackIndex = (currentTrackIndex - 1 + currentPlaylist.length) % currentPlaylist.length; loadTrack(currentTrackIndex); playTrack(); } };
    const nextTrack = () => { if (currentPlaylist.length > 0) { currentTrackIndex = (currentTrackIndex + 1) % currentPlaylist.length; loadTrack(currentTrackIndex); playTrack(); } };
    const updateProgress = () => { progressBar.value = (audio.currentTime / audio.duration) * 100 || 0; currentTimeEl.textContent = formatTime(audio.currentTime); };
    const setProgress = (e) => { if (audio.duration) { audio.currentTime = (e.target.value / 100) * audio.duration; } };

    const loadTrack = (trackIndex) => {
        if (!currentPlaylist || !currentPlaylist[trackIndex]) return;
        currentTrackIndex = trackIndex;
        const track = currentPlaylist[trackIndex];
        audio.src = track.file;
        currentTrackTitleEl.textContent = track.title;
        audio.load();
        updatePlaylistUI();
    };

    const updatePlaylistUI = () => {
        // Update random tracks
        document.querySelectorAll('.random-track-item').forEach((item, index) => {
            item.classList.toggle('active', parseInt(item.dataset.index) === currentTrackIndex && currentPage === 'artist');
        });
        
        // Update album tracks
        document.querySelectorAll('#album-playlist .playlist-item').forEach((item, index) => {
            item.classList.toggle('active', parseInt(item.dataset.index) === currentTrackIndex && currentPage === 'album');
        });
    };

    // --- Random Tracks Functions ---
    const generateRandomTracks = () => {
        const allTracks = [];
        ['albums', 'eps', 'demos'].forEach(type => {
            if (artist[type]) {
                artist[type].forEach(release => {
                    release.tracks.forEach(track => {
                        allTracks.push({
                            ...track,
                            albumName: release.name,
                            albumType: type
                        });
                    });
                });
            }
        });

        // Shuffle array
        for (let i = allTracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allTracks[i], allTracks[j]] = [allTracks[j], allTracks[i]];
        }

        randomTracks = allTracks;
        return allTracks;
    };

    const renderRandomTracks = () => {
        randomTracksContainer.innerHTML = '';
        const tracksToShow = randomTracks.slice(0, showingRandomTracks);
        
        tracksToShow.forEach((track, index) => {
            const item = document.createElement('div');
            item.className = 'random-track-item';
            item.dataset.index = index;
            item.innerHTML = `
                <div class="random-track-info">
                    <div class="random-track-title">${track.title}</div>
                    <div class="random-track-album">${track.albumName}</div>
                </div>
                <button class="share-btn">
                    <svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3s3-1.34 3-3-1.34-3-3-3z"></path></svg>
                </button>
            `;
            randomTracksContainer.appendChild(item);
        });

        if (randomTracks.length > showingRandomTracks) {
            const showMoreBtn = document.createElement('button');
            showMoreBtn.className = 'show-more-btn';
            showMoreBtn.textContent = `Show more (${randomTracks.length - showingRandomTracks} tracks)`;
            showMoreBtn.onclick = () => {
                showingRandomTracks = randomTracks.length;
                renderRandomTracks();
            };
            randomTracksContainer.appendChild(showMoreBtn);
        }
    };

    // --- Album Functions ---
    const calculateAlbumStats = (album) => {
        const trackCount = album.tracks.length;
        // Для демонстрации используем примерную длительность. 
        // В реальности здесь можно использовать метаданные аудио файлов
        const avgTrackLength = 180; // 3 минуты среднее
        const totalSeconds = trackCount * avgTrackLength;
        return {
            trackCount,
            duration: formatDuration(totalSeconds)
        };
    };

    const renderAlbumPage = (albumType, albumIndex) => {
        const album = artist[albumType][albumIndex];
        const stats = calculateAlbumStats(album);
        
        albumCover.src = album.cover || 'images/default_cover.jpg';
        albumTitle.textContent = album.name;
        albumArtist.textContent = artist.name;
        albumStats.textContent = `${stats.trackCount} songs, ${stats.duration}`;
        
        // Render tracks
        albumPlaylist.innerHTML = '';
        album.tracks.forEach((track, index) => {
            const item = document.createElement('div');
            item.className = 'playlist-item';
            item.dataset.index = index;
            item.innerHTML = `
                <span class="track-title">${track.title}</span>
                <button class="share-btn">
                    <svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3s3-1.34 3-3-1.34-3-3-3z"></path></svg>
                </button>
            `;
            albumPlaylist.appendChild(item);
        });

        currentPlaylist = album.tracks;
        currentAlbumType = albumType;
        currentAlbumIndex = albumIndex;
    };

    // --- Navigation Functions ---
    const showArtistPage = () => {
        currentPage = 'artist';
        artistPage.classList.add('active');
        albumPage.classList.remove('active');
        currentPlaylist = randomTracks.slice(0, showingRandomTracks);
        document.title = `${artist.name} | kr4.pro`;
    };

    const showAlbumPage = (albumType, albumIndex) => {
        currentPage = 'album';
        artistPage.classList.remove('active');
        albumPage.classList.add('active');
        renderAlbumPage(albumType, albumIndex);
        document.title = `${artist[albumType][albumIndex].name} - ${artist.name} | kr4.pro`;
    };

    // --- Discography Functions ---
    const renderAlbumCarousel = (type, targetElement) => {
        targetElement.innerHTML = '';
        const collection = artist[type] || [];
        collection.forEach((album, index) => {
            const card = document.createElement('div');
            card.className = 'album-card';
            card.dataset.albumIndex = index;
            card.dataset.albumType = type;
            card.innerHTML = `<img src="${album.cover || 'images/default_cover.jpg'}" alt="${album.name}"><p>${album.name}</p>`;
            targetElement.appendChild(card);
        });
    };

    const switchTab = (tabType) => {
        if (!tabType) return;
        Object.entries(tabButtons).forEach(([type, button]) => {
            button.classList.toggle('active', type === tabType);
            tabPanes[type].classList.toggle('active', type === tabType);
        });
    };

    // --- Share Functions ---
    const copyToClipboard = (url, button) => {
        navigator.clipboard.writeText(url).then(() => {
            button.innerHTML = 'Copied!';
            button.classList.add('copied');
            setTimeout(() => {
                button.innerHTML = `<svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3s3-1.34 3-3-1.34-3-3-3z"></path></svg>`;
                button.classList.remove('copied');
            }, 2000);
        });
    };

    const handleTrackShare = (trackIndex) => {
        const params = new URLSearchParams({
            artist: artistId,
            albumType: currentAlbumType,
            album: currentAlbumIndex,
            track: trackIndex
        });
        return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    };

    const handleAlbumShare = () => {
        const params = new URLSearchParams({
            artist: artistId,
            albumType: currentAlbumType,
            album: currentAlbumIndex
        });
        return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    };

    const handleArtistShare = () => {
        const params = new URLSearchParams({ artist: artistId });
        return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    };

    // --- Initialization ---
    const params = new URLSearchParams(window.location.search);
    artistId = params.get('artist');
    const sharedAlbumType = params.get('albumType');
    const sharedAlbumIndex = params.get('album');
    const sharedTrackIndex = params.get('track');

    artist = window.artistData[artistId];

    if (!artist) {
        document.body.innerHTML = '<h1>Artist not found</h1>';
        return;
    }

    // Setup artist info
    artistAvatar.src = artist.image;
    artistName.textContent = artist.name;
    artistDescLine1.textContent = artist.description_line1;
    artistDescLine2.textContent = artist.description_line2;

    // Generate random tracks
    generateRandomTracks();

    // Setup discography
    const releaseTypes = ['albums', 'eps', 'demos'];
    const availableTypes = releaseTypes.filter(type => artist[type] && artist[type].length > 0);
    
    releaseTypes.forEach(type => {
        const hasContent = artist[type] && artist[type].length > 0;
        tabButtons[type].disabled = !hasContent;
        if (hasContent) {
            renderAlbumCarousel(type, carousels[type]);
        }
    });

    // Determine page to show
    if (sharedAlbumIndex && sharedAlbumType && artist[sharedAlbumType] && artist[sharedAlbumType][parseInt(sharedAlbumIndex)]) {
        // Show album page
        showAlbumPage(sharedAlbumType, parseInt(sharedAlbumIndex));
        if (sharedTrackIndex) {
            loadTrack(parseInt(sharedTrackIndex));
            playTrack();
        }
    } else {
        // Show artist page
        showArtistPage();
        renderRandomTracks();
        switchTab(availableTypes[0] || 'albums');
    }

    // --- Event Listeners ---
    playPauseBtn.addEventListener('click', playPauseToggle);
    prevBtn.addEventListener('click', prevTrack);
    nextBtn.addEventListener('click', nextTrack);
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', () => { durationEl.textContent = formatTime(audio.duration); });
    audio.addEventListener('ended', nextTrack);
    progressBar.addEventListener('input', setProgress);

    // Random section events
    randomPlayBtn.addEventListener('click', () => {
        currentPlaylist = randomTracks.slice(0, showingRandomTracks);
        currentPage = 'artist';
        loadTrack(0);
        playTrack();
    });

    randomShareBtn.addEventListener('click', () => {
        copyToClipboard(handleArtistShare(), randomShareBtn);
    });

    randomTracksContainer.addEventListener('click', (e) => {
        const trackItem = e.target.closest('.random-track-item');
        if (trackItem && !e.target.closest('.share-btn')) {
            currentPlaylist = randomTracks.slice(0, showingRandomTracks);
            currentPage = 'artist';
            loadTrack(parseInt(trackItem.dataset.index));
            playTrack();
        }

        const shareBtn = e.target.closest('.share-btn');
        if (shareBtn) {
            const trackIndex = parseInt(shareBtn.closest('.random-track-item').dataset.index);
            copyToClipboard(handleTrackShare(trackIndex), shareBtn);
        }
    });

    // Album page events
    albumPlayBtn.addEventListener('click', () => {
        loadTrack(0);
        playTrack();
    });

    albumShareBtn.addEventListener('click', () => {
        copyToClipboard(handleAlbumShare(), albumShareBtn);
    });

    albumPlaylist.addEventListener('click', (e) => {
        const trackTitle = e.target.closest('.track-title');
        if (trackTitle) {
            loadTrack(parseInt(trackTitle.closest('.playlist-item').dataset.index));
            playTrack();
        }

        const shareBtn = e.target.closest('.share-btn');
        if (shareBtn) {
            const trackIndex = parseInt(shareBtn.closest('.playlist-item').dataset.index);
            copyToClipboard(handleTrackShare(trackIndex), shareBtn);
        }
    });

    backToArtistBtn.addEventListener('click', (e) => {
        e.preventDefault();
        history.pushState(null, '', `artist.html?artist=${artistId}`);
        showArtistPage();
        renderRandomTracks();
    });

    // Discography events
    document.querySelector('.tab-nav').addEventListener('click', (e) => {
        const btn = e.target.closest('.tab-btn');
        if (btn && !btn.disabled) { switchTab(btn.dataset.tab); }
    });

    document.querySelector('.tab-content').addEventListener('click', (e) => {
        const card = e.target.closest('.album-card');
        if (card) {
            const albumType = card.dataset.albumType;
            const albumIndex = parseInt(card.dataset.albumIndex);
            history.pushState(null, '', `artist.html?artist=${artistId}&albumType=${albumType}&album=${albumIndex}`);
            showAlbumPage(albumType, albumIndex);
        }
    });

    // Browser back/forward
    window.addEventListener('popstate', () => {
        location.reload();
    });
});
