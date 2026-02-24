import React, { useState, useMemo, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../context/ThemeContext";
import DeviceService from "../services/deviceService";
import { Line } from "react-chartjs-2";
import "chart.js/auto";

export default function Dashboard() {
  const { userRole } = useAuth();
  const { theme } = useTheme();
  const [timeframe, setTimeframe] = useState("24h");
  const [devices, setDevices] = useState([]);
  const [deviceModal, setDeviceModal] = useState(null);
  const [modalTimeframe, setModalTimeframe] = useState("24h");
  const [deviceHistory, setDeviceHistory] = useState([]);
  const [networkTrends, setNetworkTrends] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  
  // New State for Management View
  const [showManageView, setShowManageView] = useState(false);
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState(null);
  const [managingAction, setManagingAction] = useState(null); // 'reboot', or service name
  const [confirmModal, setConfirmModal] = useState(null);
  
  const wsRef = React.useRef(null);
  const reconnectTimeoutRef = React.useRef(null);

  const fetchDevices = async () => {
    try {
      const data = await DeviceService.getAll();
      setDevices(data);
      const trends = await DeviceService.getTrends(timeframe);
      setNetworkTrends(trends || []);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = (type, deviceId = null) => {
    const baseUrl = "http://localhost:8000/devices";
    const token = localStorage.getItem("access_token");
    let url = "";
    
    if (deviceId) {
      url = `${baseUrl}/${deviceId}/history/export?format=${type}`;
    } else {
      url = `${baseUrl}/export?format=${type}`;
    }
    
    fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => response.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = deviceId ? `device_${deviceId}_history.${type}` : `inventory_export.${type}`;
      document.body.appendChild(a);
      a.click();    
      a.remove();
    })
    .catch(err => console.error("Export failed:", err));
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
      return;
    }

    const ws = new WebSocket("ws://localhost:8000/ws");
    
    ws.onopen = () => {
      console.log("✓ WebSocket connected");
      setWsConnected(true);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "device_update" && data.device) {
          setDevices(prevDevices => {
            const index = prevDevices.findIndex(d => d.id === data.device.id);
            if (index !== -1) {
              const updated = [...prevDevices];
              updated[index] = { ...updated[index], ...data.device };
              return updated;
            }
            return prevDevices;
          });
          setDeviceModal(prevModal => {
            if (prevModal && prevModal.id === data.device.id) {
              return { ...prevModal, ...data.device };
            }
            return prevModal;
          });
          setLastUpdate(new Date().toLocaleTimeString());
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
      const delay = Math.min(5000, 1000 * Math.pow(2, 0));
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, delay);
    };

    wsRef.current = ws;
  };

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 30000);
    return () => clearInterval(interval);
  }, [timeframe]);

  useEffect(() => {
    if (deviceModal) {
      if (!showManageView) {
        fetchHistory(deviceModal.id);
        const interval = setInterval(() => fetchHistory(deviceModal.id), 30000);
        return () => clearInterval(interval);
      } else {
        fetchServices(deviceModal.id);
      }
    } else {
      setDeviceHistory([]);
      setShowManageView(false);
    }
  }, [deviceModal, modalTimeframe, showManageView]);

  const fetchServices = async (id) => {
    setServicesLoading(true);
    setServicesError(null);
    try {
      const data = await DeviceService.getServices(id);
      setServices(data || []);
    } catch (e) {
      console.error("Failed to fetch services", e);
      const detail = e.response?.data?.detail || "Failed to fetch running services. Ensure SSH is configured and active.";
      setServicesError(detail);
      setServices([]);
    } finally {
      setServicesLoading(false);
    }
  };

  const handleRestartService = (serviceName) => {
    setConfirmModal({
      title: 'Restart Service',
      message: `Are you sure you want to restart ${serviceName}?`,
      type: 'warning',
      onConfirm: async () => {
        setConfirmModal(null);
        setManagingAction(serviceName);
        try {
          await DeviceService.restartService(deviceModal.id, serviceName);
          fetchServices(deviceModal.id);
        } catch (e) {
          alert(`Failed to restart ${serviceName}: ` + (e.response?.data?.detail || e.message));
        } finally {
          setManagingAction(null);
        }
      }
    });
  };

  const handleReboot = () => {
    setConfirmModal({
      title: 'Reboot Device',
      message: `CRITICAL ACTION: Are you sure you want to REBOOT ${deviceModal.name}? This will cause immediate downtime.`,
      type: 'danger',
      onConfirm: async () => {
        setConfirmModal(null);
        setManagingAction('reboot');
        try {
          await DeviceService.rebootDevice(deviceModal.id);
          setDeviceModal(null); // Close modal 
        } catch (e) {
          alert(`Failed to send reboot command: ` + (e.response?.data?.detail || e.message));
        } finally {
          setManagingAction(null);
        }
      }
    });
  };

  const activeTriggers = useMemo(() => {
    const triggers = [];
    devices.forEach(d => {
      if (d.last_status === "offline") {
        triggers.push({ id: `off-${d.id}`, priority: "critical", msg: `${d.name}: Host is unreachable`, time: "Just now" });
      } else {
        try {
          const failing = JSON.parse(d.failing_protocols || "[]");
          failing.forEach(protocol => {
            const isConfigured = d.configured_credentials?.includes(protocol.toLowerCase());
            if (!isConfigured) return;
            const isAuth = d.last_error?.toLowerCase().includes("auth failed");
            const isCriticalProtocol = protocol.toLowerCase().includes("ssh") || protocol.toLowerCase().includes("snmp");
            const priority = (isAuth || isCriticalProtocol) ? "critical" : "warning";
            triggers.push({ id: `fail-${protocol}-${d.id}`, priority: priority, msg: `${d.name}: ${protocol.toUpperCase()} ${isAuth ? 'Auth Failed' : 'Polling Error'}`, time: "Action Required" });
          });
        } catch (e) {
          console.error("Failed to parse failing protocols:", e);
        }
        if (d.last_cpu > 90) triggers.push({ id: `cpu-${d.id}`, priority: "critical", msg: `${d.name}: Critical CPU Usage (${d.last_cpu}%)`, time: "Recent" });
        else if (d.last_cpu > 70) triggers.push({ id: `cpu-${d.id}`, priority: "warning", msg: `${d.name}: High CPU Usage (${d.last_cpu}%)`, time: "Recent" });
        if (d.last_memory > 90) triggers.push({ id: `mem-${d.id}`, priority: "critical", msg: `${d.name}: Critical Memory Usage (${d.last_memory}%)`, time: "Recent" });
        else if (d.last_memory > 70) triggers.push({ id: `mem-${d.id}`, priority: "warning", msg: `${d.name}: High Memory Usage (${d.last_memory}%)`, time: "Recent" });
        if (d.last_latency > 40) triggers.push({ id: `lat-${d.id}`, priority: "warning", msg: `${d.name}: High Latency (${d.last_latency}ms)`, time: "Recent" });
      }
    });
    return triggers.sort((a, b) => (a.priority === "critical" ? -1 : 1)).slice(0, 10);
  }, [devices]);

  const totalDevices = devices.length;
  const onlineCount = devices.filter(d => d.is_active && d.last_status === "online").length;
  const activeDevices = devices.filter(d => d.is_active && d.last_status === "online");
  const avgCPU = (activeDevices.reduce((acc, d) => acc + (Number(d.last_cpu) || 0), 0) / onlineCount || 0);
  const avgMemory = (activeDevices.reduce((acc, d) => acc + (Number(d.last_memory) || 0), 0) / onlineCount || 0);
  const avgLatency = (activeDevices.reduce((acc, d) => acc + (Number(d.last_latency) || 0), 0) / onlineCount || 0);
  const avgTraffic = (activeDevices.reduce((acc, d) => acc + (Number(d.last_traffic) || 0), 0) / onlineCount || 0);

  const getMetricColor = (type, value) => {
    if (value === null || value === undefined) return "var(--text-muted)";
    if (type === "cpu" || type === "mem") {
      if (value > 90) return "#ef4444";
      if (value > 80) return "#f59e0b"; // 85 for mem in original, simplifying
      return "#10b981";
    }
    if (type === "lat") {
      if (value > 40) return "#ef4444";
      if (value > 20) return "#f59e0b";
      return "#10b981";
    }
    return "inherit";
  };

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        position: 'top', 
        labels: { 
          usePointStyle: true, 
          color: theme === 'dark' ? '#9ca3af' : '#6b7280',
          font: { family: "'Inter', sans-serif", size: 11 } 
        } 
      },
      tooltip: { backgroundColor: '#0f172a', padding: 12, cornerRadius: 8 }
    },
    scales: {
      y: { 
        beginAtZero: true, 
        grid: { color: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' },
        ticks: { color: theme === 'dark' ? '#9ca3af' : '#6b7280', font: { size: 10 } }
      },
      x: { 
        grid: { display: false }, 
        ticks: { 
          display: true, 
          maxRotation: 0, 
          autoSkip: true, 
          maxTicksLimit: 6,
          color: theme === 'dark' ? '#9ca3af' : '#6b7280',
          font: { size: 10 }
        } 
      }
    }
  }), [theme]);

  const resourceLoadOptions = useMemo(() => ({
    ...chartOptions,
    scales: {
      ...chartOptions.scales,
      y: { ...chartOptions.scales.y, max: 100 }
    }
  }), [chartOptions]);

  const throughputChartOptions = useMemo(() => ({
    ...chartOptions,
    scales: {
      ...chartOptions.scales,
      y: { 
        ...chartOptions.scales.y,
        ticks: {
          ...chartOptions.scales.y.ticks,
          callback: (value) => value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })
        }
      }
    }
  }), [chartOptions]);

  const formatTraffic = (mbs) => {
    if (mbs === null || mbs === undefined) return "0 B/s";
    let bytes = mbs * 1048576; // Convert back to bytes for adaptive formatting
    if (bytes < 1024) return `${bytes.toFixed(2)} B/s`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(2)} KB/s`;
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(2)} MB/s`;
    return `${(bytes / 1073741824).toFixed(2)} GB/s`;
  };

  const ProtocolBadge = ({ type, configured, failed }) => {
    // Hierarchy: Not Configured (Gray) > Failed (Red) > Working (Green)
    const color = !configured ? "#cfcfcf" : (failed ? "#ef4444" : "#10b981");
    return (
      <span style={{
        fontSize: "0.65rem",
        padding: "2px 6px",
        borderRadius: "4px",
        backgroundColor: color,
        color: "#fff",
        fontWeight: "700",
        textTransform: "uppercase",
      }}>
        {type}
      </span>
    );
  };

  const getChartData = (label, dataKeys, historyData, colors, bgColors, range = "24h") => {
    const isSmallRange = range === "24h";
    const keys = Array.isArray(dataKeys) ? dataKeys : [dataKeys];
    const labels = Array.isArray(label) ? label : [label];
    const borderColors = Array.isArray(colors) ? colors : [colors];
    const backgroundColors = Array.isArray(bgColors) ? bgColors : [bgColors];

    let chartLabels = [];
    let datasetsData = keys.map(() => []);

    if (range === "7d" || range === "30d") {
      const daysCount = range === "7d" ? 7 : 30;
      const dateMap = {};
      
      // 1. Generate the last X days as a "calendar"
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const labelStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        chartLabels.push(labelStr);
        dateMap[labelStr] = keys.map(() => 0); // Initialize with 0s
      }

      // 2. Fill the calendar with data from historyData
      historyData.forEach(h => {
        const d = new Date(h.timestamp);
        const labelStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        if (dateMap[labelStr]) {
          keys.forEach((key, idx) => {
            // Take the max or avg if multiple entries exist, but with daily buckets it should be 1:1
            dateMap[labelStr][idx] = h[key] || 0;
          });
        }
      });

      // 3. Extract back into arrays
      chartLabels.forEach(lbl => {
        keys.forEach((_, idx) => {
          datasetsData[idx].push(dateMap[lbl][idx]);
        });
      });
    } else {
      // 24h / Real-time: Use raw timestamps as they come
      chartLabels = historyData.map(h => {
        const d = new Date(h.timestamp);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      });
      keys.forEach((key, idx) => {
        datasetsData[idx] = historyData.map(h => h[key]);
      });
    }

    return {
      labels: chartLabels,
      datasets: keys.map((key, i) => ({
        label: labels[i] || labels[0],
        data: datasetsData[i],
        borderColor: borderColors[i] || borderColors[0],
        backgroundColor: backgroundColors[i] || backgroundColors[0],
        fill: true,
        tension: 0.4
      }))
    };
  };

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
        
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div className="export-group" style={{ display: "flex", gap: "4px" }}>
            <button onClick={() => handleExport('csv')} style={{ padding: "8px 12px", fontSize: "0.8rem", backgroundColor: "var(--card-bg)", color: "var(--text-color)", border: "1px solid var(--input-border)" }}>Export CSV</button>
            <button onClick={() => handleExport('json')} style={{ padding: "8px 12px", fontSize: "0.8rem", backgroundColor: "var(--card-bg)", color: "var(--text-color)", border: "1px solid var(--input-border)" }}>Export JSON</button>
          </div>
          <select value={timeframe} onChange={e => setTimeframe(e.target.value)} style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid var(--input-border)", fontWeight: "600", marginBottom: 0 }}>
            <option value="24h">Real-time Stream</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>
      </div>

      <div className="dashboard-summary">
        <div className="dashboard-summary-card">
          <h3>Inventory Health</h3>
          <p><span style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>Online Devices:</span> <b>{onlineCount} / {totalDevices}</b></p>
          <div className="sub-text">Active Health Alerts: <b style={{ color: "var(--critical)" }}>{activeTriggers.length}</b></div>
        </div>
        <div className="dashboard-summary-card">
          <h3>Resource Load</h3>
          <p><span style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>Average CPU Usage:</span> <b>{Number(avgCPU).toFixed(1)}%</b></p>
          <div className="sub-text">Average Memory Usage: <b>{Number(avgMemory).toFixed(1)}%</b></div>
        </div>
        <div className="dashboard-summary-card">
          <h3>Network Status</h3>
          <p><span style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>Average Throughput:</span> <b>{formatTraffic(avgTraffic)}</b></p>
          <div className="sub-text">Average Response Latency: <b>{Number(avgLatency).toFixed(1)} ms</b></div>
        </div>
      </div>

      <div className="dashboard-charts">
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
          <h3>Resource Trends (CPU/Mem)</h3>
          <div className="chart-container" style={{ height: "250px" }}>
            <Line 
              data={getChartData(
                ["Avg CPU (%)", "Avg Mem (%)"], 
                ["avg_cpu", "avg_memory"], 
                networkTrends, 
                ["#3b82f6", "#f59e0b"], 
                ["rgba(59,130,246,0.05)", "rgba(245,158,11,0.05)"],
                timeframe
              )}
              options={resourceLoadOptions} 
            />
          </div>
        </div>

        <div className="dashboard-chart-card">
          <h3>Latency Trends</h3>
          <div className="chart-container" style={{ height: "250px" }}>
            <Line 
              data={getChartData(
                "Avg Latency (ms)", 
                "avg_latency", 
                networkTrends, 
                "#8b5cf6", 
                "rgba(139,92,246,0.05)",
                timeframe
              )}
              options={chartOptions} 
            />
          </div>
        </div>

        <div className="dashboard-chart-card">
          <h3>Throughput Trends</h3>
          <div className="chart-container" style={{ height: "250px" }}>
            <Line 
              data={getChartData(
                "Avg Traffic (MB/s)", 
                "avg_traffic", 
                networkTrends, 
                "#10b981", 
                "rgba(16,185,129,0.1)",
                timeframe
              )}
              options={throughputChartOptions} 
            />
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: "1.25rem", margin: "32px 0 20px" }}>Active Network Inventory</h2>
      <div className="device-metrics">
        {devices.map(device => (
          <div 
            key={device.id} 
            className="device-card" 
            onClick={() => userRole !== "viewer" && setDeviceModal(device)}
            style={{ 
              filter: device.is_active ? "none" : "grayscale(100%) opacity(0.5)",
              cursor: device.is_active ? "pointer" : "default" 
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <h4 style={{ margin: 0 }}>{device.name}</h4>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ display: "flex", gap: "4px" }}>
                  <ProtocolBadge 
                    type="SSH" 
                    configured={device.configured_credentials?.includes("ssh")} 
                    failed={JSON.parse(device.failing_protocols || "[]").includes("ssh")} 
                  />
                  <ProtocolBadge 
                    type="SNMP" 
                    configured={device.configured_credentials?.includes("snmp")} 
                    failed={JSON.parse(device.failing_protocols || "[]").includes("snmp")} 
                  />
                </div>
                <span className={`status-dot ${device.last_status}`}></span>
              </div>
            </div>
            <div className="latency-indicator good" style={{ borderLeft: `4px solid ${device.last_status === 'online' ? (device.last_error ? '#f59e0b' : '#10b981') : '#ef4444'}` }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {device.last_error ? (
                  <span style={{ fontSize: "0.75rem", color: "#ef4444", fontWeight: "600" }}>
                    ⚠️ {device.last_error}
                  </span>
                ) : (
                  <>
                    <span style={{ fontSize: "0.75rem" }}>
                      CPU: <b style={{ color: getMetricColor("cpu", device.last_cpu) }}>{device.last_cpu || 0}%</b> | 
                      Mem: <b style={{ color: getMetricColor("mem", device.last_memory) }}>{device.last_memory || 0}%</b>
                    </span>
                    <span style={{ fontSize: "0.75rem" }}>
                      Traf: <b>{formatTraffic(device.last_traffic)}</b>
                    </span>
                  </>
                )}
              </div>
              <span className="metric-badge" style={{ backgroundColor: getMetricColor("lat", device.last_latency), color: '#fff' }}>
                {device.last_latency || "--"} ms
              </span>
            </div>
            <div style={{ marginTop: "12px", fontSize: "0.80rem", color: "var(--text-muted)" }}>IP: <b>{device.ip_address}</b></div>
          </div>
        ))}
      </div>

      {deviceModal && (
        <div className="modal-overlay" onClick={() => setDeviceModal(null)}>
          <div className="modal" style={{ maxWidth: '900px', width: '90vw' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
              <div>
                <h2 style={{ margin: 0 }}>{deviceModal.name} {showManageView ? "Management" : "Diagnostic Detail"}</h2>
                <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>IP: {deviceModal.ip_address} | Type: {deviceModal.type.toUpperCase()}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button 
                  onClick={() => setShowManageView(!showManageView)}
                  style={{ 
                    padding: "6px 16px", 
                    borderRadius: "8px", 
                    backgroundColor: showManageView ? "var(--accent)" : "transparent",
                    color: showManageView ? "#fff" : "var(--accent)", 
                    border: "1px solid var(--accent)",
                    fontWeight: "600",
                    transition: "all 0.2s"
                  }}
                >
                  {showManageView ? "View Diagnostics" : "⚙️ Manage Device"}
                </button>
                
                {!showManageView && (
                  <>
                    <div style={{ display: "flex", border: "1px solid var(--input-border)", borderRadius: "8px", overflow: "hidden" }}>
                      {[
                        { value: "24h", label: "Real-time" },
                        { value: "7d", label: "7 Days" },
                        { value: "30d", label: "30 Days" }
                      ].map(option => (
                        <button
                          key={option.value}
                          onClick={() => setModalTimeframe(option.value)}
                          style={{
                            padding: "6px 12px",
                            fontSize: "0.85rem",
                            backgroundColor: modalTimeframe === option.value ? "var(--primary)" : "transparent",
                            color: modalTimeframe === option.value ? "#fff" : "var(--text-color)",
                            border: "none",
                            borderRight: option.value !== "30d" ? "1px solid var(--input-border)" : "none",
                            borderRadius: 0,
                            margin: 0,
                            fontWeight: modalTimeframe === option.value ? "600" : "400"
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <button onClick={() => handleExport('csv', deviceModal.id)} style={{ padding: "6px 10px", fontSize: "0.75rem", backgroundColor: "var(--card-bg)", color: "var(--text-color)", border: "1px solid var(--input-border)" }}>CSV</button>
                      <button onClick={() => handleExport('json', deviceModal.id)} style={{ padding: "6px 10px", fontSize: "0.75rem", backgroundColor: "var(--card-bg)", color: "var(--text-color)", border: "1px solid var(--input-border)" }}>JSON</button>
                    </div>
                  </>
                )}
                <button className="modal-close" onClick={() => setDeviceModal(null)}>Close</button>
              </div>
            </div>
            
            {showManageView ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div className="dashboard-chart-card" style={{ padding: '24px' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0 }}>Running Services (systemd)</h3>
                        <button 
                            onClick={() => fetchServices(deviceModal.id)} 
                            disabled={servicesLoading}
                            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                        >
                            {servicesLoading ? 'Loading...' : 'Refresh List'}
                        </button>
                     </div>
                     
                     <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--input-border)', borderRadius: '8px' }}>
                         <table className="data-table" style={{ margin: 0 }}>
                            <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--card-bg)', zIndex: 1 }}>
                                <tr>
                                    <th>Service Name</th>
                                    <th>Status</th>
                                    <th>Description</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {services.length === 0 && !servicesLoading && (
                                    <tr>
                                        <td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: servicesError ? 'var(--danger, #ef4444)' : 'var(--text-muted)' }}>
                                            {servicesError
                                              ? `⚠ ${servicesError}`
                                              : "No services found or SSH is not configured."
                                            }
                                        </td>
                                    </tr>
                                )}
                                {services.map((svc) => (
                                    <tr key={svc.name}>
                                        <td style={{ fontWeight: '500' }}>{svc.name}</td>
                                        <td>
                                            <span style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: 'bold' }}>● {svc.status}</span>
                                        </td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{svc.description}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button 
                                                onClick={() => handleRestartService(svc.name)}
                                                disabled={managingAction === svc.name}
                                                style={{ 
                                                    padding: '4px 10px', 
                                                    fontSize: '0.8rem', 
                                                    backgroundColor: 'transparent', 
                                                    border: '1px solid var(--input-border)',
                                                    color: 'var(--text-color)'
                                                }}
                                            >
                                                {managingAction === svc.name ? 'Restarting...' : 'Restart'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                         </table>
                     </div>
                </div>

                <div className="dashboard-chart-card" style={{ padding: '24px', borderLeft: '4px solid var(--danger)' }}>
                    <h3 style={{ color: 'var(--danger)', marginBottom: '8px', margin: 0 }}>Danger Zone</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
                        These actions may cause immediate downtime for the selected device and any connected clients.
                    </p>
                    <button 
                        onClick={handleReboot}
                        disabled={managingAction === 'reboot'}
                        style={{ 
                            backgroundColor: 'var(--danger)', 
                            color: 'white', 
                            padding: '10px 20px', 
                            border: 'none', 
                            borderRadius: '6px',
                            fontWeight: 'bold',
                            cursor: managingAction === 'reboot' ? 'not-allowed' : 'pointer',
                            opacity: managingAction === 'reboot' ? 0.7 : 1
                        }}
                    >
                        {managingAction === 'reboot' ? 'Sending command...' : '⚠️ Reboot Device'}
                    </button>
                </div>
              </div>
            ) : (
                <>
                    <div className="modal-grid">
                      <div className="modal-info">
                        <h3>Vitals (Current)</h3>
                        <p>Status: <b style={{ color: deviceModal.last_status === "online" ? "var(--success)" : "var(--danger)" }}>{deviceModal.last_status.toUpperCase()}</b></p>
                        {deviceModal.last_error && (
                          <p>Last Error: <b style={{ color: "var(--danger)" }}>{deviceModal.last_error}</b></p>
                        )}
                        <p>CPU Load: <b style={{ color: getMetricColor("cpu", deviceModal.last_cpu) }}>{deviceModal.last_cpu || 0}%</b></p>
                        <p>Memory Usage: <b style={{ color: getMetricColor("mem", deviceModal.last_memory) }}>{deviceModal.last_memory || 0}%</b></p>
                        <p>Response Latency: <b style={{ color: getMetricColor("lat", deviceModal.last_latency) }}>{deviceModal.last_latency || "--"} ms</b></p>
                      </div>
                      <div className="modal-info">
                        <h3>Detailed Meta</h3>
                        <p>Location: <b>{deviceModal.location || "Not set"}</b></p>
                        <p>Last Polled: <b>{deviceModal.last_polled ? new Date(deviceModal.last_polled).toLocaleTimeString() : "Never"}</b></p>
                        <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--card-border)" }}>
                          <div style={{ fontSize: "0.85rem", fontWeight: "600", marginBottom: "6px" }}>Poll Protocols:</div>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <ProtocolBadge 
                              type="SSH" 
                              configured={deviceModal.configured_credentials?.includes("ssh")} 
                              failed={JSON.parse(deviceModal.failing_protocols || "[]").includes("ssh")} 
                            />
                            <ProtocolBadge 
                              type="SNMP" 
                              configured={deviceModal.configured_credentials?.includes("snmp")} 
                              failed={JSON.parse(deviceModal.failing_protocols || "[]").includes("snmp")} 
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      <div className="dashboard-chart-card">
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>CPU Load History (%)</h3>
                        <div className="chart-container" style={{ height: "220px" }}>
                          <Line data={getChartData("CPU (%)", "cpu_usage", deviceHistory, "#3b82f6", "rgba(59,130,246,0.1)", modalTimeframe)} options={resourceLoadOptions} />
                        </div>
                      </div>
                      <div className="dashboard-chart-card">
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Memory Usage History (%)</h3>
                        <div className="chart-container" style={{ height: "220px" }}>
                          <Line data={getChartData("Memory (%)", "memory_usage", deviceHistory, "#f59e0b", "rgba(245,158,11,0.1)", modalTimeframe)} options={resourceLoadOptions} />
                        </div>
                      </div>
                      <div className="dashboard-chart-card">
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Network Throughput</h3>
                        <div className="chart-container" style={{ height: "220px" }}>
                          <Line data={getChartData("Traffic (MB/s)", "traffic", deviceHistory, "#10b981", "rgba(16,185,129,0.1)", modalTimeframe)} options={throughputChartOptions} />
                        </div>
                      </div>
                    </div>
                </>
            )}
          </div>
        </div>
      )}
      {/* Confirm Modal Overlay */}
      {confirmModal && (
        <div className="modal-overlay" style={{ zIndex: 2000 }} onClick={() => setConfirmModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{confirmModal.title}</h2>
            <p style={{ marginBottom: "20px" }}>{confirmModal.message}</p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button 
                className={confirmModal.type === "danger" ? "danger" : ""} 
                onClick={confirmModal.onConfirm}
              >
                Confirm
              </button>
              <button type="button" onClick={() => setConfirmModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
