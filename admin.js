document.addEventListener('DOMContentLoaded', () => {
    // --- Элементы DOM ---
    const fetchBtn = document.getElementById('fetch-data-btn');
    const secretInput = document.getElementById('api-secret-input');
    const statusEl = document.getElementById('status');
    const dashboard = document.getElementById('dashboard-content');

    // --- Шаблоны ---
    const audienceCardTemplate = document.getElementById('audience-card-template');
    const logRowTemplate = document.getElementById('log-row-template');
    const artistTemplate = document.getElementById('artist-group-template');
    const albumTemplate = document.getElementById('album-group-template');
    const trackTemplate = document.getElementById('track-item-template');

    // --- Обработчик клика ---
    fetchBtn.addEventListener('click', async () => {
        const secretToken = secretInput.value.trim();
        if (!secretToken) {
            statusEl.textContent = 'Ошибка: Введите секретный ключ.';
            return;
        }
        
        statusEl.textContent = 'Загрузка данных...';
        dashboard.style.display = 'none';

        try {
            const response = await fetch('/api/stats', { headers: { 'Authorization': `Bearer ${secretToken}` } });
            if (response.status === 401) throw new Error('Неверный токен авторизации.');
            if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);

            const data = await response.json();
            
            renderAudienceStats(data.audience_stats);
            renderDiagnosticLogs(data.diagnostic_logs);
            renderTrackStats(data.track_stats);
            
            dashboard.style.display = 'block';
            statusEl.textContent = 'Данные успешно загружены.';
        } catch (error) {
             statusEl.textContent = `Ошибка: ${error.message}`;
        }
    });
    
    // --- Функции рендеринга ---

    const renderAudienceStats = (stats) => {
        const grid = document.getElementById('audience-stats-grid');
        grid.innerHTML = '';
        const statCategories = { 'Страны': stats.countries, 'Браузеры': stats.browsers, 'ОС': stats.os, 'Устройства': stats.devices };

        for (const [title, data] of Object.entries(statCategories)) {
            const cardFragment = audienceCardTemplate.content.cloneNode(true);
            cardFragment.querySelector('h3').textContent = title;
            const list = cardFragment.querySelector('ul');
            
            const sortedData = Object.entries(data).sort(([, a], [, b]) => b - a);

            for (const [key, value] of sortedData) {
                const li = document.createElement('li');
                li.innerHTML = `<span>${key}</span> <strong>${value}</strong>`;
                list.appendChild(li);
            }
            grid.appendChild(cardFragment);
        }
    };

    const renderDiagnosticLogs = (logs) => {
        const tbody = document.getElementById('diagnostics-tbody');
        tbody.innerHTML = '';
        logs.forEach(record => {
            const rowFragment = logRowTemplate.content.cloneNode(true);
            const cells = rowFragment.querySelectorAll('td');
            cells[0].textContent = new Date(record.timestamp).toLocaleString('ru-RU', { timeZone: 'UTC' });
            cells[1].textContent = record.ip;
            cells[2].textContent = record.country;
            cells[3].textContent = record.userAgent;
            tbody.appendChild(rowFragment);
        });
    };

    const renderTrackStats = (stats) => {
        const container = document.getElementById('track-stats-container');
        container.innerHTML = '';
        const artists = Object.keys(stats).sort((a, b) => stats[b].total_plays - stats[a].total_plays);

        artists.forEach(artistName => {
            const artistData = stats[artistName];
            const artistFragment = artistTemplate.content.cloneNode(true);
            
            artistFragment.querySelector('.artist-name').textContent = artistName;
            artistFragment.querySelector('.total-plays').textContent = `Всего прослушиваний: ${artistData.total_plays}`;
            const albumList = artistFragment.querySelector('.album-list');

            const sortedAlbums = Object.keys(artistData.albums).sort((a, b) => artistData.albums[b].total_plays - artistData.albums[a].total_plays);

            sortedAlbums.forEach(albumName => {
                const albumData = artistData.albums[albumName];
                const albumFragment = albumTemplate.content.cloneNode(true);

                albumFragment.querySelector('.album-name').textContent = albumName;
                albumFragment.querySelector('.total-plays').textContent = `Прослушиваний: ${albumData.total_plays}`;
                const trackList = albumFragment.querySelector('.track-list');

                albumData.tracks.forEach(track => {
                    const trackFragment = trackTemplate.content.cloneNode(true);
                    trackFragment.querySelector('.track-title').textContent = track.title;
                    trackFragment.querySelector('.track-plays').textContent = track.plays;
                    trackFragment.querySelector('.event-details').textContent = Object.entries(track.events).map(([e, c]) => `${e}: ${c}`).join('; ');
                    trackList.appendChild(trackFragment);
                });
                albumList.appendChild(albumFragment);
            });
            container.appendChild(artistFragment);
        });
        
        // Механизм аккордеона остается без изменений, он идеален
        container.addEventListener('click', (e) => {
            const header = e.target.closest('.artist-header, .album-header');
            if (!header) return;
            const content = header.nextElementSibling;
            if(content) {
                content.style.display = content.style.display === 'block' ? 'none' : 'block';
            }
        });
    };
});
