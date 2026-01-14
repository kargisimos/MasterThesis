import json
import asyncio
import redis
from typing import Optional
from services.websocket_manager import manager


class RedisService:
    """Manages Redis pub/sub connections for real-time device updates"""
    
    def __init__(self, host: str = "redis", port: int = 6379):
        self.host = host
        self.port = port
        self.redis_client: Optional[redis.Redis] = None
        self.pubsub = None
        self.channel_name = "device_updates"
        
    def connect(self):
        """Establish Redis connection"""
        try:
            self.redis_client = redis.Redis(
                host=self.host,
                port=self.port,
                decode_responses=True
            )
            # Test connection
            self.redis_client.ping()
            print(f"Redis connected at {self.host}:{self.port}")
        except Exception as e:
            print(f"Redis connection failed: {e}")
            raise
    
    def disconnect(self):
        """Close Redis connection"""
        if self.pubsub:
            self.pubsub.unsubscribe(self.channel_name)
            self.pubsub.close()
        if self.redis_client:
            self.redis_client.close()
        print("Redis disconnected")
    
    async def publish_device_update(self, device_data: dict):
        """Publish device metric update to Redis channel"""
        try:
            if not self.redis_client:
                self.connect()
            
            message = json.dumps({
                "type": "device_update",
                "device": device_data
            })
            
            # Run in executor to avoid blocking
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None, 
                self.redis_client.publish, 
                self.channel_name, 
                message
            )
            print(f"Published update for device {device_data.get('name', 'unknown')} to Redis")
        except Exception as e:
            print(f"Redis publish error: {e}")
    
    async def subscribe_and_forward(self):
        """Subscribe to Redis channel and forward messages to WebSocket clients"""
        try:
            if not self.redis_client:
                self.connect()
            
            self.pubsub = self.redis_client.pubsub()
            self.pubsub.subscribe(self.channel_name)
            print(f"Redis subscriber listening on channel '{self.channel_name}'")
            
            # Listen for messages in a non-blocking way
            while True:
                try:
                    # Run get_message in executor to avoid blocking
                    loop = asyncio.get_event_loop()
                    message = await loop.run_in_executor(
                        None,
                        self.pubsub.get_message,
                        True,  # ignore_subscribe_messages
                        0.1    # timeout
                    )
                    
                    if message and message["type"] == "message":
                        try:
                            data = json.loads(message["data"])
                            await manager.broadcast(data)
                            print(f"Forwarded update to {len(manager.active_connections)} WebSocket client(s)")
                        except json.JSONDecodeError as e:
                            print(f"Invalid JSON in Redis message: {e}")
                        except Exception as e:
                            print(f"Error forwarding to WebSocket: {e}")
                    
                    # Small delay to prevent CPU spinning
                    await asyncio.sleep(0.01)
                    
                except Exception as e:
                    print(f"Error in message loop: {e}")
                    await asyncio.sleep(1)
                    
        except asyncio.CancelledError:
            print("Redis subscriber task cancelled")
            raise
        except Exception as e:
            print(f"Redis subscriber error: {e}")
            # Attempt reconnection after delay
            await asyncio.sleep(5)
            await self.subscribe_and_forward()


# Global Redis service instance
redis_service = RedisService()
