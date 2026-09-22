import os
import io
import requests
import datetime
import numpy as np
from PIL import Image
from dotenv import load_dotenv

load_dotenv()

USE_MOCK          = os.getenv('USE_MOCK_SATELLITE', 'true').lower() == 'true'
TIME_RANGE_DAYS   = int(os.getenv('SATELLITE_TIME_RANGE_DAYS', 90))
MAX_CLOUD         = int(os.getenv('MAX_CLOUD_COVERAGE', 20))
IMG_WIDTH         = int(os.getenv('SATELLITE_IMAGE_WIDTH', 512))
IMG_HEIGHT        = int(os.getenv('SATELLITE_IMAGE_HEIGHT', 512))
MAPS_API_KEY      = os.getenv('GOOGLE_MAPS_API_KEY', '')


def fetch_satellite_image(lat: float, lng: float) -> bytes:
    """
    Master function — tries GEE first, then Google Maps, then mock.

    Returns JPEG bytes of the satellite image.
    """
    if USE_MOCK:
        print('  📡 Mock mode ON — using generated image')
        return _create_mock_image(lat, lng)

    # Try GEE first (best quality)
    gee_result = _fetch_from_gee(lat, lng)
    if gee_result:
        return gee_result

    # Fallback to Google Maps Static API
    if MAPS_API_KEY:
        maps_result = _fetch_from_google_maps(lat, lng)
        if maps_result:
            return maps_result

    # Final fallback: mock image
    print('  ⚠️  All satellite sources failed — using mock')
    return _create_mock_image(lat, lng)


def _fetch_from_gee(lat: float, lng: float) -> bytes | None:
    """
    Fetches satellite imagery using Google Earth Engine Python API.

    Process:
    1. Define area of interest (bounding box around coordinates)
    2. Load Sentinel-2 or Landsat image collection
    3. Filter by date range and cloud coverage
    4. Get median composite (best cloud-free image)
    5. Select RGB bands
    6. Export as thumbnail URL
    7. Download the image

    Why median composite?
    → Takes the middle pixel value across all images in date range
    → Effectively removes clouds (clouds are bright outliers)
    → Gives clean, cloud-free view of the land
    """
    try:
        import ee
        from app.services.gee_auth import initialize_gee, is_initialized

        # Initialize GEE if not done yet
        if not is_initialized():
            success = initialize_gee()
            if not success:
                return None

        print(f'  🌍 Fetching GEE image for ({lat}, {lng})...')

        # ── 1. Define area of interest ────────────────────────────────────
        # ~1km bounding box (0.009 degrees ≈ 1km at equator)
        delta = 0.020
        region = ee.Geometry.Rectangle([
            lng - delta,   # west
            lat - delta,   # south
            lng + delta,   # east
            lat + delta,   # north
        ])

        # ── 2. Date range ─────────────────────────────────────────────────
        end_date   = datetime.date.today()
        start_date = end_date - datetime.timedelta(days=TIME_RANGE_DAYS)

        # ── 3. Try Sentinel-2 first (10m resolution, best quality) ────────
        image = _get_sentinel2_image(region, str(start_date), str(end_date))

        # ── 4. Fall back to Landsat 8/9 (30m resolution) ──────────────────
        if image is None:
            print('  ⚠️  No Sentinel-2 image found, trying Landsat...')
            image = _get_landsat_image(region, str(start_date), str(end_date))

        if image is None:
            print('  ⚠️  No GEE imagery found for this region/date range')
            return None

        # ── 5. Get thumbnail URL ──────────────────────────────────────────
        # Visualization parameters: stretch to enhance contrast
        vis_params = {
            'min':    0,
            'max':    3000,
            'bands':  ['B4', 'B3', 'B2'],   # Red, Green, Blue
            'gamma':  1.4,                   # Slight brightness boost
        }

        url = image.getThumbURL({
            **vis_params,
            'region':     region,
            'dimensions': f'{IMG_WIDTH}x{IMG_HEIGHT}',
            'format':     'jpg',
        })

        # ── 6. Download image from URL ────────────────────────────────────
        response = requests.get(url, timeout=30)
        response.raise_for_status()

        image_bytes = response.content
        print(f'  ✅ GEE image downloaded: {len(image_bytes)} bytes, '
              f'{IMG_WIDTH}x{IMG_HEIGHT}px')
        return image_bytes

    except ImportError:
        print('  ⚠️  earthengine-api not installed')
        return None
    except Exception as e:
        print(f'  ⚠️  GEE fetch failed: {e}')
        return None


def _get_sentinel2_image(region, start_date: str, end_date: str):
    """
    Gets best available Sentinel-2 image for the region.

    Sentinel-2:
    - Resolution: 10 meters per pixel
    - Revisit: every 5 days
    - Bands: B2=Blue, B3=Green, B4=Red, B8=NIR
    - Best for: Agricultural monitoring, urban mapping

    We use S2_SR_HARMONIZED (Surface Reflectance) because:
    - Corrected for atmospheric effects
    - More accurate land surface colors
    - Better for land classification
    """
    try:
        import ee

        collection = (
            ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
            .filterBounds(region)
            .filterDate(start_date, end_date)
            # Filter out cloudy images (CLOUDY_PIXEL_PERCENTAGE is metadata)
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', MAX_CLOUD))
            # Sort by cloud coverage (least cloudy first)
            .sort('CLOUDY_PIXEL_PERCENTAGE')
        )

        count = collection.size().getInfo()
        print(f'  📊 Sentinel-2 images found: {count}')

        if count == 0:
            return None

        # Use median composite for best cloud-free result
        # (or .first() for the single least-cloudy image)
        if count >= 3:
            image = collection.median()
        else:
            image = collection.first()

        return image

    except Exception as e:
        print(f'  ⚠️  Sentinel-2 error: {e}')
        return None


def _get_landsat_image(region, start_date: str, end_date: str):
    """
    Gets best available Landsat 8 or 9 image.

    Landsat:
    - Resolution: 30 meters per pixel
    - Revisit: every 16 days
    - Bands: B4=Red, B3=Green, B2=Blue
    - Good fallback when Sentinel-2 unavailable

    Uses Collection 2 Level 2 (Surface Reflectance)
    """
    try:
        import ee

        # Try Landsat 9 first (newer, better quality)
        for collection_id in ['LANDSAT/LC09/C02/T1_L2', 'LANDSAT/LC08/C02/T1_L2']:
            collection = (
                ee.ImageCollection(collection_id)
                .filterBounds(region)
                .filterDate(start_date, end_date)
                .filter(ee.Filter.lt('CLOUD_COVER', MAX_CLOUD))
                .sort('CLOUD_COVER')
            )

            count = collection.size().getInfo()
            name  = 'Landsat 9' if 'LC09' in collection_id else 'Landsat 8'
            print(f'  📊 {name} images found: {count}')

            if count > 0:
                image = collection.median() if count >= 3 else collection.first()

                # Landsat uses different band names — rename to match Sentinel-2
                image = image.select(
                    ['SR_B4', 'SR_B3', 'SR_B2'],
                    ['B4',    'B3',    'B2']
                )

                # Scale reflectance values (Landsat C2 uses different scale)
                image = image.multiply(0.0000275).add(-0.2)

                return image

        return None

    except Exception as e:
        print(f'  ⚠️  Landsat error: {e}')
        return None


def _fetch_from_google_maps(lat: float, lng: float) -> bytes | None:
    """
    Fallback: fetches satellite imagery from Google Maps Static API.

    Simpler than GEE but:
    - No time filtering
    - Less control over processing
    - Uses credits ($2/1000 requests, $200 free/month)

    Still very high quality — same imagery as Google Maps satellite view.
    """
    try:
        # Zoom 17 = ~1m per pixel resolution (good for land parcels)
        url = (
            f"https://maps.googleapis.com/maps/api/staticmap"
            f"?center={lat},{lng}"
            f"&zoom=17"
            f"&size={IMG_WIDTH}x{IMG_HEIGHT}"
            f"&maptype=satellite"
            f"&key={MAPS_API_KEY}"
        )

        print(f'  🗺️  Fetching Google Maps satellite image...')
        response = requests.get(url, timeout=15)
        response.raise_for_status()

        # Check it's actually an image (not an error response)
        if 'image' in response.headers.get('Content-Type', ''):
            print(f'  ✅ Google Maps image: {len(response.content)} bytes')
            return response.content
        else:
            print(f'  ⚠️  Google Maps returned non-image: {response.text[:100]}')
            return None

    except Exception as e:
        print(f'  ⚠️  Google Maps failed: {e}')
        return None


def get_ndvi_image(lat: float, lng: float) -> dict | None:
    """
    BONUS: Calculates NDVI (Normalized Difference Vegetation Index).

    NDVI = (NIR - Red) / (NIR + Red)
    Range: -1 to +1
    - > 0.6: Dense vegetation (forest)
    - 0.3–0.6: Moderate vegetation (crops)
    - 0.1–0.3: Sparse vegetation (grassland)
    - < 0.1: Bare soil, water, urban

    Used to enhance agricultural land detection accuracy.
    """
    try:
        import ee
        from app.services.gee_auth import initialize_gee, is_initialized

        if not is_initialized():
            if not initialize_gee():
                return None

        delta  = 0.020
        region = ee.Geometry.Rectangle([
            lng - delta, lat - delta,
            lng + delta, lat + delta
        ])

        end_date   = datetime.date.today()
        start_date = end_date - datetime.timedelta(days=TIME_RANGE_DAYS)

        collection = (
            ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
            .filterBounds(region)
            .filterDate(str(start_date), str(end_date))
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', MAX_CLOUD))
            .median()
        )

        # Calculate NDVI
        ndvi = collection.normalizedDifference(['B8', 'B4']).rename('NDVI')

        # Get mean NDVI for the region
        mean_ndvi = ndvi.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=region,
            scale=10,     # 10m resolution
            maxPixels=1e9
        ).getInfo()

        ndvi_value = mean_ndvi.get('NDVI', 0)

        # Classify vegetation level
        if ndvi_value > 0.6:
            vegetation_level = 'dense'
            likely_type = 'forest'
        elif ndvi_value > 0.3:
            vegetation_level = 'moderate'
            likely_type = 'agricultural'
        elif ndvi_value > 0.1:
            vegetation_level = 'sparse'
            likely_type = 'wasteland'
        else:
            vegetation_level = 'minimal'
            likely_type = 'residential_or_commercial'

        return {
            'ndvi':             round(float(ndvi_value), 4),
            'vegetation_level': vegetation_level,
            'likely_land_type': likely_type,
        }

    except Exception as e:
        print(f'  ⚠️  NDVI calculation failed: {e}')
        return None


def _create_mock_image(lat: float, lng: float) -> bytes:
    """
    Creates a realistic mock satellite image for development.
    Generates texture that looks like aerial imagery.
    """
    img_array = np.zeros((IMG_HEIGHT, IMG_WIDTH, 3), dtype=np.uint8)

    # Seed based on coordinates for consistent results
    seed = int(abs(lat * 1000 + lng * 100)) % (2**31)
    rng  = np.random.RandomState(seed)

    # Base colors for different land types based on location
    if 6 <= lat <= 37 and 68 <= lng <= 97:
        # India: mixed agricultural/urban
        base = rng.randint([80, 90, 40], [140, 150, 80], dtype=np.uint8)
    elif lat > 50:
        # Northern Europe: forest/snow
        base = rng.randint([60, 100, 60], [120, 160, 100], dtype=np.uint8)
    else:
        # Generic
        base = rng.randint([70, 80, 40], [130, 140, 80], dtype=np.uint8)

    # Fill with noisy base color
    img_array[:, :, 0] = np.clip(base[0] + rng.randint(-20, 20, (IMG_HEIGHT, IMG_WIDTH)), 0, 255)
    img_array[:, :, 1] = np.clip(base[1] + rng.randint(-20, 20, (IMG_HEIGHT, IMG_WIDTH)), 0, 255)
    img_array[:, :, 2] = np.clip(base[2] + rng.randint(-20, 20, (IMG_HEIGHT, IMG_WIDTH)), 0, 255)

    # Add field patterns (simulate agricultural plots)
    num_fields = rng.randint(4, 10)
    for _ in range(num_fields):
        x1 = rng.randint(0, IMG_WIDTH  - 60)
        y1 = rng.randint(0, IMG_HEIGHT - 60)
        x2 = x1 + rng.randint(40, 120)
        y2 = y1 + rng.randint(40, 120)
        x2 = min(x2, IMG_WIDTH)
        y2 = min(y2, IMG_HEIGHT)
        field_color = [
            rng.randint(60, 160),
            rng.randint(80, 180),
            rng.randint(20, 80),
        ]
        img_array[y1:y2, x1:x2] = field_color

    # Add a few "road" lines
    for _ in range(rng.randint(1, 3)):
        y = rng.randint(0, IMG_HEIGHT)
        img_array[y:y+3, :] = [180, 170, 150]

    img  = Image.fromarray(img_array)
    buf  = io.BytesIO()
    img.save(buf, format='JPEG', quality=85)
    return buf.getvalue()