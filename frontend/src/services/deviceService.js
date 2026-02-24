import api from "./api";

const DeviceService = {
    getAll: async () => {
        const response = await api.get("/devices/");
        return response.data;
    },

    create: async (deviceData) => {
        const response = await api.post("/devices/", deviceData);
        return response.data;
    },

    update: async (id, deviceData) => {
        const response = await api.patch(`/devices/${id}`, deviceData);
        return response.data;
    },

    delete: async (id) => {
        await api.delete(`/devices/${id}`);
    },

    saveCredentials: async (id, credentials) => {
        const response = await api.post(`/devices/${id}/credentials`, credentials);
        return response.data;
    },

    getHistory: async (id, timeframe = "24h") => {
        const response = await api.get(`/devices/${id}/history?range=${timeframe}`);
        return response.data;
    },

    getTrends: async (timeframe = "24h") => {
        const response = await api.get(`/devices/stats/trends?range=${timeframe}`);
        return response.data;
    },

    getServices: async (id) => {
        const response = await api.get(`/devices/${id}/services`);
        return response.data;
    },

    restartService: async (id, serviceName) => {
        const response = await api.post(`/devices/${id}/services/${serviceName}/restart`);
        return response.data;
    },

    rebootDevice: async (id) => {
        const response = await api.post(`/devices/${id}/reboot`);
        return response.data;
    },

    importDevices: async (csvFile) => {
        const formData = new FormData();
        formData.append("file", csvFile);
        const response = await api.post("/devices/import", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        return response.data;
    },
};

export default DeviceService;
