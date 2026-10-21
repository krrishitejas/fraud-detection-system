from fastapi import APIRouter
from app.schemas.prediction import ModelInfoResponse
from app.services.research_service import ResearchService

router = APIRouter(prefix="/model", tags=["Model & Research"])


@router.get("/info", response_model=ModelInfoResponse, summary="Get research summary and model benchmark comparisons")
def get_model_info():
    """
    Returns research summary, model validation comparisons, and sequential
    adaptation results comparing fixed and retrained models under concept drift.
    """
    service = ResearchService.get_instance()
    return service.get_research_info()
