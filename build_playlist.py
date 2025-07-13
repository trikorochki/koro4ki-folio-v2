# build_playlist.py - ОБНОВЛЕННАЯ ВЕРСИЯ

import os
import json
import re
from mutagen.mp3 import MP3
from mutagen.wave import WAVE
from mutagen import MutagenError

# --- Конфигурация ---
ARTIST_INFO = {
    "flowkorochki": {
        "name": "FLOWKORO4KI",
        "image": "images/flowkorochki.jpg",
        "description_line1": "Sarcastic and philosophical hip-hop.",
        "description_line2": "Exploring the boundaries of reality and absurdity."
    },
    "psykorochki": {
        "name": "PSYKORO4KI",
        "image": "images/psykorochki.jpg",
        "description_line1": "Break-electro-punk-inverted-cyber-hip-hop.",
        "description_line2": "Musical chaos for the digital world."
    },
    "riffkorochki": {
        "name": "RIFFKORO4KI",
        "image": "images/riffkorochki.jpg",
        "description_line1": "The blend of experimental hip-hop and nu metal.",
        "description_line2": "A drop of common sense for your soul."
    },
    "trapkorochki": {
        "name": "TRAPKORO4KI",
        "image": "images/trapkorochki.jpg",
        "description_line1": "A fusion of noir trap and digital decadence.",
        "description_line2": "The architecture of the void for your veins."
    }
  #  "echorochki": {
  #      "name": "ECHORO4KI",
  #      "image": "images/echorochki.jpg",
  #      "description_line1": "Militant 90s alternative rock anthem.",
  #      "description_line2": "May God rest your soul, Dolores O'Riordan."
  #  }
}

MUSIC_DIR = 'public/music'
OUTPUT_FILE = 'public/playlist-data.js'
# --- Конец конфигурации ---

def natural_sort_key(s):
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s)]

def get_audio_duration(file_path):
    """
    Получает длительность аудиофайла в секундах.
    Поддерживает MP3 и WAV.
    """
    try:
        if file_path.lower().endswith('.mp3'):
            audio = MP3(file_path)
        elif file_path.lower().endswith('.wav'):
            audio = WAVE(file_path)
        else:
            return 0  # Возвращаем 0 для неподдерживаемых форматов
        
        return int(audio.info.length)
        
    except MutagenError as e:
        print(f"      ОШИБКА MUTAGEN: Не удалось прочитать файл '{file_path}'. Ошибка: {e}")
        return 0
    except Exception as e:
        print(f"      ОБЩАЯ ОШИБКА: Не удалось обработать файл '{file_path}'. Ошибка: {e}")
        return 0

def create_playlist_data():
    artist_data = {}
    print(f"Сканирую директорию: {MUSIC_DIR}")

    if not os.path.exists(MUSIC_DIR):
        print(f"ОШИБКА: Директория {MUSIC_DIR} не найдена.")
        return

    for artist_id in sorted(os.listdir(MUSIC_DIR), key=natural_sort_key):
        artist_path = os.path.join(MUSIC_DIR, artist_id)
        if os.path.isdir(artist_path):
            print(f"  Найден артист: {artist_id}")
            
            info = ARTIST_INFO.get(artist_id, {
                "name": artist_id.upper(), "image": "images/default_avatar.jpg",
                "description_line1": "", "description_line2": ""
            })
            
            artist_data[artist_id] = {**info, "albums": [], "eps": [], "demos": []}

            for release_folder_name in sorted(os.listdir(artist_path), key=natural_sort_key):
                release_path = os.path.join(artist_path, release_folder_name)
                if os.path.isdir(release_path):
                    album_obj = {"name": release_folder_name, "cover": None, "tracks": []}
                    track_files = sorted(os.listdir(release_path), key=natural_sort_key)

                    for f in track_files:
                        url_path = os.path.join('music', artist_id, release_folder_name, f).replace("\\", "/")
                        
                        if f.lower() == 'cover.jpg':
                            album_obj["cover"] = url_path
                        elif f.lower().endswith(('.mp3', '.wav')):
                            # --- ИЗМЕНЕНИЕ ЗДЕСЬ ---
                            full_file_path = os.path.join(release_path, f)
                            duration = get_audio_duration(full_file_path)
                            # -------------------------
                            track_title = os.path.splitext(f)[0]
                            # --- ИЗМЕНЕНИЕ ЗДЕСЬ: Добавляем 'duration' в объект трека ---
                            album_obj["tracks"].append({"title": track_title, "file": url_path, "duration": duration})
                    
                    if album_obj["cover"] is None:
                        print(f"      ПРЕДУПРЕЖДЕНИЕ: Не найдена обложка для '{release_folder_name}'")

                    if release_folder_name.lower().startswith('album.'):
                        album_obj['name'] = release_folder_name[len('album.'):].strip()
                        artist_data[artist_id]["albums"].append(album_obj)
                        print(f"    Найден альбом: {album_obj['name']}")
                    elif release_folder_name.lower().startswith('ep.'):
                        album_obj['name'] = release_folder_name[len('ep.'):].strip()
                        artist_data[artist_id]["eps"].append(album_obj)
                        print(f"    Найден EP: {album_obj['name']}")
                    elif release_folder_name.lower().startswith('demo.'):
                        album_obj['name'] = release_folder_name[len('demo.'):].strip()
                        artist_data[artist_id]["demos"].append(album_obj)
                        print(f"    Найдена демо-запись: {album_obj['name']}")
                    else:
                        print(f"      ПРЕДУПРЕЖДЕНИЕ: Папка '{release_folder_name}' не имеет корректного префикса. Пропущена.")

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        js_content = f"window.artistData = {json.dumps(artist_data, indent=4, ensure_ascii=False)};"
        f.write(js_content)

    print(f"\nГотово! Файл '{OUTPUT_FILE}' успешно обновлен с точными данными о длительности треков.")

if __name__ == '__main__':
    create_playlist_data()
