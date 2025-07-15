# upload_music.py - Финальная версия с диагностикой токена

import os
import mimetypes
import dotenv
from vercel_blob import put
from mutagen.mp3 import MP3
from mutagen.wave import WAVE
from mutagen import MutagenError
from dotenv import load_dotenv

# Загрузка переменных окружения из .env.development.local
print("Загрузка переменных окружения из .env.development.local...")
dotenv.load_dotenv('.env.development.local')


MUSIC_DIR = 'music'

def upload_files_to_blob():
    print("--- Начало загрузки файлов в Vercel Blob ---")
    
    if not os.path.exists(MUSIC_DIR):
        print(f"ОШИБКА: Директория '{MUSIC_DIR}' не найдена.")
        return

    for root, dirs, files in os.walk(MUSIC_DIR):
        for filename in files:
            if filename.startswith('.'):
                continue
            
            local_path = os.path.join(root, filename)
            blob_path = local_path.replace("\\", "/")

            print(f"  Загрузка: {local_path} -> {blob_path}")

            try:
                with open(local_path, 'rb') as f:
                    file_content = f.read()
                    
                    content_type, _ = mimetypes.guess_type(local_path)
                    if content_type is None:
                        content_type = 'application/octet-stream'

                    blob_result = put(blob_path, file_content, options={'content_type': content_type})
                    print(f"    Успешно! URL: {blob_result['url']}")

            except Exception as e:
                print(f"    ОШИБКА при загрузке файла '{local_path}': {e}")
    
    print("--- Загрузка завершена ---")

if __name__ == '__main__':
    print("Загрузка переменных окружения из .env.development.local...")
    dotenv.load_dotenv('.env.local')
    
    token = os.environ.get('BLOB_READ_WRITE_TOKEN')
    
    if not token:
        print("ОШИБКА: Переменная окружения BLOB_READ_WRITE_TOKEN не найдена.")
        print("Убедитесь, что файл .env.development.local существует и содержит токен.")
    else:
        # ✅ ДИАГНОСТИКА: Выводим часть токена для проверки
        print(f"Используется токен, начинающийся с: {token[:15]}...")

        upload_files_to_blob()
