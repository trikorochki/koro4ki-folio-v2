# upload_music.py - Скрипт для разовой загрузки треков в Vercel Blob

import os
import mimetypes
from vercel_blob import put
from dotenv import load_dotenv

MUSIC_DIR = 'music'

def upload_files_to_blob():
    print("--- Начало загрузки файлов в Vercel Blob ---")
    
    if not os.path.exists(MUSIC_DIR):
        print(f"ОШИБКА: Директория '{MUSIC_DIR}' не найдена.")
        return

    # Рекурсивно проходим по всем папкам и файлам
    for root, dirs, files in os.walk(MUSIC_DIR):
        for filename in files:
            # Пропускаем системные файлы
            if filename.startswith('.'):
                continue
            
            local_path = os.path.join(root, filename)
            blob_path = local_path.replace("\\", "/")

            print(f"  Загрузка: {local_path} -> {blob_path}")

            try:
                with open(local_path, 'rb') as f:
                    # ✅ ИСПРАВЛЕНИЕ: Читаем содержимое файла в байты
                    file_content = f.read()
                    
                    content_type, _ = mimetypes.guess_type(local_path)
                    if content_type is None:
                        content_type = 'application/octet-stream'

                    # ✅ ИСПРАВЛЕНИЕ: Передаем в функцию байты, а не объект файла
                    blob_result = put(blob_path, file_content, options={'content_type': content_type})
                    print(f"    Успешно! URL: {blob_result['url']}")

            except Exception as e:
                print(f"    ОШИБКА при загрузке файла '{local_path}': {e}")
    
    print("--- Загрузка завершена ---")

if __name__ == '__main__':
    # ✅ ИСПРАВЛЕНИЕ: Загружаем переменные из .env файла перед использованием
    print("Загрузка переменных окружения из .env.development.local...")
    load_dotenv('.env.development.local')
    
    if not os.environ.get('BLOB_READ_WRITE_TOKEN'):
        print("ОШИБКА: Переменная окружения BLOB_READ_WRITE_TOKEN не найдена.")
        print("Убедитесь, что файл .env.development.local существует и содержит токен.")
    else:
        upload_files_to_blob()
