document.addEventListener('DOMContentLoaded', () => {
    
    // === ДОБАВЛЕНО: Переменные для прокси функциональности ===
    let useProxyForTracks = false;
    let locationDetected = false;

    // === ДОБАВЛЕНО: Функция инициализации определения локации ===
    const initializeLocationDetection = async () => {
        try {
            console.log('🌍 Initializing location detection...');
            
            // Определяем является ли пользователь российским
            const isRussian = await LocationDetector.detectRussianUser();
            useProxyForTracks = isRussian;
            locationDetected = true;
            
            if (isRussian) {
                console.log('🇷🇺 Russian user detected - proxy mode enabled');
            } else {
                console.log('🌍 International user - direct connection mode');
            }
            
            // Тест подключения к proxy (для отладки)
            const connectionTest = await LocationDetector.testConnection();
            console.log('🔗 Proxy connection test:', connectionTest);
            
        } catch (error) {
            console.error('❌ Failed to initialize location detection:', error);
            locationDetected = true; // Помечаем как завершенную даже при ошибке
        }
    };

    // === ДОБАВЛЕНО: Функция получения URL трека с учетом прокси ===
    const getTrackUrlForPlayback = (track) => {
        if (!locationDetected) {
            // Если локация еще не определена, используем оригинальный URL
            console.warn('⏳ Location not yet detected, using original URL');
            return track.file;
        }
        
        return LocationDetector.processTrackUrl(track.file, useProxyForTracks);
    };

    // === ДОБАВЛЕНО: Функция отправки аналитики с информацией о прокси ===
    const logPlayerEvent = async (eventType, trackData) => {
        if (!trackData || !trackData.file) return;

        try {
            await fetch('/api/listen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trackId: trackData.file,
                    eventType: eventType,
                    proxyUsed: useProxyForTracks // Добавить информацию о proxy
                }),
            });
            console.log(`Analytics Event: '${eventType}' sent (proxy: ${useProxyForTracks})`);
        } catch (error) {
            console.error(`Failed to log analytics event '${eventType}':`, error);
        }
    };
    
    /**
     * Главный управляющий модуль для страницы артиста.
     * Инкапсулирует состояние, логику рендеринга, навигацию и управление плеером.
     */
    const ArtistPage = {
        // --- Состояние приложения ---
        state: {
            artist: null,
            artistId: null,
            currentAlbum: null,
            allArtistTracks: [],
            currentPlaylist: [],
            originalPlaylist: [],
            currentTrack: null,
            currentPlaylistSource: null, // 'all-tracks' или 'album'
            isShuffleOn: false,
            showingAllTracks: false,
        },

        // --- Элементы DOM (кэшируются для производительности) ---
        dom: {},

        // --- Вложенный модуль плеера ---
        player: null,

        /**
         * Точка входа. Инициализирует всё приложение.
         */
        async init() {
            if (typeof window.artistData === 'undefined') {
                document.body.innerHTML = '<h1>Ошибка: Данные артистов не найдены.</h1>';
                console.error('window.artistData не определен.');
                return;
            }

            this.queryDOMElements();
            
            this.player = new Player(this.dom.audio, {
                onPlay: this.onPlayerPlay.bind(this),
                onPause: this.onPlayerPause.bind(this),
                onEnded: this.onPlayerEnded.bind(this),
                onTimeUpdate: this.onPlayerTimeUpdate.bind(this),
                onLoadedMetadata: this.onPlayerLoadedMetadata.bind(this),
            });

            this.bindEvents();
            this.handleNavigation();
            
            // === ДОБАВЛЕНО: Инициализация определения локации ===
            await initializeLocationDetection();
        },
        
        /**
         * Находит и сохраняет все необходимые DOM-элементы в this.dom.
         */
        queryDOMElements() {
            const getById = (id) => document.getElementById(id);
            const query = (sel) => document.querySelector(sel);
            
            this.dom = {
                audio: getById('audio-source'),
                playerFooter: query('.player-footer'),
                playPauseBtn: getById('play-pause-btn'),
                prevBtn: getById('prev-btn'),
                nextBtn: getById('next-btn'),
                progressBar: getById('progress-bar'),
                currentTimeEl: getById('current-time'),
                durationEl: getById('duration'),
                currentTrackTitleEl: getById('current-track-title'),
                artistPage: getById('artist-page'),
                albumPage: getById('album-page'),
                allTracksShuffleBtn: getById('all-tracks-shuffle-btn'),
                albumShuffleBtn: getById('album-shuffle-btn'),
                // Добавляем кнопки Play
                allTracksPlayBtn: getById('all-tracks-play-btn'),
                albumPlayBtn: getById('album-play-btn'),
                // НОВОЕ: Добавляем кнопку Discography
                discographyBtn: getById('see-discography-btn'),
                // Добавляем остальные элементы
                artistAvatar: getById('artist-avatar'),
                artistName: getById('artist-name'),
                artistDesc1: getById('artist-description-line1'),
                artistDesc2: getById('artist-description-line2'),
                allTracksSection: getById('all-tracks-section'),
                discographySection: getById('discography-section'),
                albumCover: getById('album-cover'),
                albumTitle: getById('album-title'),
                albumArtist: getById('album-artist'),
                albumStats: getById('album-stats'),
                albumPlaylistContainer: getById('album-playlist-container'),
                otherReleasesCarousel: getById('other-releases-carousel'),
                otherReleasesSection: query('.other-releases-section'),
                otherArtistsContainer: getById('other-artists-container')
            };
        },

        /**
         * Привязывает глобальные обработчики событий.
         */
        bindEvents() {
            this.dom.artistPage.addEventListener('click', this.handleArtistPageClick.bind(this));
            this.dom.albumPage.addEventListener('click', this.handleAlbumPageClick.bind(this));
            window.addEventListener('popstate', this.handleNavigation.bind(this));
            
            this.dom.playPauseBtn.addEventListener('click', () => this.player.togglePlayPause());
            this.dom.nextBtn.addEventListener('click', () => this.playNextTrack());
            this.dom.prevBtn.addEventListener('click', () => this.playPrevTrack());
            this.dom.progressBar.addEventListener('input', (e) => this.player.scrub(e.target.value / 100));

            this.dom.allTracksShuffleBtn.addEventListener('click', () => this.toggleShuffle('all-tracks'));
            this.dom.albumShuffleBtn.addEventListener('click', () => this.toggleShuffle('album'));

            // Добавляем обработчики для кнопок Play
            if (this.dom.allTracksPlayBtn) {
                this.dom.allTracksPlayBtn.addEventListener('click', () => this.handleAllTracksPlay());
            }
            if (this.dom.albumPlayBtn) {
                this.dom.albumPlayBtn.addEventListener('click', () => this.handleAlbumPlay());
            }

            // НОВОЕ: Добавляем обработчик для кнопки Discography
            if (this.dom.discographyBtn) {
                this.dom.discographyBtn.addEventListener('click', () => this.scrollToDiscography());
            }
        },

        // НОВОЕ: Метод для прокрутки к секции Discography
        scrollToDiscography() {
            if (this.dom.discographySection) {
                this.dom.discographySection.scrollIntoView({ 
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        },

        // === ОБНОВЛЕНО: Добавлена поддержка прокси URL ===
        handleAllTracksPlay() {
            if (this.state.currentPlaylistSource === 'all-tracks' && this.player.isPlaying) {
                this.player.pause();
            } else if (this.state.currentPlaylistSource === 'all-tracks' && !this.player.isPlaying) {
                this.player.play();
            } else {
                this.state.currentPlaylistSource = 'all-tracks';
                this.state.currentPlaylist = [...this.state.allArtistTracks];
                this.state.originalPlaylist = [...this.state.allArtistTracks];
                if (this.state.isShuffleOn) {
                    this.state.currentPlaylist = this.shuffleArray(this.state.currentPlaylist);
                }
                const firstTrack = this.state.currentPlaylist[0];
                const trackUrl = getTrackUrlForPlayback(firstTrack);
                this.player.load({ ...firstTrack, file: trackUrl });
                this.player.play();
            }
        },

        // === ОБНОВЛЕНО: Добавлена поддержка прокси URL ===
        handleAlbumPlay() {
            if (this.state.currentPlaylistSource === 'album' && this.player.isPlaying) {
                this.player.pause();
            } else if (this.state.currentPlaylistSource === 'album' && !this.player.isPlaying) {
                this.player.play();
            } else {
                this.state.currentPlaylistSource = 'album';
                const albumTracks = this.state.currentAlbum.tracks.map((track, i) => ({
                    ...track,
                    albumName: this.state.currentAlbum.name,
                    albumType: this.state.currentAlbum.type,
                    albumIndex: this.state.currentAlbum.index,
                    trackIndex: i
                }));
                this.state.currentPlaylist = [...albumTracks];
                this.state.originalPlaylist = [...albumTracks];
                if (this.state.isShuffleOn) {
                    this.state.currentPlaylist = this.shuffleArray(this.state.currentPlaylist);
                }
                const firstTrack = this.state.currentPlaylist[0];
                const trackUrl = getTrackUrlForPlayback(firstTrack);
                this.player.load({ ...firstTrack, file: trackUrl });
                this.player.play();
            }
        },
        
        /**
         * Главный роутер. Определяет, что рендерить на основе URL.
         */
        handleNavigation() {
            const params = new URLSearchParams(window.location.search);
            this.state.artistId = params.get('artist');
            this.state.artist = window.artistData[this.state.artistId];

            if (!this.state.artist) {
                document.body.innerHTML = '<h1>No such artist</h1>';
                return;
            }
            
            this.state.allArtistTracks = this.collectAllTracks(this.state.artist);

            const albumType = params.get('albumType');
            const albumIndex = params.get('album');
            const trackIndex = params.get('track');

            if (albumType && albumIndex !== null && this.state.artist[albumType]?.[parseInt(albumIndex, 10)]) {
                const idx = parseInt(albumIndex, 10);
                this.state.currentAlbum = { ...this.state.artist[albumType][idx], type: albumType, index: idx };
                this.renderAlbumPage(albumType, idx);
                this.showPage('album');
                document.title = `${this.state.artist.name} - ${this.state.currentAlbum.name} | kr4.pro`;
                
                // Если указан конкретный трек, запускаем его
                if (trackIndex !== null && trackIndex !== 'undefined') {
                    const trackIdx = parseInt(trackIndex, 10);
                    if (trackIdx >= 0 && trackIdx < this.state.currentAlbum.tracks.length) {
                        const track = {
                            ...this.state.currentAlbum.tracks[trackIdx],
                            albumName: this.state.currentAlbum.name,
                            albumType: this.state.currentAlbum.type,
                            albumIndex: this.state.currentAlbum.index,
                            trackIndex: trackIdx
                        };
                        this.setPlaylist('album', track);
                    }
                }
            } else {
                this.renderArtistPage();
                this.showPage('artist');
                document.title = `${this.state.artist.name} | kr4.pro`;
            }
            this.renderOtherArtistsSection(this.state.artistId);
        },

        // --- Логика воспроизведения ---

        // === ОБНОВЛЕНО: Добавлена поддержка прокси URL ===
        setPlaylist(source, trackData) {
            this.state.currentPlaylistSource = source;
            let basePlaylist;

            if (source === 'all-tracks') {
                basePlaylist = [...this.state.allArtistTracks];
            } else {
                const album = this.state.artist[trackData.albumType][trackData.albumIndex];
                basePlaylist = album.tracks.map((t, i) => ({ ...t, albumName: album.name, albumType: trackData.albumType, albumIndex: trackData.albumIndex, trackIndex: i }));
            }
            
            this.state.originalPlaylist = [...basePlaylist];
            const startIndex = basePlaylist.findIndex(t => t.file === trackData.file);
            
            this.state.currentPlaylist = basePlaylist.slice(startIndex).concat(basePlaylist.slice(0, startIndex));

            if (this.state.isShuffleOn) {
                this.applyShuffle();
            }

            const firstTrack = this.state.currentPlaylist[0];
            const trackUrl = getTrackUrlForPlayback(firstTrack);
            this.player.load({ ...firstTrack, file: trackUrl });
            this.player.play();
        },

        // === ОБНОВЛЕНО: Добавлена поддержка прокси URL ===
        playNextTrack() {
            const currentIndex = this.state.currentPlaylist.findIndex(t => t.file === this.state.currentTrack.file);
            if (currentIndex !== -1 && currentIndex < this.state.currentPlaylist.length - 1) {
                const nextTrack = this.state.currentPlaylist[currentIndex + 1];
                const trackUrl = getTrackUrlForPlayback(nextTrack);
                this.player.load({ ...nextTrack, file: trackUrl });
                this.player.play();
            }
        },

        // === ОБНОВЛЕНО: Добавлена поддержка прокси URL ===
        playPrevTrack() {
            const currentIndex = this.state.currentPlaylist.findIndex(t => t.file === this.state.currentTrack.file);
            if (currentIndex > 0) {
                const prevTrack = this.state.currentPlaylist[currentIndex - 1];
                const trackUrl = getTrackUrlForPlayback(prevTrack);
                this.player.load({ ...prevTrack, file: trackUrl });
                this.player.play();
            }
        },

        toggleShuffle(source) {
            if (this.state.currentPlaylistSource !== source) {
                this.state.currentPlaylistSource = source;
                this.state.currentPlaylist = source === 'all-tracks' ? [...this.state.allArtistTracks] : [...this.state.currentAlbum.tracks];
                this.state.originalPlaylist = [...this.state.currentPlaylist];
            }
            
            this.state.isShuffleOn = !this.state.isShuffleOn;

             if (this.state.isShuffleOn) {
                this.applyShuffle();
            } else {
                const currentFile = this.state.currentTrack?.file;
                this.state.currentPlaylist = [...this.state.originalPlaylist];
                if (currentFile) {
                     const newIndex = this.state.currentPlaylist.findIndex(t => t.file === currentFile);
                     if(newIndex > -1){
                        const current = this.state.currentPlaylist.splice(newIndex, 1)[0];
                        this.state.currentPlaylist.unshift(current);
                     }
                }
            }
            this.updatePlayerUI();
        },
        
        applyShuffle() {
            if (!this.state.currentTrack) {
                 this.state.currentPlaylist = this.shuffleArray(this.state.currentPlaylist);
                 return;
            }
            const currentIndex = this.state.currentPlaylist.findIndex(t => t.file === this.state.currentTrack.file);
            const playingTrack = this.state.currentPlaylist.splice(currentIndex, 1)[0];
            const shuffled = this.shuffleArray(this.state.currentPlaylist);
            this.state.currentPlaylist = [playingTrack, ...shuffled];
        },

        // --- ВОССТАНОВЛЕННАЯ ФУНКЦИОНАЛЬНОСТЬ SHARE ---

        /**
         * Обрабатывает клики по кнопкам "Поделиться".
         * Поддерживает нативный Web Share API или копирует в буфер обмена.
         */
        handleShareClick(url, button) {
            const shareData = { 
                title: document.title, 
                text: `Check out this music on kr4.pro`, 
                url: url 
            };
            
            if (navigator.share && navigator.canShare(shareData)) {
                navigator.share(shareData).catch((error) => {
                    console.log('Error sharing:', error);
                });
            } else {
                // Fallback: копирование в буфер обмена
                navigator.clipboard.writeText(url).then(() => {
                    const originalContent = button.innerHTML;
                    button.innerHTML = 'Copied!';
                    setTimeout(() => { 
                        button.innerHTML = originalContent; 
                    }, 2000);
                }).catch((error) => {
                    console.error('Failed to copy to clipboard:', error);
                    // Дополнительный fallback для старых браузеров
                    this.fallbackCopyToClipboard(url, button);
                });
            }
        },

        /**
         * Fallback для копирования в буфер обмена в старых браузерах.
         */
        fallbackCopyToClipboard(text, button) {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            
            try {
                document.execCommand('copy');
                const originalContent = button.innerHTML;
                button.innerHTML = 'Copied!';
                setTimeout(() => { 
                    button.innerHTML = originalContent; 
                }, 2000);
            } catch (err) {
                console.error('Fallback copy failed:', err);
            }
            
            document.body.removeChild(textArea);
        },

        // --- Обработчики событий плеера ---
        onPlayerPlay(track) {
            this.state.currentTrack = track;
            this.dom.playerFooter.classList.add('visible');
            document.body.classList.add('body-with-player');
            this.updatePlayerUI();
        },
        onPlayerPause() { this.updatePlayerUI(); },
        onPlayerEnded() { this.playNextTrack(); },
        onPlayerTimeUpdate(currentTime, duration) {
            this.dom.progressBar.value = (currentTime / duration) * 100 || 0;
            this.dom.currentTimeEl.textContent = this.formatTime(currentTime);
        },
        onPlayerLoadedMetadata(duration, track) {
            this.dom.durationEl.textContent = this.formatTime(duration);
            this.dom.currentTrackTitleEl.textContent = `${track.title}`;
        },

        // --- Рендеринг и UI ---
        
        showPage(page) {
            this.dom.artistPage.classList.toggle('active', page === 'artist');
            this.dom.albumPage.classList.toggle('active', page === 'album');
            window.scrollTo(0, 0);
        },
        
        updatePlayerUI() {
            const isPlaying = this.player.isPlaying;
            const currentFile = this.player.currentTrack?.file;

            this.dom.playPauseBtn.textContent = isPlaying ? '⏸' : '▶';

            // Обновляем состояние кнопок Play
            document.querySelectorAll('.play-action-btn .play-circle').forEach(btn => {
                btn.classList.remove('playing');
            });

            if (isPlaying) {
                if (this.state.currentPlaylistSource === 'all-tracks') {
                    this.dom.allTracksPlayBtn?.querySelector('.play-circle')?.classList.add('playing');
                } else if (this.state.currentPlaylistSource === 'album') {
                    this.dom.albumPlayBtn?.querySelector('.play-circle')?.classList.add('playing');
                }
            }

            document.querySelectorAll('.track-item').forEach(item => {
                const isActive = item.dataset.filePath === currentFile;
                item.classList.toggle('active', isActive);
                item.classList.toggle('playing', isActive && isPlaying);
                item.classList.toggle('paused', isActive && !isPlaying);
            });
            
            this.dom.allTracksShuffleBtn.classList.toggle('active', this.state.isShuffleOn && this.state.currentPlaylistSource === 'all-tracks');
            this.dom.albumShuffleBtn.classList.toggle('active', this.state.isShuffleOn && this.state.currentPlaylistSource === 'album');
        },

        renderArtistPage() {
            const artist = this.state.artist;
            this.dom.artistAvatar.src = artist.image;
            this.dom.artistName.textContent = artist.name;
            this.dom.artistDesc1.textContent = artist.description_line1;
            this.dom.artistDesc2.textContent = artist.description_line2;
            
            this.renderAllTracksSection();

            const releaseTypes = ['albums', 'eps', 'demos'];
            releaseTypes.forEach(type => {
                const tabBtn = document.getElementById(`${type}-tab-btn`);
                const carousel = document.getElementById(`album-carousel-${type}`);
                const hasContent = artist[type] && artist[type].length > 0;
                
                tabBtn.disabled = !hasContent;
                if(hasContent) {
                    carousel.innerHTML = '';
                    artist[type].forEach((album, index) => {
                        carousel.appendChild(this.createAlbumCard(album, type, index));
                    });
                }
            });
            const firstAvailableTab = releaseTypes.find(type => artist[type] && artist[type].length > 0);
            this.switchTab(firstAvailableTab);
        },

        renderAllTracksSection() {
            const container = this.dom.allTracksSection.querySelector('.track-list');
            container.innerHTML = '';
            
            const tracksToDisplay = this.state.showingAllTracks ? this.state.allArtistTracks : this.state.allArtistTracks.slice(0, 4);
            tracksToDisplay.forEach(track => {
                container.appendChild(this.createTrackElement(track, true));
            });

            let showHideBtn = this.dom.allTracksSection.querySelector('.show-hide-btn');
            if (this.state.allArtistTracks.length > 4) {
                if (!showHideBtn) {
                    showHideBtn = document.createElement('button');
                    showHideBtn.className = 'show-hide-btn';
                    this.dom.allTracksSection.appendChild(showHideBtn);
                }
                showHideBtn.textContent = this.state.showingAllTracks ? 'HIDE ALL TRACKS' : 'SHOW ALL TRACKS';
                showHideBtn.style.display = 'block';
            } else if (showHideBtn) {
                showHideBtn.style.display = 'none';
            }
            this.updatePlayerUI();
        },
        
        renderAlbumPage(albumType, albumIndex) {
            const album = this.state.artist[albumType][albumIndex];
            this.dom.albumCover.src = album.cover || 'images/default_cover.jpg';
            this.dom.albumTitle.textContent = album.name;
            this.dom.albumArtist.textContent = this.state.artist.name;
            const totalDuration = album.tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
            this.dom.albumStats.textContent = `${album.tracks.length} tracks, ${this.formatDuration(totalDuration)}`;
            
            this.dom.albumPlaylistContainer.innerHTML = '';
            album.tracks.forEach((track, i) => {
                const trackData = { ...track, albumName: album.name, albumType, albumIndex, trackIndex: i };
                this.dom.albumPlaylistContainer.appendChild(this.createTrackElement(trackData, false));
            });

            this.renderOtherReleases(albumType, albumIndex);
            this.updatePlayerUI();
        },
        
        renderOtherReleases(currentType, currentIndex) {
            const allReleases = [];
            ['albums', 'eps', 'demos'].forEach(type => {
                (this.state.artist[type] || []).forEach((release, index) => {
                    if (type !== currentType || index !== currentIndex) {
                        allReleases.push({ ...release, originalType: type, originalIndex: index });
                    }
                });
            });

            this.dom.otherReleasesCarousel.innerHTML = '';
            if (allReleases.length > 0) {
                this.dom.otherReleasesSection.style.display = 'block';
                allReleases.forEach(release => {
                    this.dom.otherReleasesCarousel.appendChild(this.createAlbumCard(release, release.originalType, release.originalIndex));
                });
            } else {
                this.dom.otherReleasesSection.style.display = 'none';
            }
        },
        
        renderOtherArtistsSection(currentArtistId) {
            this.dom.otherArtistsContainer.innerHTML = '';
            Object.keys(window.artistData).forEach(id => {
                if(id !== currentArtistId) {
                    const otherArtist = window.artistData[id];
                    const card = document.createElement('a');
                    card.href = `artist.html?artist=${id}`;
                    card.className = 'artist-choice-card';
                    card.innerHTML = `<img src="${otherArtist.image}" alt="Аватар ${otherArtist.name}"><h2>${otherArtist.name}</h2>`;
                    this.dom.otherArtistsContainer.appendChild(card);
                }
            });
        },
        
        switchTab(tabType) {
            if (!tabType) return;
            ['albums', 'eps', 'demos'].forEach(type => {
                document.getElementById(`${type}-tab-btn`).classList.toggle('active', type === tabType);
                document.getElementById(`${type}-pane`).classList.toggle('active', type === tabType);
            });
        },

        // --- Создание элементов (вместо innerHTML) ---
        createAlbumCard(album, type, index) {
            const card = document.createElement('div');
            card.className = 'album-card';
            card.dataset.albumType = type;
            card.dataset.albumIndex = index;
            card.innerHTML = `<img src="${album.cover || 'images/default_cover.jpg'}" alt="${album.name}"><p>${album.name}</p>`;
            return card;
        },

        createTrackElement(track, showAlbumName) {
            const item = document.createElement('div');
            item.className = 'track-item';
            item.dataset.filePath = track.file;
            
            // Убеждаемся, что trackIndex всегда определен
            if (showAlbumName && track.trackIndex === undefined) {
                // Для треков из "All Tracks" ищем trackIndex
                const albumTracks = this.state.artist[track.albumType][track.albumIndex].tracks;
                track.trackIndex = albumTracks.findIndex(t => t.file === track.file);
            }

            item.innerHTML = `
                <div class="track-number">
                    <span class="track-number-text">${track.num || '—'}</span>
                    <div class="track-number-play"></div>
                    <div class="track-number-equalizer"><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div></div>
                </div>
                <div class="track-item-info">
                    <div class="track-item-title">${track.title}</div>
                    ${showAlbumName ? `<div class="track-item-album">${track.albumName}</div>` : ''}
                </div>
                <span class="track-item-duration">${track.duration ? this.formatTime(track.duration) : '—:—'}</span>
                <button class="share-btn" title="Share Track"><svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3s3-1.34 3-3-1.34-3-3-3z"></path></svg></button>
            `;
            return item;
        },

        // --- Обработчики кликов (делегирование) ---
        handleArtistPageClick(e) {
            const shareBtn = e.target.closest('.share-btn');
            if (shareBtn) {
                const trackItem = shareBtn.closest('.track-item');
                if (trackItem) {
                    const trackData = this.state.allArtistTracks.find(t => t.file === trackItem.dataset.filePath);
                    if (trackData && trackData.trackIndex !== undefined) {
                        const shareUrl = `${location.origin}${location.pathname}?artist=${this.state.artistId}&albumType=${trackData.albumType}&album=${trackData.albumIndex}&track=${trackData.trackIndex}`;
                        this.handleShareClick(shareUrl, shareBtn);
                    }
                }
                return;
            }

            if (e.target.closest('#artist-share-btn')) {
                const shareUrl = `${location.origin}${location.pathname}?artist=${this.state.artistId}`;
                this.handleShareClick(shareUrl, e.target.closest('#artist-share-btn'));
                return;
            }

            const trackItem = e.target.closest('.track-item');
            if (trackItem) {
                const trackData = this.state.allArtistTracks.find(t => t.file === trackItem.dataset.filePath);
                this.handleTrackClick(trackData, 'all-tracks');
                return;
            }

            const albumCard = e.target.closest('.album-card');
            if (albumCard) {
                const { albumType, albumIndex } = albumCard.dataset;
                history.pushState(null, '', `?artist=${this.state.artistId}&albumType=${albumType}&album=${albumIndex}`);
                this.handleNavigation();
                return;
            }

            if(e.target.closest('.tab-btn')) {
                this.switchTab(e.target.closest('.tab-btn').dataset.tab);
            }
            
            if(e.target.matches('.show-hide-btn')) {
                this.state.showingAllTracks = !this.state.showingAllTracks;
                this.renderAllTracksSection();
            }
        },

        handleAlbumPageClick(e) {
            const shareBtn = e.target.closest('.share-btn');
            if (shareBtn) {
                const trackItem = shareBtn.closest('.track-item');
                if (trackItem) {
                    const trackData = this.state.currentAlbum.tracks.find(t => t.file === trackItem.dataset.filePath);
                    if (trackData) {
                        const trackIndex = this.state.currentAlbum.tracks.findIndex(t => t.file === trackItem.dataset.filePath);
                        const shareUrl = `${location.origin}${location.pathname}?artist=${this.state.artistId}&albumType=${this.state.currentAlbum.type}&album=${this.state.currentAlbum.index}&track=${trackIndex}`;
                        this.handleShareClick(shareUrl, shareBtn);
                    }
                }
                return;
            }

            if (e.target.closest('#album-share-btn-main')) {
                const shareUrl = `${location.origin}${location.pathname}?artist=${this.state.artistId}&albumType=${this.state.currentAlbum.type}&album=${this.state.currentAlbum.index}`;
                this.handleShareClick(shareUrl, e.target.closest('#album-share-btn-main'));
                return;
            }

            const trackItem = e.target.closest('.track-item');
            if (trackItem) {
                const trackData = this.state.currentAlbum.tracks.find(t => t.file === trackItem.dataset.filePath);
                if (trackData) {
                    const trackIndex = this.state.currentAlbum.tracks.findIndex(t => t.file === trackItem.dataset.filePath);
                    const fullTrackData = { 
                        ...trackData, 
                        albumName: this.state.currentAlbum.name, 
                        albumType: this.state.currentAlbum.type, 
                        albumIndex: this.state.currentAlbum.index,
                        trackIndex: trackIndex
                    };
                    this.handleTrackClick(fullTrackData, 'album');
                }
                return;
            }

            const albumCard = e.target.closest('.album-card');
            if(albumCard) {
                const { albumType, albumIndex } = albumCard.dataset;
                history.pushState(null, '', `?artist=${this.state.artistId}&albumType=${albumType}&album=${albumIndex}`);
                this.handleNavigation();
                return;
            }
            
            if (e.target.closest('#back-to-artist')) {
                e.preventDefault();
                history.pushState(null, '', `?artist=${this.state.artistId}`);
                this.handleNavigation();
            }
        },
        
        handleTrackClick(trackData, source) {
            const isSameTrack = this.player.currentTrack?.file === trackData.file;
            const isSameSource = this.state.currentPlaylistSource === source;

            if (isSameTrack && isSameSource) {
                this.player.togglePlayPause();
            } else {
                this.setPlaylist(source, trackData);
            }
        },

        // --- Утилиты ---
        formatTime: (s) => { const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m}:${sec < 10 ? '0' : ''}${sec}`; },
        formatDuration: (s) => { const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return h > 0 ? `${h}h ${m}m` : `${m}m ${Math.floor(s % 60)}s`; },
        shuffleArray(array) {
            let currentIndex = array.length;
            const newArray = [...array];
            while (currentIndex !== 0) {
                let randomIndex = Math.floor(Math.random() * currentIndex);
                currentIndex--;
                [newArray[currentIndex], newArray[randomIndex]] = [newArray[randomIndex], newArray[currentIndex]];
            }
            return newArray;
        },
        collectAllTracks(artist) {
            const allTracks = [];
            ['albums', 'eps', 'demos'].forEach((type) => {
                (artist[type] || []).forEach((release, albumIndex) => {
                    release.tracks.forEach((track, trackIndex) => {
                        allTracks.push({ ...track, albumName: release.name, albumType: type, albumIndex, trackIndex });
                    });
                });
            });
            return allTracks;
        },
    };
    
    /**
     * Отдельный класс для управления аудио-плеером и аналитикой.
     */
    class Player {
        constructor(audioElement, callbacks) {
            this.audio = audioElement;
            this.callbacks = callbacks;
            this.currentTrack = null;
            this.isPlaying = false;
            this.listenCounted = false;
            this._bindAudioEvents();
        }
        
        load(track) {
            if (this.isPlaying && !this.listenCounted) {
                logPlayerEvent('track_skipped', this.currentTrack);
            }
            this.currentTrack = track;
            this.listenCounted = false;
            this.audio.src = track.file;
            this.audio.load();
        }
        
        play() { this.audio.play(); }
        pause() { this.audio.pause(); }
        togglePlayPause() { this.isPlaying ? this.pause() : this.play(); }
        scrub(percentage) { if(this.audio.duration) this.audio.currentTime = this.audio.duration * percentage; }
        
        // === ОБНОВЛЕНО: Интеграция с новой системой аналитики ===
        async logEvent(eventType) {
            if (!this.currentTrack) return;
            await logPlayerEvent(eventType, this.currentTrack);
        }

        _bindAudioEvents() {
            this.audio.addEventListener('play', () => {
                this.isPlaying = true;
                if(this.audio.currentTime < 1) this.logEvent('play_started');
                this.callbacks.onPlay(this.currentTrack);
            });
            this.audio.addEventListener('pause', () => {
                this.isPlaying = false;
                this.callbacks.onPause();
            });
            this.audio.addEventListener('ended', () => {
                this.logEvent('track_completed');
                this.callbacks.onEnded();
            });
            this.audio.addEventListener('timeupdate', () => {
                if (!this.listenCounted && this.audio.currentTime >= 30) {
                    this.listenCounted = true;
                    this.logEvent('30s_listen');
                }
                if (this.audio.duration) {
                    this.callbacks.onTimeUpdate(this.audio.currentTime, this.audio.duration);
                }
            });
            this.audio.addEventListener('loadedmetadata', () => {
                if (this.audio.duration) {
                    this.callbacks.onLoadedMetadata(this.audio.duration, this.currentTrack);
                }
            });
        }
    }

    // Запускаем приложение
    ArtistPage.init();
});
