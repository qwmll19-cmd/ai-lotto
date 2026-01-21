
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import resolve_db_url, settings

db_url = resolve_db_url(settings.DB_URL)
connect_args = {"check_same_thread": False} if db_url.startswith("sqlite:///") else {}

engine = create_engine(
    db_url,
    future=True,
    echo=False,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    future=True,
)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
