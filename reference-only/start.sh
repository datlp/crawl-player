#!/bin/bash
du -sh ~/.cache/rclone
cd "/sdcard/Projects/crawl-vod/backend" || exit

python server.py -source javtiful -domain javtiful.com -detail-threads 1 -news-threads 1 -port 5004 -proxy-threads 7 -chunk_size 512KB -max_connections 30 -max_keepalive 10 -timeout "connect=3.0,read=None" &
python server.py -source sextop1 -domain sextop1.pub -detail-threads 1 -news-threads 1 -port 5001 -proxy-threads 7 -chunk_size 512KB -max_connections 30 -max_keepalive 10 -timeout "connect=3.0,read=None" &
python server.py -source vlxx -domain vlxx.ms -detail-threads 1 -news-threads 1 -port 5002 -proxy-threads 7 -chunk_size 512KB -max_connections 30 -max_keepalive 10 -timeout "connect=3.0,read=None" &
python server.py -source missav -domain missav.ws -detail-threads 1 -news-threads 1 -port 5003 -proxy-threads 7 -chunk_size 512KB -max_connections 30 -max_keepalive 10 -timeout "connect=3.0,read=None" &

cd "/sdcard/Projects/vod-server" ; python run.py -port 5000 -port-server 5501 &
