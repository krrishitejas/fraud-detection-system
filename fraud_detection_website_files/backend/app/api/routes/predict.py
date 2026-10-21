import io
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, UploadFile, File, Query, status
from fastapi.responses import StreamingResponse
import pandas as pd

from app.core.config import settings
from app.utils.logging_config import get_logger
from app.schemas.prediction import (
    SinglePredictionRequest,
    PredictionResult,
    BatchPredictionRequest,
    BatchPredictionResponse,
)
from app.services.model_service import ModelService
from app.services.preprocessing_service import PreprocessingService, PreprocessingValidationError

logger = get_logger(__name__)
router = APIRouter(tags=["Prediction"])


@router.post("/predict", response_model=PredictionResult, summary="Predict fraud for a single transaction")
def predict_single_transaction(request: SinglePredictionRequest):
    """
    Evaluates fraud risk for a single transaction given 32 features.
    Missing features are imputed using training set medians.
    Computes local TreeSHAP feature contributions if requested.
    """
    model_service = ModelService.get_instance()
    if not model_service.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Prediction service unavailable: {model_service.load_error or 'Model not initialized.'}"
        )

    try:
        result = model_service.predict_single(
            features=request.features,
            include_explanation=request.include_explanation
        )
        return result
    except PreprocessingValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error(f"Prediction failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Prediction processing failed.")


@router.post("/predict/batch", response_model=BatchPredictionResponse, summary="Predict fraud for multiple transactions")
def predict_batch_transactions(request: BatchPredictionRequest):
    """
    Evaluates fraud risk across a batch of transactions.
    Enforces maximum batch limit (default 1000).
    """
    model_service = ModelService.get_instance()
    if not model_service.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Prediction service unavailable: {model_service.load_error or 'Model not initialized.'}"
        )

    if len(request.transactions) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Transaction batch is empty.")

    if len(request.transactions) > settings.MAX_BATCH_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Batch size of {len(request.transactions)} exceeds maximum allowed limit of {settings.MAX_BATCH_SIZE}."
        )

    try:
        response = model_service.predict_batch(
            batch=request.transactions,
            include_explanations=request.include_explanations
        )
        return response
    except PreprocessingValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error(f"Batch prediction failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Batch prediction failed.")


@router.post("/predict/csv", summary="Upload CSV file for batch transaction scoring")
async def predict_csv(
    file: UploadFile = File(..., description="CSV file containing the 32 transaction feature columns"),
    as_csv: bool = Query(default=False, description="If True, returns an annotated downloadable CSV file")
):
    """
    Accepts an uploaded CSV file with the 32 model feature columns.
    Validates column presence and numeric values, then performs batch prediction.
    Never executes uploaded file contents.
    """
    model_service = ModelService.get_instance()
    if not model_service.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Prediction service unavailable: {model_service.load_error or 'Model not initialized.'}"
        )

    # 1. Validate file extension
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Please upload a valid .csv file."
        )

    # 2. Check file size limit
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    content = await file.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB}MB."
        )

    # 3. Parse CSV safely
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to parse CSV file: {str(e)}"
        )

    if len(df) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded CSV contains zero rows.")

    if len(df) > settings.MAX_CSV_ROWS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Uploaded CSV has {len(df)} rows, exceeding maximum limit of {settings.MAX_CSV_ROWS} rows."
        )

    # 4. Validate preprocessing and transform
    prep_service = PreprocessingService.get_instance()
    try:
        scaled_matrix, sanitized_df = prep_service.transform_dataframe(df)
    except PreprocessingValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    # 5. Predict
    probs = model_service.classifier.predict_proba(scaled_matrix)
    fraud_probs = [round(float(p[1]), 4) for p in probs]
    predictions = ["fraud" if p >= settings.DECISION_THRESHOLD else "legitimate" for p in fraud_probs]
    risk_categories = [model_service.determine_risk_category(p) for p in fraud_probs]

    if as_csv:
        # Append prediction columns to original DataFrame
        output_df = df.copy()
        output_df["model_fraud_probability"] = fraud_probs
        output_df["model_prediction"] = predictions
        output_df["risk_category"] = risk_categories

        stream = io.StringIO()
        output_df.to_csv(stream, index=False)
        response = StreamingResponse(
            iter([stream.getvalue()]),
            media_type="text/csv"
        )
        response.headers["Content-Disposition"] = f"attachment; filename=scored_{file.filename}"
        return response

    # Return structured JSON summary and results
    records = []
    fraud_cnt = 0
    legit_cnt = 0
    for i in range(len(df)):
        is_f = predictions[i] == "fraud"
        if is_f:
            fraud_cnt += 1
        else:
            legit_cnt += 1

        records.append({
            "row_index": i,
            "prediction": predictions[i],
            "fraud_probability": fraud_probs[i],
            "risk_category": risk_categories[i]
        })

    return {
        "filename": file.filename,
        "total_rows_scored": len(df),
        "fraud_count": fraud_cnt,
        "legitimate_count": legit_cnt,
        "fraud_rate": round(fraud_cnt / len(df), 4),
        "decision_threshold": settings.DECISION_THRESHOLD,
        "predictions": records
    }


@router.get("/model/sample-transaction", summary="Get a valid sample transaction payload")
def get_sample_transaction() -> Dict[str, Any]:
    """
    Returns a sample transaction with median baseline feature values
    that can be copied directly into prediction requests.
    """
    prep = PreprocessingService.get_instance()
    try:
        sample_features = prep.get_default_sample_dict()
        return {
            "features": sample_features,
            "include_explanation": True,
            "feature_count": len(sample_features),
            "note": "Pre-filled with training set median values. Modify specific fields to test scenarios."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
