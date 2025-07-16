document.addEventListener('DOMContentLoaded', () => {
    const fetchBtn = document.getElementById('fetch-data-btn');
    const secretInput = document.getElementById('api-secret-input');
    const statusEl = document.getElementById('status');
    const dashboard = document.getElementById('dashboard-content');

    fetchBtn.addEventListener('click', async () => {
        const secretToken = secretInput.value.trim();
        if (!secretToken) { statusEl.textContent = 'Ошибка: Введите секретный ключ.'; return; }
        
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
    
    const renderAudienceStats = (stats) => {
        const grid = document.getElementById('audience-stats-grid');
        grid.innerHTML = '';
        const statCategories = { 'Страны': stats.countries, 'Браузеры': stats.browsers, 'ОС': stats.os, 'Устройства': stats.devices };

        for (const [title, data] of Object.entries(statCategories)) {
            const card = document.createElement('div');
            card.className = 'stat-card';
            let listItems = `<h3>${title}</h3><ul>`;
            const sortedData = Object.entries(data).sort(([, a], [, b]) => b - a);
            for (const [key, value] of sortedData) {
                listItems += `<li><span>${key}</span> <strong>${value}</strong></li>`;
            }
            listItems += `</ul>`;
            card.innerHTML = listItems;
            grid.appendChild(card);
        }
    };

    const renderDiagnosticLogs = (logs) => {
        const tbody = document.getElementById('diagnostics-tbody');
        tbody.innerHTML = '';
        logs.forEach(record => {
            const row = tbody.insertRow();
            row.insertCell(0).textContent = new Date(record.timestamp).toLocaleString('ru-RU', { timeZone: 'UTC' });
            row.insertCell(1).textContent = record.ip;
            row.insertCell(2).textContent = record.country;
            row.insertCell(3).textContent = record.userAgent;
        });
    };

    const renderTrackStats = (stats) => {
        const container = document.getElementById('track-stats-container');
        container.innerHTML = '';
        const artists = Object.keys(stats).sort((a, b) => stats[b].total_plays - stats[a].total_plays);

        artists.forEach(artistName => {
            const artistData = stats[artistName];
            const artistGroup = document.createElement('div');
            artistGroup.className = 'artist-group';
            artistGroup.innerHTML = `
                <div class="artist-header">
                    <span>${artistName}</span>
                    <span class="total-plays">Всего прослушиваний: ${artistData.total_plays}</span>
                </div>
                <div class="album-list"></div>
            `;

            const albumList = artistGroup.querySelector('.album-list');
            const sortedAlbums = Object.keys(artistData.albums).sort((a, b) => artistData.albums[b].total_plays - artistData.albums[a].total_plays);

            sortedAlbums.forEach(albumName => {
                const albumData = artistData.albums[albumName];
                const albumGroup = document.createElement('div');
                albumGroup.className = 'album-group';
                let tracksHtml = '';
                albumData.tracks.forEach(track => {
                    const eventsStr = Object.entries(track.events).map(([e, c]) => `${e}: ${c}`).join(', ');
                    tracksHtml += `<div class="track-item"><div>${track.title}<div class="event-details">${eventsStr}</div></div> <strong>${track.plays}</strong></div>`;
                });
                albumGroup.innerHTML = `
                    <div class="album-header">
                        <span>${albumName}</span>
                        <span class="total-plays">Прослушиваний: ${albumData.total_plays}</span>
                    </div>
                    <div class="track-list">${tracksHtml}</div>
                `;
                albumList.appendChild(albumGroup);
            });
            container.appendChild(artistGroup);
        });
        
        // Добавляем интерактивность аккордеону
        container.addEventListener('click', (e) => {
            const header = e.target.closest('.artist-header, .album-header');
            if (!header) return;
            const content = header.nextElementSibling;
            content.style.display = content.style.display === 'block' ? 'none' : 'block';
        });
    };
});
