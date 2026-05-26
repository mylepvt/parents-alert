"""
Run once to create initial admin user:
  python create_admin.py
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import AsyncSessionLocal, create_tables
from models import User, UserRole
from auth import hash_password


async def main():
    await create_tables()

    # Non-interactive mode: AUTO_ADMIN_USER / AUTO_ADMIN_PASS env vars
    auto_user = os.environ.get("AUTO_ADMIN_USER", "")
    auto_pass = os.environ.get("AUTO_ADMIN_PASS", "")

    if auto_user and auto_pass:
        username, password = auto_user, auto_pass
    else:
        username = input("Admin username [admin]: ").strip() or "admin"
        password = input("Admin password [admin123]: ").strip() or "admin123"

    async with AsyncSessionLocal() as db:
        from sqlalchemy import select
        existing = await db.execute(select(User).where(User.username == username))
        if existing.scalar_one_or_none():
            print(f"User '{username}' already exists — skipping")
            return

        user = User(
            username=username,
            hashed_password=hash_password(password),
            role=UserRole.admin,
        )
        db.add(user)
        await db.commit()
        print(f"Admin user '{username}' created (password: {password})")


if __name__ == "__main__":
    asyncio.run(main())
