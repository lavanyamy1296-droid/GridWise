from datetime import datetime, timedelta
from io import BytesIO
from typing import Optional
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sklearn.ensemble import RandomForestRegressor, IsolationForest
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

app = FastAPI(title="GridWise AI", version="1.0.0",
              description="Energy analytics, demand forecasting and anomaly detection.")
app.add_middleware(
    CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"]
)

def make_history(days: int = 90) -> pd.DataFrame:
    rng = np.random.default_rng(42)
    end = pd.Timestamp.today().normalize()
    dates = pd.date_range(end=end, periods=days, freq="D")
    rows = []
    for i, day in enumerate(dates):
        weekend = int(day.dayofweek >= 5)
        hour_factor = 1 + 0.08 * np.sin(i / 7 * 2 * np.pi)
        base = 28 + 8 * weekend + 3 * np.sin(i / 30 * 2 * np.pi)
        usage = max(8, base * hour_factor + rng.normal(0, 3))
        if i in (21, 57):
            usage *= 1.75
        rows.append((day, round(float(usage), 2), weekend))
    return pd.DataFrame(rows, columns=["date", "consumption_kwh", "weekend"])

HISTORY = make_history()

def train_model():
    df = HISTORY.copy()
    df["day_of_year"] = df["date"].dt.dayofyear
    df["day_of_week"] = df["date"].dt.dayofweek
    df["month"] = df["date"].dt.month
    X = df[["day_of_year", "day_of_week", "month", "weekend"]]
    model = RandomForestRegressor(n_estimators=180, random_state=42, min_samples_leaf=2)
    model.fit(X, df["consumption_kwh"])
    return model

MODEL = train_model()

def forecast(days: int = 7):
    last = HISTORY["date"].max()
    future = pd.date_range(last + pd.Timedelta(days=1), periods=days, freq="D")
    f = pd.DataFrame({"date": future})
    f["day_of_year"] = f["date"].dt.dayofyear
    f["day_of_week"] = f["date"].dt.dayofweek
    f["month"] = f["date"].dt.month
    f["weekend"] = (f["day_of_week"] >= 5).astype(int)
    preds = MODEL.predict(f[["day_of_year", "day_of_week", "month", "weekend"]])
    return [{"date": d.strftime("%Y-%m-%d"), "predicted_kwh": round(float(p), 2)}
            for d, p in zip(f["date"], preds)]

@app.get("/")
def root():
    return {"status": "ok", "name": "GridWise AI", "version": "1.0.0"}

@app.get("/api/health")
def health():
    return {"status": "healthy"}

@app.get("/api/dashboard")
def dashboard():
    df = HISTORY.copy()
    total = float(df["consumption_kwh"].sum())
    avg = float(df["consumption_kwh"].mean())
    recent = df.tail(30)
    previous = df.iloc[-60:-30]
    change = ((recent["consumption_kwh"].mean() - previous["consumption_kwh"].mean())
              / previous["consumption_kwh"].mean() * 100)
    peak = df.loc[df["consumption_kwh"].idxmax()]
    monthly = df.assign(month=df["date"].dt.strftime("%b")) .groupby("month", sort=False)["consumption_kwh"].sum()
    return {
        "total_kwh": round(total, 1), "daily_average": round(avg, 1),
        "monthly_change_pct": round(float(change), 1),
        "peak_day": peak["date"].strftime("%Y-%m-%d"),
        "peak_kwh": round(float(peak["consumption_kwh"]), 1),
        "history": [{"date": r.date.strftime("%Y-%m-%d"), "consumption_kwh": float(r.consumption_kwh)}
                    for r in df.tail(30).itertuples()],
        "monthly": [{"month": str(k), "consumption_kwh": round(float(v), 1)} for k, v in monthly.items()],
        "forecast": forecast(7)
    }

@app.get("/api/forecast")
def get_forecast(days: int = 7):
    if days < 1 or days > 30:
        raise HTTPException(400, "days must be between 1 and 30")
    return {"forecast": forecast(days)}

@app.get("/api/anomalies")
def anomalies():
    df = HISTORY.copy()
    detector = IsolationForest(contamination=0.04, random_state=42)
    labels = detector.fit_predict(df[["consumption_kwh"]])
    result = []
    for row, label in zip(df.itertuples(), labels):
        if label == -1:
            result.append({"date": row.date.strftime("%Y-%m-%d"),
                           "consumption_kwh": float(row.consumption_kwh),
                           "severity": "High" if row.consumption_kwh > 55 else "Moderate",
                           "message": "Consumption is unusual compared with the recent usage pattern."})
    return {"anomalies": result[-8:]}

@app.get("/api/recommendations")
def recommendations():
    avg = float(HISTORY.tail(30)["consumption_kwh"].mean())
    return {"recommendations": [
        {"title": "Shift flexible usage", "detail": "Run washing machines and dishwashers outside your usual peak period.", "saving": "5–10%"},
        {"title": "Optimize cooling", "detail": "Set air conditioning to an efficient temperature and clean filters regularly.", "saving": "8–15%"},
        {"title": "Reduce standby power", "detail": "Switch off chargers and devices that remain idle overnight.", "saving": "2–5%"},
        {"title": "Track high-use days", "detail": f"Your recent daily average is {avg:.1f} kWh. Review days that exceed it by 20%.", "saving": "Personalized"}
    ]}

@app.post("/api/report/pdf")
def pdf_report():
    data = dashboard()
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 55
    pdf.setTitle("GridWise AI Energy Report")
    pdf.setFont("Helvetica-Bold", 20)
    pdf.drawString(48, y, "GridWise AI - Energy Report")
    y -= 35
    pdf.setFont("Helvetica", 11)
    lines = [
        f"Generated: {datetime.now().strftime('%d %b %Y, %H:%M')}",
        f"90-day energy consumption: {data['total_kwh']} kWh",
        f"Daily average: {data['daily_average']} kWh",
        f"Recent monthly average change: {data['monthly_change_pct']}%",
        f"Peak day: {data['peak_day']} ({data['peak_kwh']} kWh)",
        "", "Next 7 days demand forecast:"
    ]
    for line in lines:
        pdf.drawString(48, y, line)
        y -= 22
    for item in data["forecast"]:
        pdf.drawString(65, y, f"{item['date']}  -  {item['predicted_kwh']} kWh")
        y -= 18
    y -= 10
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(48, y, "Energy-saving suggestions")
    y -= 22
    pdf.setFont("Helvetica", 10)
    for line in ["Shift flexible appliances away from peak periods.",
                 "Maintain cooling equipment and use efficient settings.",
                 "Switch off idle devices to reduce standby consumption."]:
        pdf.drawString(55, y, "- " + line)
        y -= 18
    pdf.save()
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=gridwise-energy-report.pdf"})
