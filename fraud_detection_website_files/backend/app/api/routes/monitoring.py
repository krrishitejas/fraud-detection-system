from fastapi import APIRouter
from app.schemas.prediction import DriftMonitoringResponse
from app.services.drift_service import DriftService

router = APIRouter(prefix="/monitoring", tags=["Monitoring"])


@router.get("/drift", response_model=DriftMonitoringResponse, summary="Get historical concept drift and PSI summaries")
def get_drift_monitoring():
    """
    Returns Population Stability Index (PSI) summaries across 5 chronological blocks.
    Compares covariate shifts with and without the temporal feature (TransactionDT).
    """
    service = DriftService.get_instance()
    return service.get_drift_summary()
