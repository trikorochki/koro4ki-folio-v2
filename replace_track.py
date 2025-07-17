# replace_track.py - С поддержкой URL-кодировки для специальных символов

import os
import mimetypes
import dotenv
from vercel_blob import put, list as blob_list
from dotenv import load_dotenv
import urllib.parse

# Загрузка переменных окружения
dotenv.load_dotenv('.env.development.local')

MUSIC_DIR = 'music'

def find_blob_by_filename(target_filename):
    """
    Найти файл в blob по имени файла (игнорируя путь)
    """
    try:
        blobs = blob_list({'limit': '1000'})
        for blob in blobs['blobs']:
            # Декодируем URL-encoded путь
            decoded_path = urllib.parse.unquote(blob['pathname'])
            blob_filename = os.path.basename(decoded_path)
            
            if blob_filename == target_filename:
                print(f"✅ Найден файл в blob: {blob['pathname']}")
                print(f"   Декодированный путь: {decoded_path}")
                return blob['pathname']
        
        print(f"❌ Файл '{target_filename}' не найден в blob")
        return None
    except Exception as e:
        print(f"❌ Ошибка поиска: {e}")
        return None

def replace_track_by_filename(filename, new_local_path):
    """
    Заменить трек по имени файла, автоматически найдя его в blob
    
    Args:
        filename: Имя файла для замены (например: "01 Wake up!.mp3")
        new_local_path: Путь к новому файлу на диске
    """
    print(f"--- Замена трека '{filename}' ---")
    
    # Ищем файл в blob по имени
    blob_path = find_blob_by_filename(filename)
    if not blob_path:
        return None
    
    try:
        with open(new_local_path, 'rb') as f:
            file_content = f.read()
            
            content_type, _ = mimetypes.guess_type(new_local_path)
            if content_type is None:
                content_type = 'application/octet-stream'

            # Используем найденный blob_path для перезаписи
            blob_result = put(blob_path, file_content, options={
                'content_type': content_type,
                'allowOverwrite': True
            })
            
            print(f"✅ Успешно заменён!")
            print(f"   URL: {blob_result['url']}")
            print(f"   Blob path: {blob_result['pathname']}")
            return blob_result
            
    except FileNotFoundError:
        print(f"❌ ОШИБКА: Файл '{new_local_path}' не найден на диске")
        return None
    except Exception as e:
        print(f"❌ ОШИБКА при замене: {e}")
        return None

def replace_track_by_exact_path(blob_path, new_local_path):
    """
    Заменить трек по точному пути в blob (URL-encoded)
    
    Args:
        blob_path: Точный путь в blob (например: "/music/nu%CC%88korochki/...")
        new_local_path: Путь к новому файлу на диске
    """
    print(f"--- Замена по точному пути ---")
    print(f"Blob path: {blob_path}")
    print(f"Локальный файл: {new_local_path}")
    
    try:
        with open(new_local_path, 'rb') as f:
            file_content = f.read()
            
            content_type, _ = mimetypes.guess_type(new_local_path)
            if content_type is None:
                content_type = 'application/octet-stream'

            # Убираем ведущий слеш если есть
            clean_blob_path = blob_path.lstrip('/')
            
            blob_result = put(clean_blob_path, file_content, options={
                'content_type': content_type,
                'allowOverwrite': True
            })
            
            print(f"✅ Успешно заменён!")
            print(f"   URL: {blob_result['url']}")
            print(f"   Blob path: {blob_result['pathname']}")
            return blob_result
            
    except FileNotFoundError:
        print(f"❌ ОШИБКА: Файл '{new_local_path}' не найден на диске")
        return None
    except Exception as e:
        print(f"❌ ОШИБКА при замене: {e}")
        return None

if __name__ == '__main__':
    # Вариант 1: Замена по имени файла (автоматический поиск в blob)
    replace_track_by_filename(
        filename="01 Wake up!.mp3",
        new_local_path="music/nükorochki/Album. Grenzgänger/01 Wake up!.mp3"
    )
    
    # Вариант 2: Замена по точному пути в blob (закомментировано)
    # replace_track_by_exact_path(
    #     blob_path="/music/nu%CC%88korochki/Album.%20Grenzga%CC%88nger/01%20Wake%20up!.mp3",
    #     new_local_path="music/nükorochki/Album. Grenzgänger/01 Wake up!.mp3"
    # )
