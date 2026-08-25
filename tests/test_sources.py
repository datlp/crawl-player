#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script test crawl:
- Tự động đọc danh sách source và domain mới nhất từ reference-only/start.sh (hoặc định nghĩa mặc định).
- Cào thử trang đầu tiên (page 1) của từng source.
- Cào thử tối thiểu 3 video chi tiết (details & streaming url).
- Áp dụng DNS 1.1.1.1 / 8.8.8.8 qua Cloudflare/Google DoH.
- Xuất báo cáo chi tiết theo định dạng Markdown tại ./tests/report/$source-report.md.
"""

import os
import sys
import re
import json
import time
import sqlite3
import datetime
import importlib.util
from urllib.parse import urlparse

if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Đảm bảo import được các module từ backend
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
BACKEND_DIR = os.path.join(ROOT_DIR, 'backend')
REPORT_DIR = os.path.join(SCRIPT_DIR, 'report')

os.makedirs(REPORT_DIR, exist_ok=True)
sys.path.insert(0, BACKEND_DIR)

# Import và cấu hình DNS cho curl_requests
from curl_cffi import requests as curl_requests, curl

# Monkey patch curl Session để cưỡng chế DNS 1.1.1.1 / 8.8.8.8
original_Session = curl_requests.Session

class PatchedSession(original_Session):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if hasattr(self, 'curl') and self.curl:
            try:
                # Dùng DNS over HTTPS (DoH) qua Cloudflare 1.1.1.1 (hoặc Google 8.8.8.8) thay vì DNS hệ thống
                self.curl.setopt(curl.CurlOpt.DOH_URL, b'https://cloudflare-dns.com/dns-query')
            except Exception:
                try:
                    self.curl.setopt(curl.CurlOpt.DOH_URL, b'https://dns.google/dns-query')
                except Exception:
                    pass

curl_requests.Session = PatchedSession

# Mock custom_log
def custom_log(category, message):
    now = datetime.datetime.now()
    timestamp = now.strftime('%H:%M:%S')
    try:
        print(f"[{timestamp}] [{category}] {message}")
    except UnicodeEncodeError:
        print(f"[{timestamp}] [{category}] {message.encode('utf-8', errors='ignore').decode('utf-8')}")

import builtins
builtins.custom_log = custom_log

def get_sources_from_start_sh():
    """Phân tích file reference-only/start.sh để lấy nguồn và domain mới nhất."""
    start_sh_path = os.path.join(ROOT_DIR, 'reference-only', 'start.sh')
    sources = {}
    
    if os.path.exists(start_sh_path):
        with open(start_sh_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            # Tìm các dòng python server.py -source <source> -domain <domain>
            matches = re.findall(r'-source\s+([a-zA-Z0-9_-]+)\s+-domain\s+([a-zA-Z0-9_.-]+)', content)
            for src, dom in matches:
                sources[src] = dom

    # Mặc định dự phòng nếu không parse được
    default_sources = {
        'javtiful': 'javtiful.com',
        'sextop1': 'sextop1.menu',
        'vlxx': 'vlxx.ms',
        'missav': 'missav.ws'
    }
    for k, v in default_sources.items():
        if k not in sources:
            sources[k] = v
            
    return sources

def load_source_module(source_name):
    """Load module source-*.py tương ứng."""
    file_path = os.path.join(BACKEND_DIR, f"source-{source_name}.py")
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Không tìm thấy file source: {file_path}")
    
    spec = importlib.util.spec_from_file_location(f"source_{source_name}", file_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def create_mock_db(source_name):
    """Tạo mock SQLite in-memory database để scraper hoạt động mà không ảnh hưởng DB thật."""
    db_conn = sqlite3.connect(":memory:", check_same_thread=False)
    cursor = db_conn.cursor()
    table_name = f"{source_name}_videos"
    
    cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS {table_name} (
            id TEXT PRIMARY KEY,
            title TEXT,
            cover TEXT,
            added_at TEXT,
            release_date TEXT,
            dvd TEXT,
            url TEXT,
            actress TEXT,
            genre TEXT,
            maker TEXT,
            details TEXT,
            details_fetched INTEGER DEFAULT 0
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sync_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url_pattern TEXT UNIQUE,
            current_page INTEGER DEFAULT 1,
            total_pages INTEGER DEFAULT 1,
            last_synced INTEGER DEFAULT 0
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS configs (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)
    db_conn.commit()
    return db_conn

def test_source(source_name, domain):
    print(f"\n=======================================================")
    print(f"🚀 BẮT ĐẦU TEST SOURCE: [{source_name.upper()}] | Domain: {domain}")
    print(f"=======================================================")
    
    start_time = time.time()
    db_conn = create_mock_db(source_name)
    import threading
    db_lock = threading.Lock()
    memory_lock = threading.Lock()
    db_buffer = {
        'videos': {},
        'video_urls': {},
        'media': {}
    }
    
    report_data = {
        'source': source_name,
        'domain': domain,
        'test_time': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'list_status': 'FAILED',
        'list_url': '',
        'videos_found': 0,
        'details_tested': [],
        'error_log': []
    }

    try:
        source_module = load_source_module(source_name)
        scraper = source_module.Scraper(
            db_conn, db_lock, memory_lock, db_buffer,
            table_name=f"{source_name}_videos",
            domain=domain
        )
        
        # 1. Khởi tạo menu & task
        scraper.update_sync_tasks_from_menu()
        cursor = db_conn.cursor()
        cursor.execute("SELECT url_pattern FROM sync_tasks LIMIT 1")
        row = cursor.fetchone()
        
        first_pattern = row[0] if row else f"https://{domain}/"
        report_data['list_url'] = first_pattern
        print(f"📌 Đang cào danh sách trang đầu tiên (Page 1) từ: {first_pattern}")

        # 2. Cào trang 1
        new_count, total_in_page, total_pages = scraper.sync_list_page(first_pattern, 1)
        
        # Lấy danh sách video từ buffer hoặc mock DB
        videos = list(db_buffer['videos'].values())
        report_data['videos_found'] = len(videos)
        
        if len(videos) > 0:
            report_data['list_status'] = 'SUCCESS'
            print(f"✅ Cào Page 1 thành công: Tìm thấy {len(videos)} videos (Total pages: {total_pages})")
        else:
            report_data['list_status'] = 'EMPTY'
            print(f"⚠️ Page 1 không tìm thấy video nào.")

        # 3. Cào chi tiết tối thiểu 3 video
        target_count = min(3, len(videos))
        if target_count < 3 and len(videos) > 0:
            target_count = len(videos)
            
        test_videos = videos[:3] if len(videos) >= 3 else videos
        print(f"📌 Bắt đầu cào thử chi tiết {len(test_videos)} video...")
        
        for idx, vid in enumerate(test_videos, start=1):
            vid_id = vid['id']
            print(f"\n--- [Video {idx}/{len(test_videos)}] ID: {vid_id} ---")
            
            # Cào chi tiết metadata
            detail_start = time.time()
            detail_ok = scraper.sync_video_details(vid_id)
            detail_duration = round(time.time() - detail_start, 2)
            
            # Lấy thông tin đã update từ DB
            cursor.execute(f"SELECT actress, genre, maker, release_date, details FROM {source_name}_videos WHERE id = ?", (vid_id,))
            detail_row = cursor.fetchone()
            
            actress = detail_row[0] if detail_row and detail_row[0] else ""
            genre = detail_row[1] if detail_row and detail_row[1] else ""
            maker = detail_row[2] if detail_row and detail_row[2] else ""
            release_date = detail_row[3] if detail_row and detail_row[3] else vid.get('release_date', '')
            details = detail_row[4] if detail_row and detail_row[4] else ""
            
            # Lấy URL streaming (m3u8 hoặc mp4)
            url_start = time.time()
            stream_url = scraper.get_video_url(vid_id, force_refresh=True)
            url_duration = round(time.time() - url_start, 2)
            
            title_disp = vid.get('title', '')[:60]
            print(f"  + Title: {title_disp}...")
            print(f"  + Actress: {actress if actress else 'N/A'}")
            print(f"  + Genre: {genre if genre else 'N/A'}")
            print(f"  + Stream URL: {stream_url[:80] if stream_url else 'None'} ({url_duration}s)")
            
            report_data['details_tested'].append({
                'id': vid_id,
                'title': vid.get('title', ''),
                'cover': vid.get('cover', ''),
                'actress': actress,
                'genre': genre,
                'maker': maker,
                'release_date': release_date,
                'stream_url': stream_url or "Không lấy được URL",
                'detail_status': 'SUCCESS' if detail_ok else 'FAILED',
                'stream_status': 'SUCCESS' if stream_url else 'FAILED',
                'duration': f"{detail_duration + url_duration}s"
            })
            
    except Exception as e:
        err_msg = f"Lỗi trong quá trình test {source_name}: {str(e)}"
        print(f"❌ {err_msg}")
        report_data['error_log'].append(err_msg)
    finally:
        db_conn.close()
        
    report_data['total_duration'] = round(time.time() - start_time, 2)
    write_markdown_report(report_data)

def write_markdown_report(data):
    """Ghi báo cáo kết quả ra file Markdown."""
    source = data['source']
    report_file = os.path.join(REPORT_DIR, f"{source}-report.md")
    
    status_emoji = "✅ PASS" if data['list_status'] == 'SUCCESS' and any(d['stream_status'] == 'SUCCESS' for d in data['details_tested']) else "⚠️ WARNING / FAILED"
    
    md = []
    md.append(f"# Báo Cáo Kiểm Tra Crawl Source: `{source}`")
    md.append(f"\n- **Thời gian thực hiện:** `{data['test_time']}`")
    md.append(f"- **Domain áp dụng (từ start.sh):** `{data['domain']}`")
    md.append(f"- **DNS:** `1.1.1.1 (Cloudflare DoH) / 8.8.8.8 (Google DoH)`")
    md.append(f"- **Tổng thời gian chạy test:** `{data.get('total_duration', 0)}s`")
    md.append(f"- **Đánh giá tổng quan:** **{status_emoji}**\n")
    
    md.append("## 1. Kết Quả Cào Danh Sách Trang Đầu (Page 1)")
    md.append(f"- **URL Pattern kiểm tra:** `{data['list_url']}`")
    md.append(f"- **Trạng thái:** `{data['list_status']}`")
    md.append(f"- **Số lượng video tìm thấy:** `{data['videos_found']}` video\n")
    
    md.append("## 2. Kết Quả Cào Chi Tiết Tối Thiểu 3 Video (Details & Streaming URL)")
    if data['details_tested']:
        for idx, item in enumerate(data['details_tested'], start=1):
            md.append(f"### Video {idx}: `{item['id']}`")
            md.append(f"- **Tiêu đề:** {item['title']}")
            md.append(f"- **Ảnh bìa (Cover):** {item['cover']}")
            md.append(f"- **Diễn viên:** {item['actress'] or '*(Trống)*'}")
            md.append(f"- **Thể loại:** {item['genre'] or '*(Trống)*'}")
            md.append(f"- **Hãng sản xuất / Maker:** {item['maker'] or '*(Trống)*'}")
            md.append(f"- **Ngày phát hành:** {item['release_date'] or '*(Trống)*'}")
            md.append(f"- **Trạng thái cào chi tiết:** `{item['detail_status']}`")
            md.append(f"- **Trạng thái lấy Stream URL:** `{item['stream_status']}`")
            md.append(f"- **Stream URL:** `{item['stream_url']}`")
            md.append(f"- **Thời gian xử lý:** `{item['duration']}`\n")
    else:
        md.append("*(Không có video nào được kiểm tra chi tiết do không lấy được danh sách)*\n")
        
    if data['error_log']:
        md.append("## 3. Nhật Ký Lỗi (Errors)")
        for err in data['error_log']:
            md.append(f"- ❌ `{err}`")
        md.append("")
        
    md.append("---\n*Báo cáo được tự động tạo bởi test suite crawl-vod.*")
    
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write("\n".join(md))
        
    print(f"📝 Đã xuất báo cáo tại: {report_file}")

def main():
    sources = get_sources_from_start_sh()
    print("=======================================================")
    print("🔍 DANH SÁCH SOURCE VÀ DOMAIN TỪ reference-only/start.sh:")
    for src, dom in sources.items():
        print(f" - {src}: {dom}")
    print("=======================================================")
    
    target_sources = sys.argv[1:] if len(sys.argv) > 1 else list(sources.keys())
    
    for src in target_sources:
        if src in sources:
            test_source(src, sources[src])
        else:
            print(f"⚠️ Nguồn '{src}' không có trong cấu hình start.sh!")

if __name__ == '__main__':
    main()
