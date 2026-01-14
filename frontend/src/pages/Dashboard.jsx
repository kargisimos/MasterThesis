import React, { useState, useMemo, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import DeviceService from "../services/deviceService";
import { Line } from "react-chartjs-2";
import "chart.js/auto";

export default function Dashboard() {
  const { userRole } = useAuth();
  const [timeframe, setTimeframe] = useState("24h");
  const [devices, setDevices] = useState([]);
  const [deviceModal, setDeviceModal] = useState(null);
  const [modalTimeframe, setModalTimeframe] = useState("24h");
  const [deviceHistory, setDeviceHistory] = useState([]);
  const [networkTrends, setNetworkTrends] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const wsRef = React.useRef(null);
  const reconnectTimeoutRef = React.useRef(null);

  const fetchDevices = async () => {
    try {
      const data = await DeviceService.getAll();
      setDevices(data);
      const trends = await DeviceService.getTrends(timeframe);
      setNetworkTrends(trends);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHistory = async (deviceId) => {
    try {
      const history = await DeviceService.getHistory(deviceId, modalTimeframe);
      setDeviceHistory(history.reverse());
    } catch (error) {
      console.error("Failed to fetch history:", error);
    }
  };

  const connectWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    const ws = new WebSocket("ws://localhost:8000/ws");
    
    ws.onopen = () => {
      console.log("✓ WebSocket connected");
      setWsConnected(true);
      // Clear any pending reconnection attempts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "device_update" && data.device) {
          // Update device in the list
          setDevices(prevDevices => {
            const index = prevDevices.findIndex(d => d.id === data.device.id);
            if (index !== -1) {
              const updated = [...prevDevices];
              updated[index] = { ...updated[index], ...data.device };
              return updated;
            }
            return prevDevices;
          });
          
          setLastUpdate(new Date().toLocaleTimeString());
          console.log(`🔄 Real-time update for ${data.device.name}`);
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("✗ WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("✗ WebSocket disconnected");
      setWsConnected(false);
      wsRef.current = null;
      
      // Attempt reconnection with exponential backoff
      const delay = Math.min(5000, 1000 * Math.pow(2, 0)); // Start with 1s, max 5s
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log("Attempting WebSocket reconnection...");
        connectWebSocket();
      }, delay);
    };

    wsRef.current = ws;
  };

  // WebSocket connection effect
  useEffect(() => {
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Initial data fetch and periodic refresh as fallback
  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 30000);
    return () => clearInterval(interval);
  }, [timeframe]);

  useEffect(() => {
    if (deviceModal) {
      fetchHistory(deviceModal.id);
      const interval = setInterval(() => fetchHistory(deviceModal.id), 30000);
      return () => clearInterval(interval);
    } else {
      setDeviceHistory([]);
    }
  }, [deviceModal, modalTimeframe]);

  const activeTriggers = useMemo(() => {
    const triggers = [];
    devices.forEach(d => {
      if (d.last_status === "offline") {
        triggers.push({ id: `off-${d.id}`, priority: "critical", msg: `${d.name}: Host is unreachable`, time: "Just now" });
      } else {
        if (d.last_cpu > 80) triggers.push({ id: `cpu-${d.id}`, priority: "critical", msg: `${d.name}: Critical CPU Usage (${d.last_cpu}%)`, time: "Recent" });
        if (d.last_memory > 85) triggers.push({ id: `mem-${d.id}`, priority: "warning", msg: `${d.name}: High Memory Usage (${d.last_memory}%)`, time: "Recent" });
        if (d.last_latency > 40) triggers.push({ id: `lat-${d.id}`, priority: "warning", msg: `${d.name}: High Latency (${d.last_latency}ms)`, time: "Recent" });
      }
    });
    return triggers.sort((a, b) => (a.priority === "critical" ? -1 : 1)).slice(0, 5);
  }, [devices]);

  const totalDevices = devices.length;
  const onlineDevices = devices.filter(d => d.last_status === "online").length;
  const activeDevices = devices.filter(d => d.last_status === "online");
  const avgCPU = (activeDevices.reduce((acc, d) => acc + (d.last_cpu || 0), 0) / onlineDevices || 0).toFixed(1);
  const avgMemory = (activeDevices.reduce((acc, d) => acc + (d.last_memory || 0), 0) / onlineDevices || 0).toFixed(1);
  const avgLatency = (activeDevices.reduce((acc, d) => acc + (d.last_latency || 0), 0) / onlineDevices || 0).toFixed(1);
  const avgTraffic = (activeDevices.reduce((acc, d) => acc + (d.last_traffic || 0), 0) / onlineDevices || 0).toFixed(1);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { usePointStyle: true, font: { family: "'Inter', sans-serif", size: 11 } } },
      tooltip: { backgroundColor: '#0f172a', padding: 12, cornerRadius: 8 }
    },
    scales: {
      y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.03)' } },
      x: { grid: { display: false }, ticks: { display: false } }
    }
  }), []);

  const getChartData = (label, dataKey, color, bgColor) => ({
    labels: deviceHistory.map(h => new Date(h.timestamp).toLocaleTimeString()),
    datasets: [
      { 
        label, 
        data: deviceHistory.map(h => h[dataKey]), 
        borderColor: color, 
        backgroundColor: bgColor, 
        fill: true, 
        tension: 0.4 
      },
    ]
  });

  if (isLoading && devices.length === 0) {
    return <div className="board"><div style={{ padding: "40px", textAlign: "center" }}>Initializing Dashboard...</div></div>;
  }

  return (
    <div className="board">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ margin: 0 }}>Network Monitoring Dashboard</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
              <span style={{ 
                width: "8px", 
                height: "8px", 
                borderRadius: "50%", 
                backgroundColor: wsConnected ? "#10b981" : "#ef4444",
                display: "inline-block",
                animation: wsConnected ? "pulse 2s infinite" : "none"
              }}></span>
              <span>{wsConnected ? "Live Updates" : "Disconnected"}</span>
            </div>
            {lastUpdate && (
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Last update: {lastUpdate}
              </div>
            )}
          </div>
        </div>
        
        <select value={timeframe} onChange={e => setTimeframe(e.target.value)} style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid #e2e8f0", fontWeight: "600" }}>
          <option value="24h">Real-time Stream</option>
          <option value="week">Last 7 Days</option>
          <option value="month">Last 30 Days</option>
        </select>
      </div>

      <div className="dashboard-summary">
        <div className="dashboard-summary-card">
          <h3>Inventory Health</h3>
          <p><span style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>Online Devices:</span> <b>{onlineDevices} / {totalDevices}</b></p>
          <div className="sub-text">Active Health Alerts: <b style={{ color: "var(--critical)" }}>{activeTriggers.length}</b></div>
        </div>
        <div className="dashboard-summary-card">
          <h3>Resource Load</h3>
          <p><span style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>Average CPU Usage:</span> <b>{avgCPU}%</b></p>
          <div className="sub-text">Average Memory Usage: <b>{avgMemory}%</b></div>
        </div>
        <div className="dashboard-summary-card">
          <h3>Network Status</h3>
          <p><span style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>Average Throughput:</span> <b>{avgTraffic} Mbps</b></p>
          <div className="sub-text">Average Response Latency: <b>{avgLatency} ms</b></div>
        </div>
      </div>

      <div className="dashboard-charts" style={{ display: "grid", gridTemplateColumns: "1.2fr 2fr 2fr", gap: "24px", marginBottom: "32px" }}>
        <div className="dashboard-chart-card">
          <h3 style={{ marginBottom: "16px" }}>Critical Alerts</h3>
          <div className="trigger-list">
            {activeTriggers.length > 0 ? activeTriggers.map(t => (
              <div key={t.id} className={`trigger-item ${t.priority}`}>
                <span className={`priority-badge ${t.priority}`}>{t.priority}</span>
                <span style={{ fontSize: "0.875rem", fontWeight: "500" }}>{t.msg}</span>
                <span className="trigger-time">{t.time}</span>
              </div>
            )) : (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>All systems normal</div>
            )}
          </div>
        </div>

        <div className="dashboard-chart-card">
          <h3>Resource Load Trends</h3>
          <div className="chart-container" style={{ height: "250px" }}>
            <Line 
              data={{
                labels: networkTrends.map(t => new Date(t.timestamp).toLocaleTimeString()),
                datasets: [
                  { label: "Avg CPU (%)", data: networkTrends.map(t => t.avg_cpu), borderColor: "#3b82f6", tension: 0.4, fill: true, backgroundColor: "rgba(59,130,246,0.05)" },
                  { label: "Avg Mem (%)", data: networkTrends.map(t => t.avg_memory), borderColor: "#f59e0b", tension: 0.4, fill: true, backgroundColor: "rgba(245,158,11,0.05)" }
                ]
              }} 
              options={chartOptions} 
            />
          </div>
        </div>

        <div className="dashboard-chart-card">
          <h3>Consistency Trends</h3>
          <div className="chart-container" style={{ height: "250px" }}>
            <Line 
              data={{
                labels: networkTrends.map(t => new Date(t.timestamp).toLocaleTimeString()),
                datasets: [
                  { label: "Latency (ms)", data: networkTrends.map(t => t.avg_latency), borderColor: "#8b5cf6", tension: 0.4, fill: true, backgroundColor: "rgba(139,92,246,0.05)" },
                  { label: "Traffic (Mbps)", data: networkTrends.map(t => t.avg_traffic), borderColor: "#10b981", tension: 0.4, fill: true, backgroundColor: "rgba(16,185,129,0.05)" }
                ]
              }} 
              options={chartOptions} 
            />
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: "1.25rem", margin: "32px 0 20px" }}>Active Network Inventory</h2>
      <div className="device-metrics">
        {devices.map(device => (
          <div key={device.id} className="device-card" onClick={() => userRole !== "viewer" && setDeviceModal(device)}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
              <h4 style={{ margin: 0 }}>{device.name}</h4>
              <span className={`status-dot ${device.last_status}`}></span>
            </div>
            <div className="latency-indicator good">
              <span style={{ fontSize: "0.75rem" }}>CPU: <b>{device.last_cpu || 0}%</b> | Mem: <b>{device.last_memory || 0}%</b></span>
              <span className="metric-badge">{device.last_latency || "--"} ms</span>
            </div>
            <div style={{ marginTop: "12px", fontSize: "0.80rem", color: "var(--text-muted)" }}>IP: <b>{device.ip_address}</b></div>
          </div>
        ))}
      </div>

      {deviceModal && (
        <div className="modal-overlay" onClick={() => setDeviceModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
              <div>
                <h2 style={{ margin: 0 }}>{deviceModal.name} Diagnostic Detail</h2>
                <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>IP: {deviceModal.ip_address} | Type: {deviceModal.type.toUpperCase()}</div>
              </div>
              <button className="modal-close" onClick={() => setDeviceModal(null)}>Close</button>
            </div>
            
            <div className="modal-grid">
              <div className="modal-info">
                <h3>Vitals (Current)</h3>
                <p>Status: <b style={{ color: deviceModal.last_status === "online" ? "var(--success)" : "var(--danger)" }}>{deviceModal.last_status.toUpperCase()}</b></p>
                <p>CPU Load: <b>{deviceModal.last_cpu || 0}%</b></p>
                <p>Memory Usage: <b>{deviceModal.last_memory || 0}%</b></p>
                <p>Response Latency: <b>{deviceModal.last_latency || "--"} ms</b></p>
              </div>
              <div className="modal-info">
                <h3>Detailed Meta</h3>
                <p>Location: <b>{deviceModal.location || "Not set"}</b></p>
                <p>Manufacturer: <b>{deviceModal.manufacturer || "Unknown"}</b></p>
                <p>Last Polled: <b>{deviceModal.last_polled ? new Date(deviceModal.last_polled).toLocaleTimeString() : "Never"}</b></p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="dashboard-chart-card">
                <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>CPU Load History (%)</h3>
                <div className="chart-container" style={{ height: "220px" }}>
                  <Line data={getChartData("CPU (%)", "cpu_usage", "#3b82f6", "rgba(59,130,246,0.1)")} options={chartOptions} />
                </div>
              </div>
              <div className="dashboard-chart-card">
                <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Memory Usage History (%)</h3>
                <div className="chart-container" style={{ height: "220px" }}>
                  <Line data={getChartData("Memory (%)", "memory_usage", "#f59e0b", "rgba(245,158,11,0.1)")} options={chartOptions} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
