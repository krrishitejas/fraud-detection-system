import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError

from app.core.config import settings
from app.utils.logging_config import setup_logging, get_logger
from app.api.routes import (health, predict, explainability, monitoring, model_info,
                            model_predict)
from app.services.preprocessing_service import PreprocessingService
from app.services.model_service import ModelService
from app.services.explainability_service import ExplainabilityService
from app.services.drift_service import DriftService
from app.services.research_service import ResearchService
from app.services.registry_service import ServingRegistry
from app.services.store_service import StoreService

setup_logging()
logger = get_logger("app.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan: loads models and metadata once on startup,
    releasing or cleaning resources on shutdown.
    """
    logger.info("Starting up FastAPI application...")
    logger.info(f"Artifacts Directory: {settings.ARTIFACTS_DIR}")

    # Initialize services
    PreprocessingService.get_instance()
    model = ModelService.get_instance()
    ExplainabilityService.get_instance()
    DriftService.get_instance()
    ResearchService.get_instance()

    # The serving bundle and the decision store behind POST /api/model/predict.
    registry = ServingRegistry.get_instance()
    store = StoreService.get_instance()
    if registry.is_loaded:
        logger.info(
            "Contract endpoint ready: model %s, preprocessing %s, threshold %.6f "
            "on the %s scale, %d active rules, store %s.",
            registry.model_version, registry.preprocessing_version,
            registry.threshold, registry.score_scale, len(registry.rules),
            "on" if store.enabled else "off")
    else:
        logger.warning("Contract endpoint degraded: %s", registry.load_error)

    if model.is_loaded:
        logger.info(
            f"Ready: Model loaded with {model.num_features} features, "
            f"{model.num_trees} boosting rounds."
        )
    else:
        logger.warning(f"Startup warning: {model.load_error}")

    yield

    logger.info("Shutting down FastAPI application...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "Academic Major Project: An Explainable Dynamic Graph Learning Framework "
        "for Adaptive Financial Fraud Detection under Concept Drift. "
        "Production-grade FastAPI backend integrating the trained 32-feature XGBoost model, "
        "TreeSHAP explainability, and historical concept drift monitoring."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS
origins = settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers to prevent leaking sensitive server details
def _serialisable(value):
    """Pydantic puts the original exception object into a validation error's `ctx`,
    and an exception is not JSON. Returning errors() straight to the client therefore
    crashed the encoder and turned a 422 into a 500 -- so a caller who sent a bad
    field was told the server had broken, which is both wrong and unhelpful. Anything
    that is not a plain JSON type is rendered as its text here."""
    if isinstance(value, dict):
        return {k: _serialisable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_serialisable(v) for v in value]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = _serialisable(exc.errors())
    # The contract endpoint has its own error envelope, documented in the Week 4
    # interface contract, and a caller written against that contract should not get
    # a different shape back depending on which layer rejected the request.
    if request.url.path.endswith("/model/predict"):
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"error": {
                "code": "VALIDATION_FAILED",
                "message": "Request failed schema validation.",
                "details": [
                    {"field": ".".join(str(p) for p in e.get("loc", ())[1:]) or None,
                     "issue": e.get("msg", "invalid value")}
                    for e in errors
                ],
                "request_id": request.headers.get("X-Request-Id") or str(uuid.uuid4()),
            }},
        )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Request validation error", "errors": errors},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.url.path}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please verify your input."},
    )


# Register API Routers under /api
app.include_router(health.router, prefix="/api")
app.include_router(predict.router, prefix="/api")
app.include_router(explainability.router, prefix="/api")
app.include_router(monitoring.router, prefix="/api")
app.include_router(model_info.router, prefix="/api")
app.include_router(model_predict.router, prefix="/api")


# Static Frontend Delivery (Vite production build)
static_dir = Path(__file__).resolve().parent / "static"
if static_dir.exists():
    assets_dir = static_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

    @app.get("/", include_in_schema=False)
    async def serve_index():
        index_file = static_dir / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        return {"message": f"{settings.PROJECT_NAME} API running. Visit /docs for Swagger UI."}
else:
    @app.get("/", include_in_schema=False)
    async def serve_root():
        return {
            "project": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "status": "online",
            "docs_url": "/docs",
            "api_health": "/api/health",
        }
