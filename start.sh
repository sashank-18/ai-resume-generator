
pip install --upgrade pip
cd backend
uvicorn backend.main:app --host 0.0.0.0 --port $PORT

