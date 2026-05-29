from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from config import settings


engine = create_async_engine(
    settings.async_database_url,
    echo=settings.environment == "development",
    pool_pre_ping=True,
    pool_recycle=300,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_tables():
    async with engine.begin() as conn:
        from models import Base as ModelBase
        await conn.run_sync(ModelBase.metadata.create_all)
        from sqlalchemy import text
        for stmt in [
            "ALTER TABLE parents ADD COLUMN IF NOT EXISTS opted_out BOOLEAN DEFAULT FALSE",
            "ALTER TABLE call_campaigns ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE",
            """CREATE TABLE IF NOT EXISTS db_backups (
                id VARCHAR(36) PRIMARY KEY,
                trigger VARCHAR(10) DEFAULT 'auto',
                size_bytes INTEGER DEFAULT 0,
                sql_content TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )""",
        ]:
            try:
                await conn.execute(text(stmt))
            except Exception:
                pass
