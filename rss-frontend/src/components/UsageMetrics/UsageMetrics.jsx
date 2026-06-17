import React, { useEffect, useState } from 'react';
import { fetchUsageMetrics } from '../../api';
import './UsageMetrics.css';

const UsageMetrics = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const res = await fetchUsageMetrics();
      setMetrics(res.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to load API usage metrics. Ensure that you have run the database migration to create the api_usage table.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="metrics-loading">
        <div className="spinner"></div>
        <p>Analyzing API logs and compiling costs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="metrics-error-container">
        <div className="error-card">
          <h2>⚠️ Database Migration Required</h2>
          <p>{error}</p>
          <div className="sql-box">
            <pre>
{`CREATE TABLE IF NOT EXISTS api_usage (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INT NOT NULL,
  completion_tokens INT NOT NULL,
  total_tokens INT NOT NULL,
  cost NUMERIC(10, 6) NOT NULL,
  purpose TEXT NOT NULL
);
ALTER TABLE api_usage DISABLE ROW LEVEL SECURITY;`}
            </pre>
          </div>
          <p className="sub-text">Please copy and run the SQL query above in your Supabase SQL Editor, then click reload.</p>
          <button className="btn-retry" onClick={loadMetrics}>🔄 Reload Metrics</button>
        </div>
      </div>
    );
  }

  const { summary, model_breakdown, purpose_breakdown, daily_trends, recent_logs } = metrics;

  return (
    <div className="metrics-wrapper">
      <div className="metrics-header-row">
        <h2>API Usage &amp; Cost Dashboard</h2>
        <button className="btn-refresh" onClick={loadMetrics}>🔄 Refresh Logs</button>
      </div>

      {/* Overview Cards */}
      <div className="metrics-grid">
        <div className="metric-card cost-card">
          <span className="card-label">Total Cost</span>
          <h3 className="card-value">${summary.total_cost.toFixed(4)}</h3>
          <span className="card-sub">Accrued project expense (USD)</span>
        </div>
        <div className="metric-card">
          <span className="card-label">Total API Calls</span>
          <h3 className="card-value">{summary.total_calls}</h3>
          <span className="card-sub">AI completions requested</span>
        </div>
        <div className="metric-card">
          <span className="card-label">Avg. Cost / Article</span>
          <h3 className="card-value">${summary.avg_cost_per_summary.toFixed(5)}</h3>
          <span className="card-sub">Cost per summarized entry</span>
        </div>
        <div className="metric-card">
          <span className="card-label">Total Tokens</span>
          <h3 className="card-value">{summary.total_tokens.toLocaleString()}</h3>
          <span className="card-sub">
            {summary.total_prompt_tokens.toLocaleString()} in / {summary.total_completion_tokens.toLocaleString()} out
          </span>
        </div>
      </div>

      {/* Model & Purpose Breakdowns */}
      <div className="breakdown-section">
        <div className="breakdown-table-box">
          <h4>Model Breakdown</h4>
          <table className="metrics-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Calls</th>
                <th>Tokens Used</th>
                <th>Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {model_breakdown.map((item, idx) => (
                <tr key={idx}>
                  <td className="font-mono">{item.model}</td>
                  <td>{item.calls}</td>
                  <td>{item.total_tokens.toLocaleString()}</td>
                  <td className="cost-highlight">${item.total_cost.toFixed(5)}</td>
                </tr>
              ))}
              {model_breakdown.length === 0 && (
                <tr>
                  <td colSpan="4" className="text-center text-muted">No usage logs found yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="breakdown-table-box">
          <h4>Purpose Breakdown</h4>
          <table className="metrics-table">
            <thead>
              <tr>
                <th>Purpose</th>
                <th>Calls</th>
                <th>Tokens Used</th>
                <th>Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {purpose_breakdown.map((item, idx) => (
                <tr key={idx}>
                  <td className="text-capitalize">{item.purpose.replace('_', ' ')}</td>
                  <td>{item.calls}</td>
                  <td>{item.total_tokens.toLocaleString()}</td>
                  <td className="cost-highlight">${item.total_cost.toFixed(5)}</td>
                </tr>
              ))}
              {purpose_breakdown.length === 0 && (
                <tr>
                  <td colSpan="4" className="text-center text-muted">No usage logs found yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily Trends & Recent Logs */}
      <div className="detailed-section">
        <div className="trends-box">
          <h4>Daily Spending History</h4>
          <div className="daily-list">
            {daily_trends.slice().reverse().map((item, idx) => (
              <div className="daily-item" key={idx}>
                <span className="daily-date">{new Date(item.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                <div className="daily-bar-wrapper">
                  <div 
                    className="daily-bar" 
                    style={{ 
                      width: `${Math.max(5, Math.min(100, (item.cost / (summary.total_cost || 1)) * 100))}%` 
                    }}
                  />
                </div>
                <span className="daily-cost">${item.cost.toFixed(5)}</span>
              </div>
            ))}
            {daily_trends.length === 0 && (
              <p className="text-muted text-center py-4">No daily logs compiled yet.</p>
            )}
          </div>
        </div>

        <div className="logs-box">
          <h4>Recent API Activity</h4>
          <div className="recent-logs-list">
            {recent_logs.map((log) => (
              <div className="log-item" key={log.id}>
                <div className="log-item-header">
                  <span className="log-purpose-badge">{log.purpose.replace('_', ' ')}</span>
                  <span className="log-time">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="log-item-details">
                  <span className="log-model">{log.model}</span>
                  <div className="log-stats-row">
                    <span>{log.total_tokens} tokens</span>
                    <span className="log-cost-val">${parseFloat(log.cost).toFixed(6)}</span>
                  </div>
                </div>
              </div>
            ))}
            {recent_logs.length === 0 && (
              <p className="text-muted text-center py-4">No active requests logged yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsageMetrics;
