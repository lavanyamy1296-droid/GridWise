# GridWise AI ⚡

An intelligent energy analytics dashboard that explores electricity usage, forecasts upcoming demand, flags unusual consumption and recommends energy-saving actions.

## Features
- 90-day sample consumption analytics and key metrics
- Random Forest regression for a 7-day demand forecast
- Isolation Forest anomaly detection
- Actionable energy-saving recommendations
- Downloadable PDF energy report
- React dashboard with interactive Recharts visualizations

## Technology
**Frontend:** React, Vite, Recharts, Axios, Lucide  
**Backend:** FastAPI, pandas, NumPy, scikit-learn, ReportLab

## Requirements
- Python 3.10 or newer
- Node.js 18 or newer
- VS Code (recommended)

## Run the backend (Terminal 1)
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```
Backend: http://127.0.0.1:8000  
API docs: http://127.0.0.1:8000/docs

## Run the frontend (Terminal 2)
```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```
Frontend: http://localhost:5173

Keep both terminals running. If PowerShell blocks `npm`, use `npm.cmd` as shown. If Python's `python` command is unavailable, install Python 3.10+ and select it in VS Code.

## API endpoints
- `GET /api/health` — health check
- `GET /api/dashboard` — metrics, historical data and 7-day forecast
- `GET /api/forecast?days=7` — forecast for 1–30 days
- `GET /api/anomalies` — unusual consumption events
- `GET /api/recommendations` — saving suggestions
- `POST /api/report/pdf` — downloadable PDF report

## Data note
This project currently generates a deterministic **synthetic demonstration dataset** in the backend. It is designed to demonstrate the complete ML workflow; it is not connected to a real smart meter or utility provider. Forecasts and potential savings are illustrative estimates, not guarantees.

## GitHub
Create an empty public repository named `GridWise-AI`, then from the project root:
```powershell
git init
git add .
git commit -m "Initial commit - GridWise AI energy analytics"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/GridWise-AI.git
git push -u origin main
```
