#!/bin/bash
cd "$(dirname "$0")"
echo "Starting ROBLOX Classic server..."
python3 run.py || python run.py
