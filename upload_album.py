# upload_album.py - Загрузка нового альбома с обложкой

import os
import mimetypes
import dotenv
from vercel_blob import put
from dotenv import load_dotenv
from mutagen.mp3 import MP3
from mutagen.wave import WAVE
from mutagen import MutagenError

# Загрузка переменных окружения
dotenv.load_dotenv('.env.development.local')

MUSIC_DIR = 'music'

def get_audio_info(file_path):
    """
    Получить информацию об аудиофайле
    """
    try:
        if file_path.lower().endswith('.mp3'):
            audio = MP3(file_path)
            return {
                'duration': audio.info.length,
                'bitrate': audio.info.bitrate,
                'title': audio.get('TIT2', ['Unknown'])[0],
                'artist': audio.get('TPE1', ['Unknown'])[0],
                'album': audio.get('TALB', ['Unknown'])[0]
            }
        elif file_path.lower().endswith('.wav'):
            audio = WAVE(file_path)
            return {
                'duration': audio.info.length,
                'bitrate': audio.info.bitrate,
                'title': 'Unknown',
                'artist': 'Unknown',
                'album': 'Unknown'
            }
    except MutagenError:
        pass
    
    return None

def find_album_cover(album_path):
    """
    Найти файл обложки альбома в указанной папке
    """
    cover_names = [
        'cover.jpg', 'cover.jpeg', 'cover.png',
        'Cover.jpg', 'Cover.jpeg', 'Cover.png',
        'folder.jpg', 'folder.jpeg', 'folder.png',
        'album.jpg', 'album.jpeg', 'album.png'
    ]
    
    for cover_name in cover_names:
        cover_path = os.path.join(album_path, cover_name)
        if os.path.exists(cover_path):
            return cover_path, cover_name
    
    return None, None

def upload_album(local_album_path, target_blob_path=None):
    """
    Загрузить альбом в blob с подробной информацией включая обложку
    """
    print(f"=== ЗАГРУЗКА АЛЬБОМА ===")
    print(f"Локальный путь: {local_album_path}")
    
    if not os.path.exists(local_album_path):
        print(f"❌ Папка '{local_album_path}' не найдена")
        return False
    
    # Ищем обложку альбома
    cover_path, cover_filename = find_album_cover(local_album_path)
    
    # Собираем информацию о файлах
    audio_files = []
    cover_file = None
    
    # Обрабатываем аудиофайлы
    for root, dirs, files in os.walk(local_album_path):
        for filename in files:
            if filename.startswith('.'):
                continue
            
            if filename.lower().endswith(('.mp3', '.wav', '.flac', '.m4a', '.ogg')):
                local_path = os.path.join(root, filename)
                audio_files.append({
                    'local_path': local_path,
                    'filename': filename,
                    'size': os.path.getsize(local_path),
                    'type': 'audio'
                })
    
    # Добавляем обложку если найдена
    if cover_path:
        cover_file = {
            'local_path': cover_path,
            'filename': cover_filename,
            'size': os.path.getsize(cover_path),
            'type': 'cover'
        }
        print(f"🎨 Найдена обложка: {cover_filename}")
    else:
        print(f"⚠️  Обложка не найдена (ищем: cover.jpg, cover.png, folder.jpg и др.)")
    
    if not audio_files:
        print(f"❌ Аудиофайлы не найдены в '{local_album_path}'")
        return False
    
    print(f"🎵 Найдено {len(audio_files)} аудиофайлов:")
    
    # Показываем информацию о файлах
    total_size = 0
    
    # Информация об аудиофайлах
    for file in audio_files:
        audio_info = get_audio_info(file['local_path'])
        size_mb = file['size'] / (1024 * 1024)
        total_size += file['size']
        
        print(f"  📁 {file['filename']} ({size_mb:.1f} MB)")
        if audio_info:
            duration_min = audio_info['duration'] / 60
            print(f"     🎵 {audio_info['title']} - {audio_info['artist']}")
            print(f"     ⏱️  {duration_min:.1f} мин, {audio_info['bitrate']} kbps")
    
    # Информация об обложке
    if cover_file:
        cover_size_mb = cover_file['size'] / (1024 * 1024)
        total_size += cover_file['size']
        print(f"\n🎨 Обложка:")
        print(f"  📁 {cover_file['filename']} ({cover_size_mb:.1f} MB)")
    
    total_size_mb = total_size / (1024 * 1024)
    total_files = len(audio_files) + (1 if cover_file else 0)
    print(f"\n📊 Общий размер: {total_size_mb:.1f} MB")
    print(f"📋 Всего файлов: {total_files}")
    
    # Подтверждение загрузки
    confirm = input(f"\n✅ Загрузить {total_files} файлов? (y/N): ")
    if confirm.lower() != 'y':
        print("❌ Загрузка отменена")
        return False
    
    # Загружаем файлы
    uploaded_count = 0
    failed_count = 0
    
    # Загружаем аудиофайлы
    for i, file in enumerate(audio_files, 1):
        # Определяем путь в blob
        if target_blob_path:
            blob_path = target_blob_path + '/' + file['filename']
        else:
            blob_path = file['local_path'].replace("\\", "/")
        
        print(f"\n[{i}/{total_files}] Загрузка: {file['filename']}")
        print(f"  Путь в blob: {blob_path}")
        
        try:
            with open(file['local_path'], 'rb') as f:
                file_content = f.read()
                
                content_type, _ = mimetypes.guess_type(file['local_path'])
                if content_type is None:
                    content_type = 'application/octet-stream'

                blob_result = put(blob_path, file_content, options={
                    'content_type': content_type,
                    'allowOverwrite': True
                })
                
                print(f"  ✅ Успешно! URL: {blob_result['url']}")
                uploaded_count += 1
                
        except Exception as e:
            print(f"  ❌ ОШИБКА: {e}")
            failed_count += 1
    
    # Загружаем обложку
    if cover_file:
        cover_index = len(audio_files) + 1
        
        # Определяем путь в blob для обложки
        if target_blob_path:
            cover_blob_path = target_blob_path + '/' + cover_file['filename']
        else:
            cover_blob_path = cover_file['local_path'].replace("\\", "/")
        
        print(f"\n[{cover_index}/{total_files}] Загрузка обложки: {cover_file['filename']}")
        print(f"  Путь в blob: {cover_blob_path}")
        
        try:
            with open(cover_file['local_path'], 'rb') as f:
                file_content = f.read()
                
                # Определяем MIME-тип для изображения
                content_type, _ = mimetypes.guess_type(cover_file['local_path'])
                if content_type is None:
                    # Fallback для изображений
                    if cover_file['filename'].lower().endswith(('.jpg', '.jpeg')):
                        content_type = 'image/jpeg'
                    elif cover_file['filename'].lower().endswith('.png'):
                        content_type = 'image/png'
                    else:
                        content_type = 'image/jpeg'  # По умолчанию

                blob_result = put(cover_blob_path, file_content, options={
                    'content_type': content_type,
                    'allowOverwrite': True
                })
                
                print(f"  ✅ Обложка загружена! URL: {blob_result['url']}")
                uploaded_count += 1
                
        except Exception as e:
            print(f"  ❌ ОШИБКА загрузки обложки: {e}")
            failed_count += 1
    
    print(f"\n=== РЕЗУЛЬТАТ ЗАГРУЗКИ ===")
    print(f"✅ Загружено: {uploaded_count}")
    print(f"❌ Ошибок: {failed_count}")
    print(f"📊 Общий размер: {total_size_mb:.1f} MB")
    
    if cover_file and uploaded_count > len(audio_files):
        print(f"🎨 Обложка альбома успешно загружена")
    elif cover_file:
        print(f"⚠️  Обложка не была загружена")
    
    if uploaded_count > 0:
        print("=== ЗАГРУЗКА ЗАВЕРШЕНА ===")
        return True
    else:
        print("=== ЗАГРУЗКА ПРОВАЛЕНА ===")
        return False

def upload_single_album_folder(album_folder_name, custom_blob_path=None):
    """
    Загрузить альбом из папки music/
    """
    local_path = os.path.join(MUSIC_DIR, album_folder_name)
    
    if custom_blob_path:
        blob_path = custom_blob_path
    else:
        blob_path = f"music/{album_folder_name}"
    
    return upload_album(local_path, blob_path)

if __name__ == '__main__':
    # Вариант 1: Загрузить альбом из папки music/
    upload_single_album_folder("jahkorochki/Album. Deportation from the country of refugees")
    
    # Вариант 2: Загрузить альбом из произвольной папки
    # upload_album("C:/MyMusic/New Album", "music/artist/new_album")
    
    # Вариант 3: Загрузить с кастомным путем в blob
    # upload_single_album_folder("nükorochki/Album. Grenzgänger", "music/corrected_albums/grenzganger")
