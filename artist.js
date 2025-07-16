document.addEventListener('DOMContentLoaded', () => {
    // --- Автоматический фоновый сбор диагностических данных ---
    (async () => {
        try {
            await fetch('/api/ping', { method: 'POST' });
            console.log('Background diagnostic ping sent from artist page.');
        } catch (error) {
            console.error('Failed to send background diagnostic ping:', error);
        }
    })();
    // --- Конец блока автоматического сбора ---

    if (typeof window.artistData === 'undefined') {
        console.error('ОШИБКА: Данные артистов не найдены.');
        document.body.innerHTML = '<h1>Error: Could not load artist data.</h1>';
        return;
    }

    // --- State Variables ---
    let currentTrackData = null;
    let currentPlaylist = [];
    let originalPlaylist = [];
    let currentPlaylistSource = null;
    let allArtistTracks = [];
    let showingAllTracks = false;
    let artist = null;
    let artistId = null;
    let isPlaying = false;
    let isShuffleOn = false;
    
    // ✅ НОВЫЙ БЛОК: Состояние для расширенной аналитики
    let listenCounted = false; 
    let currentTrackForAnalytics = null;

    // --- DOM Elements ---
    const audio = document.getElementById('audio-source');
    const playerFooter = document.querySelector('.player-footer');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const progressBar = document.getElementById('progress-bar');
    const currentTimeEl = document.getElementById('current-time');
    const durationEl = document.getElementById('duration');
    const currentTrackTitleEl = document.getElementById('current-track-title');
    const seeDiscographyBtn = document.getElementById('see-discography-btn');
    const artistPage = document.getElementById('artist-page');
    const albumPage = document.getElementById('album-page');
    const headerRandomBtn = document.querySelector('.header-play-random-btn');
    const allTracksShuffleBtn = document.getElementById('all-tracks-shuffle-btn');
    const albumShuffleBtn = document.getElementById('album-shuffle-btn');

    // --- Utility Functions ---
    const formatTime = (s) => { const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m}:${sec < 10 ? '0' : ''}${sec}`; };
    const formatDuration = (s) => { const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return h > 0 ? `${h}h ${m}m` : `${m}m ${Math.floor(s % 60)}s`; };

    const shuffleArray = (array) => {
        let currentIndex = array.length, randomIndex;
        const newArray = [...array];
        while (currentIndex !== 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [newArray[currentIndex], newArray[randomIndex]] = [newArray[randomIndex], newArray[currentIndex]];
        }
        return newArray;
    };

    const handleShareClick = (url, button) => {
        const shareData = { title: document.title, text: `Check out this music on kr4.pro`, url: url };
        if (navigator.share && navigator.canShare(shareData)) {
            navigator.share(shareData).catch((error) => console.log('Error sharing', error));
        } else {
            navigator.clipboard.writeText(url).then(() => {
                const originalContent = button.innerHTML;
                button.innerHTML = 'Copied!';
                setTimeout(() => { button.innerHTML = originalContent; }, 2000);
            });
        }
    };
    
    // ✅ ИЗМЕНЕНО: Универсальная функция для отправки событий аналитики
    const logPlayerEvent = async (eventType) => {
        if (!currentTrackForAnalytics || !currentTrackForAnalytics.file) return;
        try {
            await fetch('/api/listen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trackId: currentTrackForAnalytics.file,
                    eventType: eventType
                }),
            });
            console.log(`Analytics Event: '${eventType}' for track '${currentTrackForAnalytics.title}' sent.`);
        } catch (error) {
            console.error(`Failed to log analytics event '${eventType}':`, error);
        }
    };

    // --- Player Logic ---
    const showPlayer = () => {
        if (playerFooter) {
            playerFooter.classList.add('visible');
            document.body.classList.add('body-with-player');
        }
    };

    const updatePlayButtonStates = () => {
        const allPlayBtns = document.querySelectorAll('.play-action-btn .play-circle');
        allPlayBtns.forEach(btn => btn.classList.remove('playing'));
        if (headerRandomBtn) headerRandomBtn.classList.toggle('playing', isPlaying);
        if (isPlaying) {
            if (currentPlaylistSource === 'all-tracks') document.querySelector('#all-tracks-play-btn .play-circle')?.classList.add('playing');
            else if (currentPlaylistSource === 'album') document.querySelector('#album-play-btn .play-circle')?.classList.add('playing');
        }
    };
    
    const updateShuffleButtonsState = () => {
        allTracksShuffleBtn.classList.toggle('active', isShuffleOn && currentPlaylistSource === 'all-tracks');
        albumShuffleBtn.classList.toggle('active', isShuffleOn && currentPlaylistSource === 'album');
    };

    const updatePlayerUI = () => {
        document.querySelectorAll('.track-item').forEach(item => {
            const isActive = currentTrackData && item.dataset.filePath === currentTrackData.file;
            item.classList.toggle('active', isActive);
            if (isActive) {
                item.classList.toggle('playing', isPlaying);
                item.classList.toggle('paused', !isPlaying);
            } else {
                item.classList.remove('playing', 'paused');
            }
        });
        updatePlayButtonStates();
        updateShuffleButtonsState();
    };
    
    // ✅ МОДИФИЦИРОВАНО: loadAndPlay теперь управляет состоянием аналитики
    const loadAndPlay = (track) => {
        if (!track) return;
        
        // Если предыдущий трек был пропущен, отправляем событие
        if (isPlaying && currentTrackForAnalytics && !listenCounted) {
            logPlayerEvent('track_skipped');
        }

        listenCounted = false;
        currentTrackForAnalytics = track; // Обновляем трек для аналитики
        
        showPlayer();
        currentTrackData = track;
        audio.src = track.file;
        currentTrackTitleEl.textContent = track.title;
        audio.load();
        audio.play();
    };
    
    const findTrackInPlaylist = (trackData) => {
        if (!trackData || !currentPlaylist) return -1;
        return currentPlaylist.findIndex(t => t.file === trackData.file);
    };

    const toggleShuffle = () => {
        if (currentPlaylist.length === 0) return;
        isShuffleOn = !isShuffleOn;
        if (isShuffleOn) {
            const currentIndex = findTrackInPlaylist(currentTrackData);
            if (currentIndex > -1) {
                const playingTrack = currentPlaylist.splice(currentIndex, 1)[0];
                currentPlaylist = shuffleArray(currentPlaylist);
                currentPlaylist.unshift(playingTrack);
            } else {
                currentPlaylist = shuffleArray(currentPlaylist);
            }
        } else {
            const currentFile = currentTrackData ? currentTrackData.file : null;
            currentPlaylist = [...originalPlaylist];
            if (currentFile) {
                const newIndex = currentPlaylist.findIndex(t => t.file === currentFile);
            }
        }
        updatePlayerUI();
    };
    
    const handleTrackClick = (trackData, playlistSource) => {
        const isActiveTrack = currentTrackData && currentTrackData.file === trackData.file;
        const isCorrectPlaylist = currentPlaylistSource === playlistSource;
        
        if (isActiveTrack && isCorrectPlaylist) {
            if (isPlaying) audio.pause();
            else audio.play();
        } else {
            currentPlaylistSource = playlistSource;
            let basePlaylist;
            if (playlistSource === 'all-tracks') {
                 basePlaylist = [...allArtistTracks];
            } else {
                 basePlaylist = artist[trackData.albumType][trackData.albumIndex].tracks.map((t, i) => ({ ...t, albumName: trackData.albumName, albumType: trackData.albumType, albumIndex: trackData.albumIndex, trackIndex: i }));
            }
            originalPlaylist = [...basePlaylist];
            const startIndex = basePlaylist.findIndex(t => t.file === trackData.file);
            currentPlaylist = basePlaylist.slice(startIndex).concat(basePlaylist.slice(0, startIndex));
            if (isShuffleOn) {
                const playingTrack = currentPlaylist.shift();
                currentPlaylist = shuffleArray(currentPlaylist);
                currentPlaylist.unshift(playingTrack);
            }
            loadAndPlay(currentPlaylist[0]);
        }
    };
    
    // --- Page Rendering & Navigation ---
    const showPage = (pageToShow) => {
        artistPage.classList.toggle('active', pageToShow === 'artist');
        albumPage.classList.toggle('active', pageToShow === 'album');
        document.body.scrollTop = document.documentElement.scrollTop = 0;
    };
    
    const renderArtistPage = () => {
        document.getElementById('artist-avatar').src = artist.image;
        document.getElementById('artist-name').textContent = artist.name;
        document.getElementById('artist-description-line1').textContent = artist.description_line1;
        document.getElementById('artist-description-line2').textContent = artist.description_line2;
        allArtistTracks = [];
        ['albums', 'eps', 'demos'].forEach((type) => {
            (artist[type] || []).forEach((release, albumIndex) => {
                release.tracks.forEach((track, trackIndex) => {
                    allArtistTracks.push({ ...track, albumName: release.name, albumType: type, albumIndex, trackIndex });
                });
            });
        });
        renderAllTracksSection();
        const releaseTypes = ['albums', 'eps', 'demos'];
        const availableTypes = releaseTypes.filter(type => artist[type] && artist[type].length > 0);
        releaseTypes.forEach(type => {
            const tabBtn = document.getElementById(`${type}-tab-btn`);
            const carousel = document.getElementById(`album-carousel-${type}`);
            tabBtn.disabled = !artist[type] || artist[type].length === 0;
            if (!tabBtn.disabled) {
                carousel.innerHTML = '';
                artist[type].forEach((album, index) => {
                    carousel.innerHTML += `<div class="album-card" data-album-type="${type}" data-album-index="${index}"><img src="${album.cover || 'images/default_cover.jpg'}" alt="${album.name}"><p>${album.name}</p></div>`;
                });
            }
        });
        switchTab(availableTypes[0] || 'albums');
    };

    const renderAllTracksSection = () => {
        const section = document.getElementById('all-tracks-section');
        const tracklistContainer = section.querySelector('.track-list');
        if (!tracklistContainer) return;
        tracklistContainer.innerHTML = '';
        const tracksToDisplay = showingAllTracks ? allArtistTracks : allArtistTracks.slice(0, 4);
        tracksToDisplay.forEach(track => {
            tracklistContainer.innerHTML += `
                <div class="track-item" data-file-path="${track.file}" data-album-type="${track.albumType}" data-album-index="${track.albumIndex}">
                    <div class="track-number">
                        <span class="track-number-text">${track.num || '—'}</span>
                        <div class="track-number-play"></div>
                        <div class="track-number-equalizer"><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div></div>
                    </div>
                    <div class="track-item-info">
                        <div class="track-item-title">${track.title}</div>
                        <div class="track-item-album">${track.albumName}</div>
                    </div>
                    <span class="track-item-duration">${track.duration ? formatTime(track.duration) : '—:—'}</span>
                    <button class="share-btn" title="Share Track"><svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3s3-1.34 3-3-1.34-3-3-3z"></path></svg></button>
                </div>`;
        });
        let showHideBtn = section.querySelector('.show-hide-btn');
        if (allArtistTracks.length > 4) {
            if (!showHideBtn) {
                showHideBtn = document.createElement('button');
                showHideBtn.className = 'show-hide-btn';
                section.appendChild(showHideBtn);
            }
            showHideBtn.textContent = showingAllTracks ? 'Show less' : 'Show more';
            showHideBtn.style.display = 'block';
        } else if (showHideBtn) {
            showHideBtn.style.display = 'none';
        }
        updatePlayerUI();
    };
    
    const renderAlbumPage = (albumType, albumIndex) => {
        const album = artist[albumType][albumIndex];
        document.getElementById('album-cover').src = album.cover || 'images/default_cover.jpg';
        document.getElementById('album-title').textContent = album.name;
        document.getElementById('album-artist').textContent = artist.name;
        const totalDurationInSeconds = album.tracks.reduce((total, track) => total + (track.duration || 0), 0);
        document.getElementById('album-stats').textContent = `${album.tracks.length} songs, ${formatDuration(totalDurationInSeconds)}`;
        const playlistContainer = document.getElementById('album-playlist-container');
        playlistContainer.innerHTML = '';
        currentPlaylist = album.tracks.map((track, i) => ({ ...track, albumName: album.name, albumType, albumIndex, trackIndex: i }));
        originalPlaylist = [...currentPlaylist];
        currentPlaylist.forEach((track) => {
            playlistContainer.innerHTML += `
                <div class="track-item" data-file-path="${track.file}">
                    <div class="track-number">
                        <span class="track-number-text">${track.num || '—'}</span>
                        <div class="track-number-play"></div>
                        <div class="track-number-equalizer"><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div></div>
                    </div>
                    <div class="track-item-info"><div class="track-item-title">${track.title}</div></div>
                    <span class="track-item-duration">${track.duration ? formatTime(track.duration) : '—:—'}</span>
                    <button class="share-btn" title="Share Track"><svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3s3-1.34 3-3-1.34-3-3-3z"></path></svg></button>
                </div>`;
        });
        const otherReleasesCarousel = document.getElementById('other-releases-carousel');
        const otherReleasesSection = document.querySelector('.other-releases-section');
        otherReleasesCarousel.innerHTML = '';
        const allReleases = [];
        ['albums', 'eps', 'demos'].forEach(type => {
            (artist[type] || []).forEach((release, index) => {
                allReleases.push({ ...release, originalType: type, originalIndex: index });
            });
        });
        const otherReleases = allReleases.filter(release => !(release.originalType === albumType && release.originalIndex === albumIndex));
        if (otherReleases.length > 0) {
            otherReleasesSection.style.display = 'block';
            otherReleases.forEach(release => {
                otherReleasesCarousel.innerHTML += `<div class="album-card" data-album-type="${release.originalType}" data-album-index="${release.originalIndex}"><img src="${release.cover || 'images/default_cover.jpg'}" alt="${release.name}"><p>${release.name}</p></div>`;
            });
        } else {
            otherReleasesSection.style.display = 'none';
        }
        updatePlayerUI();
    };
    
    const renderOtherArtistsSection = (currentArtistId) => {
        const container = document.getElementById('other-artists-container');
        if (!container) return;
        container.innerHTML = '';
        Object.keys(window.artistData).forEach(id => {
            if (id !== currentArtistId) {
                const otherArtist = window.artistData[id];
                container.innerHTML += `<a href="artist.html?artist=${id}" class="artist-choice-card"><img src="${otherArtist.image}" alt="Аватар ${otherArtist.name}"><h2>${otherArtist.name}</h2></a>`;
            }
        });
    };

    const switchTab = (tabType) => {
        if (!tabType) return;
        ['albums', 'eps', 'demos'].forEach(type => {
            document.getElementById(`${type}-tab-btn`).classList.toggle('active', type === tabType);
            document.getElementById(`${type}-pane`).classList.toggle('active', type === tabType);
        });
    };

    const handleNavigation = () => {
        const params = new URLSearchParams(window.location.search);
        artistId = params.get('artist');
        artist = window.artistData[artistId];
        if (!artist) { document.body.innerHTML = '<h1>Artist Not Found</h1>'; return; }
        const albumType = params.get('albumType');
        const albumIndex = params.get('album');
        if (albumType && albumIndex && artist[albumType] && artist[albumType][parseInt(albumIndex)]) {
            document.title = `${artist.name} - ${artist[albumType][parseInt(albumIndex)].name} | kr4.pro`;
            renderAlbumPage(albumType, parseInt(albumIndex));
            showPage('album');
            const trackIndex = params.get('track');
            if (trackIndex) {
                loadAndPlay(currentPlaylist.find(t => t.trackIndex == trackIndex));
            }
        } else {
            document.title = `${artist.name} | kr4.pro`;
            renderArtistPage();
            showPage('artist');
        }
        renderOtherArtistsSection(artistId);
        updatePlayerUI();
    };

    // --- Event Listeners Setup (модифицированы для аналитики) ---
    audio.onplay = () => {
        isPlaying = true;
        playPauseBtn.textContent = '⏸';
        updatePlayerUI();
        // Отправляем событие только при первом старте трека
        if (audio.currentTime < 1) {
            logPlayerEvent('play_started');
        }
    };
    audio.onpause = () => {
        isPlaying = false;
        playPauseBtn.textContent = '▶';
        updatePlayerUI();
    };
    
    audio.ontimeupdate = () => {
        if (audio.duration) {
            progressBar.value = (audio.currentTime / audio.duration) * 100 || 0;
            currentTimeEl.textContent = formatTime(audio.currentTime);
        }
        // ✅ МОДИФИЦИРОВАНО: Логика ключевого события '30s_listen'
        if (!listenCounted && audio.currentTime >= 30) {
            listenCounted = true; // Считаем только один раз за трек
            logPlayerEvent('30s_listen');
        }
    };

    audio.onloadedmetadata = () => { if(audio.duration) durationEl.textContent = formatTime(audio.duration); };
    
    audio.onended = () => {
        logPlayerEvent('track_completed'); // Трек дослушан до конца
        const currentIndex = findTrackInPlaylist(currentTrackData);
        if (currentIndex !== -1 && currentIndex < currentPlaylist.length - 1) {
            loadAndPlay(currentPlaylist[currentIndex + 1]);
        } else if (isShuffleOn && currentPlaylist.length > 0) {
            loadAndPlay(currentPlaylist[0]);
        } else {
            isPlaying = false;
            updatePlayerUI();
        }
    };

    playPauseBtn.onclick = () => isPlaying ? audio.pause() : audio.play();
    prevBtn.onclick = () => { const currentIndex = findTrackInPlaylist(currentTrackData); if (currentIndex > 0) { loadAndPlay(currentPlaylist[currentIndex - 1]); } };
    nextBtn.onclick = () => { const currentIndex = findTrackInPlaylist(currentTrackData); if (currentIndex !== -1 && currentIndex < currentPlaylist.length - 1) { loadAndPlay(currentPlaylist[currentIndex + 1]); } };
    progressBar.oninput = (e) => { if (audio.duration) audio.currentTime = (e.target.value / 100) * audio.duration; };
    if (seeDiscographyBtn) { seeDiscographyBtn.onclick = () => document.getElementById('all-tracks-section').scrollIntoView({ behavior: 'smooth' }); }

    if (headerRandomBtn) {
        headerRandomBtn.addEventListener('click', () => {
            if (allArtistTracks.length === 0) return;
            if (currentPlaylistSource === 'all-tracks' && isPlaying) {
                audio.pause();
            } else if (currentPlaylistSource === 'all-tracks' && !isPlaying) {
                audio.play();
            } else {
                const randomIndex = Math.floor(Math.random() * allArtistTracks.length);
                currentPlaylist = allArtistTracks.slice(randomIndex).concat(allArtistTracks.slice(0, randomIndex));
                currentPlaylistSource = 'all-tracks';
                originalPlaylist = [...currentPlaylist];
                loadAndPlay(currentPlaylist[0]);
            }
        });
    }

    allTracksShuffleBtn.addEventListener('click', () => {
        if (currentPlaylistSource !== 'all-tracks') {
            currentPlaylistSource = 'all-tracks';
            originalPlaylist = [...allArtistTracks];
            currentPlaylist = [...allArtistTracks];
        }
        toggleShuffle();
    });
    albumShuffleBtn.addEventListener('click', () => {
        if (currentPlaylistSource === 'album') {
            toggleShuffle();
        }
    });

    // --- Event Delegation ---
    artistPage.addEventListener('click', (e) => {
        const allTracksSection = e.target.closest('#all-tracks-section');
        if (allTracksSection) {
            const playBtn = e.target.closest('#all-tracks-play-btn');
            if (playBtn) {
                if (currentPlaylistSource === 'all-tracks' && isPlaying) {
                    audio.pause();
                } else if (currentPlaylistSource === 'all-tracks' && !isPlaying) {
                    audio.play();
                } else {
                    currentPlaylistSource = 'all-tracks';
                    currentPlaylist = [...allArtistTracks];
                    originalPlaylist = [...allArtistTracks];
                    if (isShuffleOn) {
                        currentPlaylist = shuffleArray(currentPlaylist);
                    }
                    loadAndPlay(currentPlaylist[0]);
                }
            }
            if (e.target.closest('#artist-share-btn')) {
                handleShareClick(`${location.origin}${location.pathname}?artist=${artistId}`, e.target.closest('#artist-share-btn'));
            }
            const trackItem = e.target.closest('.track-item');
            if (trackItem) {
                if (e.target.closest('.share-btn')) {
                    const trackData = allArtistTracks.find(t => t.file === trackItem.dataset.filePath);
                    handleShareClick(`${location.origin}${location.pathname}?artist=${artistId}&albumType=${trackData.albumType}&album=${trackData.albumIndex}&track=${trackData.trackIndex}`, e.target.closest('.share-btn'));
                } else {
                     const trackData = {
                        file: trackItem.dataset.filePath,
                        albumType: trackItem.dataset.albumType,
                        albumIndex: parseInt(trackItem.dataset.albumIndex, 10)
                    };
                    handleTrackClick(trackData, 'all-tracks');
                }
            }
            if (e.target.matches('.show-hide-btn')) {
                showingAllTracks = !showingAllTracks;
                renderAllTracksSection();
            }
        }
        
        const discographySection = e.target.closest('.discography-section');
        if (discographySection) {
            const tabBtn = e.target.closest('.tab-btn');
            if (tabBtn) switchTab(tabBtn.dataset.tab);
            const albumCard = e.target.closest('.album-card');
            if (albumCard) {
                history.pushState(null, '', `${location.pathname}?artist=${artistId}&albumType=${albumCard.dataset.albumType}&album=${albumCard.dataset.albumIndex}`);
                handleNavigation();
            }
        }
    });
    
    albumPage.addEventListener('click', (e) => {
        const playBtn = e.target.closest('#album-play-btn');
        if (playBtn) {
            if (currentPlaylistSource === 'album' && isPlaying) {
                audio.pause();
            } else if (currentPlaylistSource === 'album' && !isPlaying) {
                audio.play();
            } else {
                currentPlaylistSource = 'album';
                currentPlaylist = [...originalPlaylist];
                if (isShuffleOn) {
                    currentPlaylist = shuffleArray(currentPlaylist);
                }
                loadAndPlay(currentPlaylist[0]);
            }
        }
        if (e.target.closest('#album-share-btn-main')) {
            handleShareClick(`${location.origin}${location.pathname}?artist=${artistId}&albumType=${currentPlaylist[0].albumType}&album=${currentPlaylist[0].albumIndex}`, e.target.closest('#album-share-btn-main'));
        }
        const trackItem = e.target.closest('.track-item');
        if (trackItem) {
            if (e.target.closest('.share-btn')) {
                const trackData = currentPlaylist.find(t => t.file === trackItem.dataset.filePath);
                handleShareClick(`${location.origin}${location.pathname}?artist=${artistId}&albumType=${trackData.albumType}&album=${trackData.albumIndex}&track=${trackData.trackIndex}`, e.target.closest('.share-btn'));
            } else {
                const trackFile = trackItem.dataset.filePath;
                const trackData = currentPlaylist.find(t => t.file === trackFile);
                if (trackData) {
                    handleTrackClick(trackData, 'album');
                }
            }
        }
        const albumCard = e.target.closest('.album-card');
        if (albumCard) {
            history.pushState(null, '', `${location.pathname}?artist=${artistId}&albumType=${albumCard.dataset.albumType}&album=${albumCard.dataset.albumIndex}`);
            handleNavigation();
        }
        if (e.target.closest('#back-to-artist')) {
            e.preventDefault();
            history.pushState(null, '', `${location.pathname}?artist=${artistId}`);
            handleNavigation();
        }
    });
    
    window.onpopstate = handleNavigation;
    handleNavigation();
});
