import os
import re
from flask import Flask, render_template, jsonify, abort

# Правильная инициализация Flask для Vercel
app = Flask(__name__, template_folder='../templates')

# --- Конфигурация ---
# Путь к музыке строится от корня проекта (где лежит папка 'public')
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MUSIC_FOLDER = os.path.join(PROJECT_ROOT, 'public', 'music')

# Данные об артистах (ты можешь расширить их)
ARTIST_DATA = {
    'flowkorochki': {
        'name': 'FLOWKORO4KI',
        'description_line1': 'Sarcastic and philosophical hip-hop.',
        'description_line2': 'Exploring the boundaries of reality and absurdity.',
        'image_file': 'flowkorochki.jpg',
        'theme': 'light'
    },
    'psykorochki': {
        'name': 'PSYKORO4KI',
        'description_line1': 'Break-electro-punk-inverted-cyber-hip-hop.',
        'description_line2': 'Musical chaos for the digital world.',
        'image_file': 'psykorochki.jpg',
        'theme': 'dark'
    }
}

# --- Маршруты для рендеринга HTML страниц ---

@app.route('/')
def index():
    """Рендерит главную страницу."""
    return render_template('index.html', artists=ARTIST_DATA)

@app.route('/artist/<artist_slug>')
def artist_page(artist_slug):
    """Рендерит страницу артиста."""
    if artist_slug not in ARTIST_DATA:
        abort(404)
    return render_template('artist.html', artist_slug=artist_slug, artists=ARTIST_DATA)

# --- API для получения данных ---

@app.route('/api/artist/<artist_slug>')
def get_artist_details(artist_slug):
    """Возвращает JSON с полной информацией об артисте."""
    if artist_slug not in ARTIST_DATA:
        abort(404)

    artist_data = ARTIST_DATA[artist_slug]
    artist_path = os.path.join(MUSIC_FOLDER, artist_slug)
    
    albums = []
    if os.path.isdir(artist_path):
        for album_name in sorted(os.listdir(artist_path)):
            album_path = os.path.join(artist_path, album_name)
            if os.path.isdir(album_path):
                album_info = {'name': album_name, 'tracks': []}
                # Ищем обложку
                if os.path.exists(os.path.join(album_path, 'cover.jpg')):
                    album_info['cover_url'] = f"/music/{artist_slug}/{album_name}/cover.jpg"
                
                # Ищем треки
                for filename in sorted(os.listdir(album_path)):
                    if filename.lower().endswith(('.mp3', '.wav', '.ogg')):
                        clean_title = re.sub(r'^[0-9]+[ ._-]*', '', os.path.splitext(filename)[0]).strip()
                        album_info['tracks'].append({
                            'title': clean_title,
                            'url': f"/music/{artist_slug}/{album_name}/{filename}"
                        })
                
                if album_info['tracks']:
                    albums.append(album_info)
    
    return jsonify({**artist_data, 'albums': albums})

