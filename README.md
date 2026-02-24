# Master Thesis : Design and Development of a Web-Based Network Device Monitoring and Management System with a Unified Dashboard

## Overview
This system is a specialized platform for monitoring and managing network infrastructure. It is designed to provide administrators and network engineers with a centralized view of their environment, pulling real-time performance data from various types of network nodes. The system handles the complexity of communicating with routers, switches, servers, and IoT devices simultaneously, converting raw data into actionable insights through a unified web interface. 

The primary objective of this project is to demonstrate an efficient way to handle high-frequency data collection and real-time visualization while maintaining a secure and multi-user environment.

## Features
- **Real-Time Data Streaming**: Uses WebSockets and Redis Pub/Sub to push updates to the dashboard the moment they are collected, eliminating the need for page refreshes.
- **Support for Multiple Protocols**: Collects data through ICMP for availability/latency, SNMP (v2c) for hardware metrics, and SSH for direct system-level data.
- **Active Device Management**: Allows authorized users to interact with devices directly by restarting systemd services or initiating full reboots from the web UI.
- **Dynamic Threshold Alerting**: The system monitors metrics against pre-defined thresholds. When a device exceeds these limits, it triggers a critical alert.
- **Global Email Notifications**: Aggregates alerts across the entire network into single notification emails to prevent alert fatigue.
- **Comprehensive Inventory Control**: Supports bulk addition of devices through CSV files and provides detailed export options for performance history in JSON and CSV formats.
- **Interactive Visualizations**: Uses Chart.js to render historical trends for CPU load, memory usage, and network throughput across various timeframes (24h, 7d, 30d).
- **Role-Based Access Control (RBAC)**: Precise permission management across Admin, Operator, and Viewer roles ensures system integrity and security.
- **Advanced Security Suite**: Includes AES-256 encryption for credentials at rest, robust password complexity policies, and secure JWT-based session management.
- **Dynamic Theming**: Support for vibrant Light and polished Dark modes with persistence across user sessions via local storage.
- **Audit Logging & Traceability**: Comprehensive logging of all management and administrative actions, providing a full audit trail for accountability.
- **Automated Data Persistence**: Reliable storage of historical metrics in PostgreSQL for long-term reporting and performance analysis.
- **Containerized Architecture**: Fully dockerized environment using Docker Compose for seamless deployment and consistency across all environments.

## Roles and Permissions
The system implements a structured Role-Based Access Control (RBAC) model to ensure that users have exactly the permissions they need:
- **Admin**: Has total control over the system. This includes managing user accounts (creating, activating, and deactivating users), configuring global monitoring settings like polling intervals and alert thresholds, and viewing audit logs.
- **Operator**: Designed for network staff who need to manage the infrastructure. Operators can add or edit devices, configure credentials, and use the management console to restart services or reboot devices.
- **Viewer**: Intended for monitoring-only access. Viewers can see all dashboard metrics, view device details, and check historical charts, but they cannot make any changes or execute management commands.

## Setup and Installation

### 1. Clone the repository
```bash
git clone https://github.com/kargisimos/MasterThesis.git
cd MasterThesis
```

### 2. Configure Environment Variables
You need to set up a `.env` file in the `backend/` directory to configure the database, security keys, and admin credentials. 

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` in your editor and fill in the values. Here is a thorough example of how it should look:

```env
# Database Configuration
POSTGRES_USER=postgres
POSTGRES_PASSWORD=secure_password_here
POSTGRES_DB=network_monitor
POSTGRES_HOST=db
POSTGRES_PORT=5432

# Security & Authentication
# You can generate random strings for these keys
SECRET_KEY=9a6f8b2c4d1e5f0a7b3c2d1e9f8a7b6c5d4e3f2g1h0j9k8l7m6n5o4p3q2r1s0
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
DEVICE_CREDENTIAL_SECRET_KEY=4b3c2d1e9f8a7b6c5d4e3f2g1h0j9k8l7m6n5o4p3q2r1s0t9u8v7w6x5y4z3

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379

# Initial Admin Account
# This user will be created automatically on first startup
DEFAULT_ADMIN_EMAIL=admin@example.com
DEFAULT_ADMIN_PASSWORD=Admin123!
DEFAULT_ADMIN_FULL_NAME=System Administrator

# Email Service (Optional for alerts)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password_here
EMAIL_FROM=your_email@gmail.com
```

### 3. Build and Start the Application
The entire application is containerized with Docker. Run this command to build the images and start all services:
```bash
docker-compose up --build
```

Once the process completes:
- The **Frontend Dashboard** is accessible at `http://localhost:5173`.
- The **Backend API Documentation** (Swagger) is available at `http://localhost:8000/docs`.

**Initial Login Credentials:**
- **Email**: `admin@example.com`
- **Password**: `Admin123!`

---

## Technical Architecture
The system is built with a distributed architecture to ensure responsiveness and reliability:
- **FastAPI Backend**: Acts as the central hub. It provides a RESTful API for the frontend and manages the background monitoring loops.
- **React Frontend**: A single-page application focused on data visualization. It communicates with the backend via Axios and stays updated through a persistent WebSocket connection.
- **Monitoring Engine**: A dedicated set of asynchronous tasks that handle the polling of devices. It is designed to be non-blocking, allowing it to poll dozens of devices concurrently without affecting API performance.
- **PostgreSQL Database**: Stores persistent data including device inventory, user profiles, encrypted credentials, audit logs, and historical performance metrics.
- **Redis Broker**: Serves a dual purpose. It caches the latest metric states to calculate throughput speeds and acts as a Pub/Sub broker to broadcast live data to all connected WebSocket clients.

## Data Collection Logic
The system uses a tiered approach to data collection:
1. **ICMP**: A fast ping that determines if a device is online and measures response latency.
2. **SNMP (v2c)**: Used to collect standard MIB data from network hardware, specifically focusing on processor load and memory utilization.
3. **SSH**: When provided with credentials, the system can log into Linux-based servers or networking equipment to run low-level commands to get exact resource usage and interface statistics.

## Security Implementation
Several security measures have been implemented to protect the monitoring environment:
- **Credential Encryption**: All SSH passwords and SNMP community strings are encrypted at the database level using Fernet symmetric encryption.
- **Audit Logging**: Every management action—such as service restarts, reboots, or user updates—is logged with the timestamp and the identity of the user who performed it.
- **JWT Authentication**: Secure state-less authentication using JSON Web Tokens with automatic token expiration.
- **Password Policy**: Enforces a minimum length and complexity (uppercase, digits, special characters) for all user accounts.
- **RBAC**: Strict separation of duties between Admins, Operators, and Viewers at the API endpoint level.
