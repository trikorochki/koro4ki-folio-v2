# build_playlist.py - Финальная версия с корректной генерацией Blob URL

import os
import json
import re
from mutagen.mp3 import MP3
from mutagen.wave import WAVE
from mutagen import MutagenError
from dotenv import load_dotenv

# --- Конфигурация ---
ARTIST_INFO = {
    "flowkorochki": {"name": "FLOWKORO4KI", "image": "images/flowkorochki.jpg", "description_line1": "Sarcastic and philosophical hip-hop.", "description_line2": "Exploring the boundaries of reality and absurdity."},
    "psykorochki": {"name": "PSYKORO4KI", "image": "images/psykorochki.jpg", "description_line1": "Break-electro-punk-inverted-cyber-hip-hop.", "description_line2": "Musical chaos for the digital world."},
    "riffkorochki": {"name": "RIFFKORO4KI", "image": "images/riffkorochki.jpg", "description_line1": "The blend of experimental hip-hop and riffs.", "description_line2": "A drop of common sense for your soul."},
    "trapkorochki": {"name": "TRAPKORO4KI", "image": "images/trapkorochki.jpg", "description_line1": "A fusion of noir trap and digital decadence.", "description_line2": "The architecture of the void for your veins."},
    "streetkorochki": {"name": "STREETKORO4KI", "image": "images/streetkorochki.jpg", "description_line1": "Satirical rap dismantling social pretenses.", "description_line2": "Fast-paced trap-drill with polyrhythmic chaos."},
    "nükorochki": {"name": "NÜKORO4KI", "image": "images/nükorochki.jpg", "description_line1": "Experimental metal with no fucking frames.", "description_line2": "From quantum leaps to night machines of sound."}
}

MUSIC_DIR = 'music'
OUTPUT_FILE = 'playlist-data.js'
# --- Конец конфигурации ---

def natural_sort_key(s):
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s)]

def get_audio_duration(file_path):
    try:
        if file_path.lower().endswith('.mp3'): audio = MP3(file_path)
        elif file_path.lower().endswith('.wav'): audio = WAVE(file_path)
        else: return 0
        return int(audio.info.length)
    except Exception as e:
        print(f"      ОШИБКА при чтении длительности '{file_path}': {e}")
        return 0

def parse_track_number_and_title(filename):
    title = os.path.splitext(filename)[0]
    original_title = title
    patterns = [ r'^(\d{1,2})[\s\.\-_]+(.+)$', r'^Track[\s]*(\d{1,2})[\s\.\-_]*(.+)$', r'^(\d{1,2})([A-Za-z].+)$', r'^(\d{1,2})$' ]
    for pattern in patterns:
        match = re.match(pattern, title.strip())
        if match:
            num = int(match.group(1))
            clean_title = match.group(2).strip() if len(match.groups()) > 1 and match.group(2) else title
            return num, re.sub(r'^[\s\.\-_]+', '', clean_title), original_title
    return None, title, original_title

def create_playlist_data():
    BLOB_BASE_URL = os.environ.get('BLOB_URL', '').rstrip('/')
    if not BLOB_BASE_URL:
        print("ОШИБКА: Переменная окружения BLOB_URL не найдена.")
        return

    artist_data = {}
    print(f"Сканирую директорию: {MUSIC_DIR}")

    if not os.path.exists(MUSIC_DIR):
        print(f"ОШИБКА: Директория {MUSIC_DIR} не найдена.")
        return

    for artist_id in sorted(os.listdir(MUSIC_DIR)):
        artist_path = os.path.join(MUSIC_DIR, artist_id)
        if os.path.isdir(artist_path):
            info = ARTIST_INFO.get(artist_id, {"name": artist_id.upper(), "image": "images/default_avatar.jpg"})
            artist_data[artist_id] = {**info, "albums": [], "eps": [], "demos": []}
            for release_folder_name in sorted(os.listdir(artist_path)):
                release_path = os.path.join(artist_path, release_folder_name)
                if os.path.isdir(release_path):
                    album_obj = {"name": release_folder_name, "cover": None, "tracks": []}
                    track_files = sorted(os.listdir(release_path), key=natural_sort_key)
                    audio_files = [f for f in track_files if f.lower().endswith(('.mp3', '.wav'))]

                    for f in track_files:
                        # ✅ ИСПРАВЛЕНИЕ: Формируем путь, идентичный тому, что был загружен в Blob
                        blob_file_path = os.path.join(MUSIC_DIR, artist_id, release_folder_name, f).replace("\\", "/")
                        url_path = f"{BLOB_BASE_URL}/{blob_file_path}"
                        
                        if f.lower() == 'cover.jpg':
                            album_obj["cover"] = url_path
                        elif f.lower().endswith(('.mp3', '.wav')):
                            parsed_num, clean_title, original_title = parse_track_number_and_title(f)
                            track_num = parsed_num if parsed_num is not None else audio_files.index(f) + 1
                            duration = get_audio_duration(os.path.join(release_path, f))
                            album_obj["tracks"].append({"num": track_num, "title": clean_title, "originalTitle": original_title, "file": url_path, "duration": duration})
                    
                    if album_obj["tracks"]: album_obj["tracks"].sort(key=lambda x: x["num"])
                    
                    type_assigned = False
                    if release_folder_name.lower().startswith('album.'):
                        album_obj['name'] = release_folder_name[len('album.'):].strip()
                        artist_data[artist_id]["albums"].append(album_obj)
                        type_assigned = True
                    elif release_folder_name.lower().startswith('ep.'):
                        album_obj['name'] = release_folder_name[len('ep.'):].strip()
                        artist_data[artist_id]["eps"].append(album_obj)
                        type_assigned = True
                    elif release_folder_name.lower().startswith('demo.'):
                        album_obj['name'] = release_folder_name[len('demo.'):].strip()
                        artist_data[artist_id]["demos"].append(album_obj)
                        type_assigned = True
                    
                    if not type_assigned:
                         print(f"      ПРЕДУПРЕЖДЕНИЕ: Папка '{release_folder_name}' не имеет корректного префикса. Пропущена.")

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(f"window.artistData = {json.dumps(artist_data, indent=4, ensure_ascii=False)};")
    print(f"\nГотово! Файл '{OUTPUT_FILE}' успешно обновлен с корректными URL из Vercel Blob.")

if __name__ == '__main__':
    print("Загрузка переменных окружения из .env.development.local...")
    load_dotenv('.env.development.local')
    create_playlist_data()
