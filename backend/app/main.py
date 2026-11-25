from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    from .seed import seed_if_needed

    seed_if_needed()
    from .services.alert_service import refresh_all_alerts
    from .database import get_session

    refresh_all_alerts(get_session())
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Hospital / pharmacy medicine shortage tracking and alert system.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from .routes import (  # noqa: E402
    alerts,
    auth,
    dashboard,
    expiry,
    medicines,
    notifications,
    prediction,
    reports,
    restock,
    search,
    settings as settings_routes,
    stock,
    suppliers,
)


@app.get("/", tags=["health"])
def root():
    return {"app": settings.APP_NAME, "version": settings.APP_VERSION, "status": "running"}


@app.get("/api/health", tags=["health"])
def api_health():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(medicines.router)
app.include_router(stock.router)
app.include_router(alerts.router)
app.include_router(expiry.router)
app.include_router(prediction.router)
app.include_router(suppliers.router)
app.include_router(reports.router)
app.include_router(notifications.router)
app.include_router(search.router)
app.include_router(restock.router)
app.include_router(settings_routes.router)
