import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select, delete

from database import AsyncSessionLocal
from models import DbBackup, new_uuid, utcnow

logger = logging.getLogger(__name__)
_KEEP_LAST = 7
_CHECK_INTERVAL = 6 * 60 * 60   # check every 6 hours
_BACKUP_EVERY  = 23 * 60 * 60   # backup if older than 23 hours


async def _generate_sql() -> str:
    from config import settings
    from routers.backup import _pg_dump, _sqlite_dump
    db_url = settings.async_database_url
    if "sqlite" in db_url:
        return _sqlite_dump(settings.database_url)
    return await _pg_dump(db_url)


async def run_backup(trigger: str = "auto") -> DbBackup:
    """Generate and persist a backup, pruning old ones."""
    sql = await _generate_sql()

    async with AsyncSessionLocal() as session:
        backup = DbBackup(
            id=new_uuid(),
            sql_content=sql,
            size_bytes=len(sql.encode("utf-8")),
            trigger=trigger,
            created_at=utcnow(),
        )
        session.add(backup)
        await session.flush()

        # Keep only last _KEEP_LAST
        old_ids = list(
            await session.scalars(
                select(DbBackup.id)
                .order_by(DbBackup.created_at.desc())
                .offset(_KEEP_LAST)
            )
        )
        if old_ids:
            await session.execute(delete(DbBackup).where(DbBackup.id.in_(old_ids)))

        await session.commit()
        await session.refresh(backup)
        return backup


async def backup_scheduler() -> None:
    """Background task: backup once on startup if stale, then every 6 hours."""
    await asyncio.sleep(15)  # let the app finish starting

    while True:
        try:
            async with AsyncSessionLocal() as session:
                last = await session.scalar(
                    select(DbBackup).order_by(DbBackup.created_at.desc()).limit(1)
                )
            if last is None:
                age = float("inf")
            else:
                age = (datetime.now(timezone.utc) - last.created_at).total_seconds()

            if age > _BACKUP_EVERY:
                logger.info("Auto backup starting (last: %s ago)...", f"{age/3600:.1f}h")
                b = await run_backup(trigger="auto")
                logger.info("Auto backup saved — %s KB", b.size_bytes // 1024)
            else:
                logger.info("Auto backup skipped — last was %.1fh ago", age / 3600)
        except Exception:
            logger.exception("Auto backup failed")

        await asyncio.sleep(_CHECK_INTERVAL)
