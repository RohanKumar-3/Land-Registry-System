import os

VERIFIED_THRESHOLD = int(os.getenv('VERIFIED_THRESHOLD', 70))
FLAGGED_THRESHOLD  = int(os.getenv('FLAGGED_THRESHOLD', 40))


def calculate_verification_score(
    classification_result: dict,
    claimed_land_type:     str,
    area_sq_meters:        float = None,
    ndvi_data:             dict  = None,    # ← NEW
) -> dict:
    """
    Converts ML output + NDVI into a 0-100 verification score.

    Score breakdown:
    Base:            50 pts
    Type match:    + 0-30 pts
    Confidence:    + 0-20 pts
    NDVI bonus:    + 0-10 pts  (NEW — rewards accurate vegetation data)
    Penalties:     - 0-30 pts
    """
    detected_type = classification_result.get('detected_land_type', '')
    confidence    = classification_result.get('confidence', 0.0)
    all_scores    = classification_result.get('all_scores', {})

    score = 50

    # ── Type match ────────────────────────────────────────────────────────
    type_bonus = 0
    if detected_type == claimed_land_type:
        type_bonus = 30
    elif _are_similar_types(detected_type, claimed_land_type):
        type_bonus = 15
    score += type_bonus

    # ── Confidence bonus ──────────────────────────────────────────────────
    confidence_bonus = round(confidence * 20)
    score += confidence_bonus

    # ── NDVI bonus (NEW) ─────────────────────────────────────────────────
    ndvi_bonus = 0
    if ndvi_data:
        ndvi_likely = ndvi_data.get('likely_land_type', '')
        # If NDVI agrees with claimed type → small bonus
        if claimed_land_type in ndvi_likely or ndvi_likely == claimed_land_type:
            ndvi_bonus = 10
            score += ndvi_bonus
        # If NDVI disagrees strongly → small penalty
        elif ndvi_likely and not _are_similar_types(claimed_land_type, ndvi_likely):
            score -= 5

    # ── Encroachment detection ─────────────────────────────────────────────
    encroachment_detected = False
    if claimed_land_type == 'agricultural':
        if all_scores.get('residential', 0) + all_scores.get('commercial', 0) > 0.40:
            encroachment_detected = True
            score -= 25
        # Also check NDVI — low NDVI on claimed agricultural = suspicious
        if ndvi_data and ndvi_data.get('ndvi', 1) < 0.1:
            encroachment_detected = True
            score -= 10

    elif claimed_land_type == 'forest':
        if all_scores.get('agricultural', 0) + all_scores.get('wasteland', 0) > 0.50:
            encroachment_detected = True
            score -= 20
        # Low NDVI on claimed forest = deforestation
        if ndvi_data and ndvi_data.get('ndvi', 1) < 0.3:
            encroachment_detected = True
            score -= 15

    elif claimed_land_type == 'residential':
        if all_scores.get('industrial', 0) > 0.35:
            encroachment_detected = True
            score -= 15

    # ── Low confidence penalty ─────────────────────────────────────────────
    if confidence < 0.3:
        score -= 10

    # ── Boundary mismatch ─────────────────────────────────────────────────
    boundary_mismatch = False
    if confidence < 0.2 and type_bonus == 0:
        boundary_mismatch = True
        score -= 10

    # ── Clamp 0-100 ───────────────────────────────────────────────────────
    score = max(0, min(100, score))

    # ── Status ────────────────────────────────────────────────────────────
    if score >= VERIFIED_THRESHOLD:
        status = 'verified'
    elif score >= FLAGGED_THRESHOLD:
        status = 'pending'
    else:
        status = 'flagged'

    return {
        'score':                 score,
        'status':                status,
        'detected_land_type':    detected_type,
        'claimed_land_type':     claimed_land_type,
        'type_match':            detected_type == claimed_land_type,
        'confidence':            round(confidence, 4),
        'encroachment_detected': encroachment_detected,
        'boundary_mismatch':     boundary_mismatch,
        'score_breakdown': {
            'base':             50,
            'type_bonus':       type_bonus,
            'confidence_bonus': confidence_bonus,
            'ndvi_bonus':       ndvi_bonus,
            'penalties': max(0, 50 + type_bonus + confidence_bonus + ndvi_bonus - score),
        }
    }


def _are_similar_types(a: str, b: str) -> bool:
    rural = {'agricultural', 'forest', 'wasteland'}
    urban = {'residential', 'commercial', 'industrial'}
    return (a in rural and b in rural) or (a in urban and b in urban)