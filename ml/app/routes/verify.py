from flask import Blueprint, request, jsonify
import base64
import traceback
import os

from app.services.gee_satellite import fetch_satellite_image, get_ndvi_image
from app.services.model          import classify_land
from app.services.scorer         import calculate_verification_score

verify_bp = Blueprint('verify', __name__)


@verify_bp.route('/verify', methods=['POST'])
def verify_land():
    """
    Main verification endpoint.

    Request body:
    {
        "parcel_id":         "mongodb_id",
        "lat":               18.5204,
        "lng":               73.8567,
        "claimed_land_type": "agricultural",
        "area_sq_meters":    10000
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body required'}), 400

        parcel_id    = data.get('parcel_id', 'unknown')
        lat          = data.get('lat')
        lng          = data.get('lng')
        claimed_type = data.get('claimed_land_type', 'agricultural')
        area         = data.get('area_sq_meters', None)

        if lat is None or lng is None:
            return jsonify({'error': 'lat and lng are required'}), 400

        lat = float(lat)
        lng = float(lng)

        if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
            return jsonify({'error': 'Invalid coordinates'}), 400

        print(f'\n🛰️  Verifying parcel: {parcel_id}')
        print(f'   Coordinates: ({lat}, {lng})')
        print(f'   Claimed type: {claimed_type}')

        # ── Step 1: Fetch satellite image from GEE ────────────────────────
        print('\n  Step 1: Fetching satellite image (GEE)...')
        image_bytes = fetch_satellite_image(lat, lng)

        # ── Step 2: Get NDVI score for vegetation analysis ─────────────────
        print('\n  Step 2: Calculating NDVI...')
        ndvi_data = None
        if os.getenv('USE_MOCK_SATELLITE', 'true').lower() == 'false':
            ndvi_data = get_ndvi_image(lat, lng)
            if ndvi_data:
                print(f'  ✅ NDVI: {ndvi_data["ndvi"]} ({ndvi_data["vegetation_level"]})')

        # ── Step 3: Run ML classification ────────────────────────────────
        print('\n  Step 3: Running CNN classification...')
        classification = classify_land(image_bytes)
        print(f'  ✅ Detected: {classification["detected_land_type"]} '
              f'(confidence: {classification["confidence"]:.2f})')

        # If NDVI suggests a different type, boost that score
        if ndvi_data and ndvi_data.get('likely_land_type'):
            _boost_ndvi_type(classification, ndvi_data['likely_land_type'])

        # ── Step 4: Calculate verification score ──────────────────────────
        print('\n  Step 4: Calculating verification score...')
        result = calculate_verification_score(
            classification_result=classification,
            claimed_land_type=claimed_type,
            area_sq_meters=area,
            ndvi_data=ndvi_data,
        )
        print(f'  ✅ Score: {result["score"]}/100 → {result["status"]}')

        # ── Step 5: Build response ────────────────────────────────────────
        image_b64           = base64.b64encode(image_bytes).decode('utf-8')
        satellite_image_url = f'data:image/jpeg;base64,{image_b64}'

        response_data = {
            'parcel_id':             parcel_id,
            'score':                 result['score'],
            'status':                result['status'],
            'detected_land_type':    result['detected_land_type'],
            'claimed_land_type':     result['claimed_land_type'],
            'type_match':            result['type_match'],
            'confidence':            result['confidence'],
            'encroachment_detected': result['encroachment_detected'],
            'boundary_mismatch':     result['boundary_mismatch'],
            'satellite_image_url':   satellite_image_url,
            'score_breakdown':       result['score_breakdown'],
            'ndvi':                  ndvi_data,
            'data_source':           'google_earth_engine' if not USE_MOCK else 'mock',
            'used_mock_satellite':   os.getenv('USE_MOCK_SATELLITE','true').lower() == 'true',
            'used_mock_model':       classification.get('used_mock', False),
        }

        print(f'\n✅ Verification complete — Score: {result["score"]}')
        return jsonify(response_data), 200

    except Exception as e:
        print(f'❌ Error: {traceback.format_exc()}')
        return jsonify({'error': 'Verification failed', 'detail': str(e)}), 500


def _boost_ndvi_type(classification: dict, ndvi_land_type: str):
    """
    If NDVI strongly suggests a land type, boost its confidence score.
    NDVI is more accurate than RGB-based CNN for vegetation detection.
    """
    if ndvi_land_type in classification.get('all_scores', {}):
        old = classification['all_scores'][ndvi_land_type]
        # Blend: 70% CNN + 30% NDVI signal
        classification['all_scores'][ndvi_land_type] = round(
            old * 0.7 + 0.3, 4
        )
        # Update detected type if NDVI type is now highest
        best = max(classification['all_scores'], key=classification['all_scores'].get)
        if best != classification['detected_land_type']:
            classification['detected_land_type'] = best
            classification['confidence'] = classification['all_scores'][best]


USE_MOCK = os.getenv('USE_MOCK_SATELLITE', 'true').lower() == 'true'


@verify_bp.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status':       'ML Service running ✅',
        'version':      '1.0.0',
        'data_source':  'Google Earth Engine',
        'mock_mode':    USE_MOCK,
    }), 200


@verify_bp.route('/test-image', methods=['GET'])
def test_image():
    """Test: GET /test-image?lat=18.5&lng=73.8"""
    lat = float(request.args.get('lat', 20.5937))
    lng = float(request.args.get('lng', 78.9629))
    image_bytes = fetch_satellite_image(lat, lng)
    image_b64   = base64.b64encode(image_bytes).decode('utf-8')
    return jsonify({
        'satellite_image_url': f'data:image/jpeg;base64,{image_b64}',
        'lat': lat, 'lng': lng,
        'source': 'GEE' if not USE_MOCK else 'mock',
    }), 200


@verify_bp.route('/ndvi', methods=['GET'])
def ndvi():
    """Test NDVI: GET /ndvi?lat=18.5&lng=73.8"""
    lat  = float(request.args.get('lat', 20.5937))
    lng  = float(request.args.get('lng', 78.9629))
    data = get_ndvi_image(lat, lng)
    return jsonify(data or {'error': 'NDVI not available'}), 200