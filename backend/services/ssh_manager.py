import asyncio
import paramiko

def execute_ssh_command(ip: str, username: str, password: str, command: str, timeout: int = 10):
    """Executes an SSH command and returns stdout and stderr."""
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(ip, username=username, password=password, timeout=timeout)
        
        stdin, stdout, stderr = client.exec_command(command, timeout=timeout)
        out = stdout.read().decode('utf-8').strip()
        err = stderr.read().decode('utf-8').strip()
        
        client.close()
        return out, err
    except Exception as e:
        return "", str(e)

async def get_running_services(ip: str, username: str, password: str) -> list[dict]:
    """Fetches a list of running systemd services."""
    out, err = await asyncio.to_thread(
        execute_ssh_command, ip, username, password, 
        "systemctl list-units --type=service --state=running --no-pager --no-legend"
    )
    
    if err and not out:
        raise Exception(f"Failed to fetch services: {err}")
        
    services = []
    for line in out.splitlines():
        parts = line.split()
        if len(parts) >= 4:
            service_name = parts[0]
            description = " ".join(parts[4:]) if len(parts) > 4 else ""
            services.append({
                "name": service_name,
                "status": parts[3],
                "description": description
            })
    return services

async def restart_service(ip: str, username: str, password: str, service_name: str) -> bool:
    """Restarts a specific systemd service."""
    command = f"sudo systemctl restart {service_name}"
    out, err = await asyncio.to_thread(execute_ssh_command, ip, username, password, command)
    
    if err and "timeout" not in err.lower(): 
        raise Exception(f"Service restart failed: {err}")
    return True

async def reboot_device(ip: str, username: str, password: str) -> bool:
    """Initiates a device reboot."""
    command = "sudo reboot"
    out, err = await asyncio.to_thread(execute_ssh_command, ip, username, password, command, timeout=5)
    
    return True
