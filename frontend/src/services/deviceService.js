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
};

export default DeviceService;
