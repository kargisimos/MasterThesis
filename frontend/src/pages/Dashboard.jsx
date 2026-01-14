import React, { useState, useMemo, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { Line } from "react-chartjs-2";
import "chart.js/auto";

export default function Dashboard() {
  const { userRole } = useAuth();
  const [timeframe, setTimeframe] = useState("24h");
  const [deviceModal, setDeviceModal] = useState(null);
  const [modalTimeframe, setModalTimeframe] = useState("24h");

  useEffect(() => {
    if (deviceModal) setModalTimeframe("24h");
  }, [deviceModal]);

  const [devices] = useState([
    { id: 1, name: "Router A", type: "Router", ip_address: "192.168.1.1", status: "online", cpu: 35, memory: 60, traffic: 120, latency: 12, packetLoss: 0.1, uptime: "45d 12h", location: "Data Center Rack 1", notes: "Main router", configuredServices: ["SSH", "SNMP"] },
    { id: 2, name: "Switch B", type: "Switch", ip_address: "192.168.1.2", status: "offline", cpu: 0, memory: 0, traffic: 0, latency: null, packetLoss: 100, uptime: "0d 0h", location: "Data Center Rack 2", notes: "Backup switch", configuredServices: ["SNMP"] },
    { id: 3, name: "Server C", type: "Server", ip_address: "192.168.1.10", status: "online", cpu: 70, memory: 82, traffic: 305, latency: 2, packetLoss: 0, uptime: "128d 4h", location: "Server Room 3", notes: "Production DB", configuredServices: ["SSH"] },
    { id: 4, name: "IoT Device D", type: "IoT Device", ip_address: "192.168.1.50", status: "online", cpu: 25, memory: 40, traffic: 22, latency: 45, packetLoss: 1.2, uptime: "12d 6h", location: "Lab 1", notes: "Temp sensor", configuredServices: ["SNMP"] },
  ]);

  const activeTriggers = useMemo(() => {
    const triggers = [];
    devices.forEach(d => {
      if (d.status === "offline") {
        triggers.push({ id: `off-${d.id}`, priority: "critical", msg: `${d.name}: Host is unreachable`, time: "Just now" });
      } else {
        if (d.cpu > 80) triggers.push({ id: `cpu-${d.id}`, priority: "critical", msg: `${d.name}: Critical CPU Usage (${d.cpu}%)`, time: "5 min ago" });
        if (d.memory > 85) triggers.push({ id: `mem-${d.id}`, priority: "warning", msg: `${d.name}: High Memory Usage (${d.memory}%)`, time: "10 min ago" });
        if (d.latency > 40) triggers.push({ id: `lat-${d.id}`, priority: "warning", msg: `${d.name}: High Latency (${d.latency}ms)`, time: "2 min ago" });
      }
    });
    return triggers.sort((a, b) => (a.priority === "critical" ? -1 : 1)).slice(0, 5);
  }, [devices]);

  const totalDevices = devices.length;
  const onlineDevices = devices.filter(d => d.status === "online").length;
  const activeDevices = devices.filter(d => d.status === "online");
  const avgCPU = (activeDevices.reduce((acc, d) => acc + d.cpu, 0) / onlineDevices || 0).toFixed(1);
  const avgMemory = (activeDevices.reduce((acc, d) => acc + d.memory, 0) / onlineDevices || 0).toFixed(1);
  const avgLatency = (activeDevices.reduce((acc, d) => acc + (d.latency || 0), 0) / onlineDevices || 0).toFixed(1);
  const avgTraffic = (activeDevices.reduce((acc, d) => acc + d.traffic, 0) / onlineDevices || 0).toFixed(1);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { usePointStyle: true, font: { family: "'Inter', sans-serif", size: 11 } } },
      tooltip: { backgroundColor: '#0f172a', padding: 12, cornerRadius: 8 }
    },
    scales: {
      y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.03)' } },
      x: { grid: { display: false } }
    }
  }), []);

  const generateChartData = pointsCount => Array.from({ length: pointsCount }, () => Math.floor(Math.random() * 100));

  const getLabels = (targetTimeframe) => {
    let pointsCount = targetTimeframe === "24h" ? 24 : targetTimeframe === "week" ? 7 : 30;
    return targetTimeframe === "24h" ? Array.from({ length: pointsCount }, (_, i) => `${i}h`) :
           targetTimeframe === "week" ? ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"] :
           Array.from({ length: pointsCount }, (_, i) => `Day ${i+1}`);
  };

  const labels = useMemo(() => getLabels(timeframe), [timeframe]);
  const modalLabels = useMemo(() => getLabels(modalTimeframe), [modalTimeframe]);

  const mainChartData = useMemo(() => ({
    labels,
    datasets: [
      { label: "CPU Usage (%)", data: generateChartData(labels.length), borderColor: "#3b82f6", backgroundColor: "rgba(59,130,246,0.1)", fill: true, tension: 0.4 },
      { label: "Memory Usage (%)", data: generateChartData(labels.length), borderColor: "#f59e0b", backgroundColor: "rgba(245,158,11,0.1)", fill: true, tension: 0.4 },
    ]
  }), [labels]);

  const networkQualityData = useMemo(() => ({
    labels,
    datasets: [
      { label: "Latency (ms)", data: generateChartData(labels.length).map(v => v/2), borderColor: "#3b82f6", tension: 0.4 },
      { label: "Packet Loss (%)", data: generateChartData(labels.length).map(v => v/10), borderColor: "#ef4444", tension: 0.4 },
    ]
  }), [labels]);

  const trafficChartData = useMemo(() => ({
    labels,
    datasets: [
      { label: "Network Traffic (Mbps)", data: generateChartData(labels.length).map(v => v * 2 + 50), borderColor: "#10b981", backgroundColor: "rgba(16,185,129,0.1)", fill: true, tension: 0.4 },
    ]
  }), [labels]);

  const getDeviceSpecificData = (device, type, targetLabels) => {
    const color = type === 'cpu' ? "#3b82f6" : type === 'mem' ? "#f59e0b" : "#10b981";
    const label = type === 'cpu' ? "CPU (%)" : type === 'mem' ? "Memory (%)" : "Traffic (Mbps)";
    return {
      labels: targetLabels,
      datasets: [
        { label, data: generateChartData(targetLabels.length), borderColor: color, backgroundColor: "rgba(0,0,0,0.05)", fill: true, tension: 0.4 },
      ]
    };
  };

  return (
    <div className="board">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1 style={{ margin: 0 }}>Network Monitoring Dashboard</h1>
        
        <select value={timeframe} onChange={e => setTimeframe(e.target.value)} style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid #e2e8f0", fontWeight: "600" }}>
          <option value="24h">Last 24 Hours</option>
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

      <div className="dashboard-charts" style={{ gridTemplateColumns: "1fr 2fr", marginBottom: "32px" }}>
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
          <h3>Resource Performance (Avg CPU & Memory)</h3>
          <div className="chart-container">
            <Line data={mainChartData} options={chartOptions} />
          </div>
        </div>
      </div>

      <div className="dashboard-charts">
        <div className="dashboard-chart-card">
          <h3>Network Throughput (Mbps)</h3>
          <div className="chart-container">
            <Line data={trafficChartData} options={chartOptions} />
          </div>
        </div>
        <div className="dashboard-chart-card">
          <h3>Quality Trends (Latency & Loss)</h3>
          <div className="chart-container">
            <Line data={networkQualityData} options={chartOptions} />
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: "1.25rem", margin: "32px 0 20px" }}>Active Network Inventory</h2>
      <div className="device-metrics">
        {devices.map(device => (
          <div key={device.id} className="device-card" onClick={() => userRole !== "viewer" && setDeviceModal(device)}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
              <h4 style={{ margin: 0 }}>{device.name}</h4>
              <span className={`status-dot ${device.status}`}></span>
            </div>
            <div className="latency-indicator good">
              <span style={{ fontSize: "0.75rem" }}>CPU: <b>{device.cpu}%</b></span>
              <span className="metric-badge">{device.latency || "--"} ms</span>
            </div>
            <div className="service-badges">
              {device.configuredServices.map(s => <span key={s} className="service-badge up">{s}</span>)}
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
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <select 
                  value={modalTimeframe} 
                  onChange={e => setModalTimeframe(e.target.value)} 
                  style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontWeight: "600", fontSize: '0.85rem' }}
                >
                  <option value="24h">Last 24h</option>
                  <option value="week">Last 7d</option>
                  <option value="month">Last 30d</option>
                </select>
                <button className="modal-close" onClick={() => setDeviceModal(null)}>Close</button>
              </div>
            </div>
            
            <div className="modal-grid">
              <div className="modal-info">
                <h3>Vitals (Current)</h3>
                <p>Status: <b style={{ color: deviceModal.status === "online" ? "var(--success)" : "var(--danger)" }}>{deviceModal.status.toUpperCase()}</b></p>
                <p>CPU Load: <b>{deviceModal.cpu}%</b></p>
                <p>Memory Usage: <b>{deviceModal.memory}%</b></p>
                <p>Response Latency: <b>{deviceModal.latency || "--"} ms</b></p>
              </div>
              <div className="modal-info">
                <h3>Configured Management</h3>
                <div className="service-badges" style={{ marginTop: '0' }}>
                  {deviceModal.configuredServices.length > 0 ? deviceModal.configuredServices.map(s => (
                    <span key={s} className="service-badge up" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>{s}</span>
                  )) : "None"}
                </div>
                <div style={{ marginTop: '16px' }}>
                  <p>Location: <b>{deviceModal.location}</b></p>
                  <p>Uptime: <b>{deviceModal.uptime}</b></p>
                </div>
              </div>
            </div>

            {/* Vertical Stacked Charts in Modal */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="dashboard-chart-card">
                <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>CPU Load History (%)</h3>
                <div className="chart-container" style={{ height: "220px" }}>
                  <Line data={getDeviceSpecificData(deviceModal, 'cpu', modalLabels)} options={chartOptions} />
                </div>
              </div>
              <div className="dashboard-chart-card">
                <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Memory Usage History (%)</h3>
                <div className="chart-container" style={{ height: "220px" }}>
                  <Line data={getDeviceSpecificData(deviceModal, 'mem', modalLabels)} options={chartOptions} />
                </div>
              </div>
              <div className="dashboard-chart-card">
                <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Traffic Load History (Mbps)</h3>
                <div className="chart-container" style={{ height: "220px" }}>
                  <Line data={getDeviceSpecificData(deviceModal, 'traffic', modalLabels)} options={chartOptions} />
                </div>
              </div>
            </div>
            
            <div className="dashboard-chart-card" style={{ marginTop: '24px' }}>
              <h3>Recent Diagnostic Logs</h3>
              <div className="trigger-list" style={{ gap: "8px" }}>
                <div className="trigger-item info" style={{ padding: "8px 12px" }}>Configured Management {deviceModal.configuredServices.join('/')} polling ok</div>
                {deviceModal.status === "offline" && <div className="trigger-item critical" style={{ padding: "8px 12px" }}>ICMP Ping timeout for {deviceModal.ip_address}</div>}
                {deviceModal.cpu > 80 && <div className="trigger-item warning" style={{ padding: "8px 12px" }}>Processor load threshold (greater than 80%) exceeded</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
