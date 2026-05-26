from celery import Celery
from config import settings

celery_app = Celery(
    "bus_alert",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["tasks.calling_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_soft_time_limit=120,
    task_time_limit=180,
    broker_connection_retry_on_startup=True,
)
