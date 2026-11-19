import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Zap, Activity, TrendingUp, Gauge, Download, AlertTriangle, Lightbulb, RefreshCw, Leaf, CalendarDays } from 'lucide-react';
import './style.css';

const API = 'http://127.0.0.1:8000/api';
function Metric({icon: Icon, label, value, unit, note}) {
  return <div className="metric"><div className="metric-top"><span>{label}</span><Icon size={19}/></div><div className="metric-value">{value}<small>{unit}</small></div><p>{note}</p></div>;
}
function App() {
  const [data, setData] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true); setError('');
    try {
      const [dash, anomalyRes, recRes] = await Promise.all([
        axios.get(`${API}/dashboard`), axios.get(`${API}/anomalies`), axios.get(`${API}/recommendations`)
      ]);
      setData(dash.data); setAnomalies(anomalyRes.data.anomalies); setRecommendations(recRes.data.recommendations);
    } catch (e) { setError('Could not connect to the backend. Start the FastAPI server on port 8000 and refresh.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { load(); }, []);
  async function downloadReport() {
    try {
      const res = await axios.post(`${API}/report/pdf`, {}, {responseType:'blob'});
      const url = URL.createObjectURL(new Blob([res.data], {type:'application/pdf'}));
      const a = document.createElement('a'); a.href = url; a.download = 'gridwise-energy-report.pdf'; a.click(); URL.revokeObjectURL(url);
    } catch { setError('Report download failed. Please check that the backend is running.'); }
  }
  if (!data && !error) return <div className="loading"><Zap size={30}/> Loading GridWise AI...</div>;
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-icon"><Zap size={22}/></div><div><b>GridWise</b><span>AI ENERGY INTELLIGENCE</span></div></div>
      <div className="nav-label">WORKSPACE</div><div className="nav-item active"><Activity size={18}/> Overview</div>
      <div className="nav-item"><TrendingUp size={18}/> Demand forecast</div><div className="nav-item"><AlertTriangle size={18}/> Anomalies</div>
      <div className="nav-item"><Lightbulb size={18}/> Recommendations</div>
      <div className="sidebar-bottom"><div className="green-dot"/> Demo data environment</div>
    </aside>
    <main className="main">
      <header className="topbar"><div><div className="eyebrow">ENERGY MANAGEMENT / OVERVIEW</div><h1>Energy Intelligence Dashboard</h1><p>Monitor usage, anticipate demand, and discover smarter ways to save.</p></div>
      <div className="actions"><button className="secondary" onClick={load}><RefreshCw size={16}/> Refresh</button><button className="primary" onClick={downloadReport}><Download size={16}/> Export report</button></div></header>
      {error && <div className="error">{error} <button onClick={load}>Retry</button></div>}
      {data && <>
        <div className="statusline"><span><i/> LIVE ANALYTICS PREVIEW</span><span><CalendarDays size={14}/> Last 90 days of sample data</span></div>
        <section className="metrics">
          <Metric icon={Zap} label="Total energy usage" value={data.total_kwh.toLocaleString()} unit=" kWh" note="Recorded across 90 days"/>
          <Metric icon={Gauge} label="Daily average" value={data.daily_average} unit=" kWh" note="Average daily consumption"/>
          <Metric icon={TrendingUp} label="Monthly trend" value={`${data.monthly_change_pct > 0 ? '+' : ''}${data.monthly_change_pct}%`} unit="" note="Recent 30 days vs prior 30"/>
          <Metric icon={Activity} label="Peak consumption" value={data.peak_kwh} unit=" kWh" note={`Highest on ${data.peak_day}`}/>
        </section>
        <section className="chart-grid">
          <div className="panel large"><div className="panel-heading"><div><h2>Consumption overview</h2><p>Daily energy usage · Last 30 days</p></div><span className="tag">HISTORICAL</span></div>
            <div className="chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.history}><defs><linearGradient id="usageFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4fd1b5" stopOpacity={0.28}/><stop offset="95%" stopColor="#4fd1b5" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#263348"/><XAxis dataKey="date" tickFormatter={v=>v.slice(5)} stroke="#8492a6" tick={{fontSize:11}}/><YAxis stroke="#8492a6" tick={{fontSize:11}}/><Tooltip contentStyle={{background:'#111c2e',border:'1px solid #30415b',borderRadius:10}}/><Area type="monotone" dataKey="consumption_kwh" name="Consumption (kWh)" stroke="#4fd1b5" fill="url(#usageFill)" strokeWidth={2.5}/></AreaChart></ResponsiveContainer></div>
          </div>
          <div className="panel"><div className="panel-heading"><div><h2>7-day demand forecast</h2><p>Machine learning estimate</p></div><span className="tag purple">PREDICTED</span></div>
            <div className="chart short"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.forecast}><CartesianGrid strokeDasharray="3 3" stroke="#263348"/><XAxis dataKey="date" tickFormatter={v=>v.slice(5)} stroke="#8492a6" tick={{fontSize:10}}/><YAxis stroke="#8492a6" tick={{fontSize:10}}/><Tooltip contentStyle={{background:'#111c2e',border:'1px solid #30415b',borderRadius:10}}/><Bar dataKey="predicted_kwh" name="Forecast (kWh)" fill="#9b8cff" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div>
            <div className="forecast-note"><span className="purple-dot"/> Random Forest regression model</div>
          </div>
        </section>
        <section className="lower-grid">
          <div className="panel"><div className="panel-heading"><div><h2>Unusual usage detected</h2><p>Consumption outliers identified by AI</p></div><span className="count">{anomalies.length} alerts</span></div>
            {anomalies.length ? <div className="anomaly-list">{anomalies.map((a,i)=><div className="anomaly" key={i}><div className="alert-icon"><AlertTriangle size={17}/></div><div className="anomaly-text"><b>{a.date} · {a.severity} deviation</b><span>{a.message}</span></div><strong>{a.consumption_kwh.toFixed(1)} kWh</strong></div>)}</div> : <div className="empty">No unusual usage detected.</div>}
          </div>
          <div className="panel"><div className="panel-heading"><div><h2>Smart saving insights</h2><p>Practical actions to improve efficiency</p></div><Leaf size={19} color="#4fd1b5"/></div>
            <div className="tips">{recommendations.map((r,i)=><div className="tip" key={i}><div className="tip-number">0{i+1}</div><div><b>{r.title}</b><p>{r.detail}</p><span>Potential saving: {r.saving}</span></div></div>)}</div>
          </div>
        </section>
        <footer>GridWise AI · Intelligent energy insights <span>Demo dataset · Forecasts are estimates, not utility-meter readings.</span></footer>
      </>}
    </main>
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
