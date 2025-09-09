
pip install --upgrade pip
pip install -r ../requirements.txt
cd backend
uvicorn backend.main:app --host 0.0.0.0 --port $PORT

