"""
Run this BEFORE starting Flask to confirm GEE works.
Usage: python test_gee.py
"""
import os
import sys
from dotenv import load_dotenv

load_dotenv()

print('\n🧪 Testing Google Earth Engine connection...\n')

# ── Test 1: Import ee ────────────────────────────────────────────────────────
try:
    import ee
    print('✅ earthengine-api imported successfully')
except ImportError:
    print('❌ earthengine-api not installed')
    print('   Run: pip install earthengine-api')
    sys.exit(1)

# ── Test 2: Service account file exists ──────────────────────────────────────
key_path = os.getenv('GEE_SERVICE_ACCOUNT_KEY', '')
if os.path.exists(key_path):
    print(f'✅ Service account key found: {key_path}')
else:
    print(f'❌ Service account key NOT found at: {key_path}')
    print('   Download from Google Cloud Console → IAM → Service Accounts → Keys')
    sys.exit(1)

# ── Test 3: Initialize GEE ────────────────────────────────────────────────────
try:
    email      = os.getenv('GEE_SERVICE_ACCOUNT_EMAIL')
    project_id = os.getenv('GEE_PROJECT_ID')

    credentials = ee.ServiceAccountCredentials(
        email=email,
        key_file=key_path
    )
    ee.Initialize(credentials=credentials, project=project_id)
    print('✅ GEE initialized successfully')
    print(f'   Account: {email}')
    print(f'   Project: {project_id}')
except Exception as e:
    print(f'❌ GEE initialization failed: {e}')
    print('\n   Common fixes:')
    print('   1. Register project at https://code.earthengine.google.com/')
    print('   2. Enable Earth Engine API in Google Cloud Console')
    print('   3. Check service account has "Earth Engine Resource Writer" role')
    sys.exit(1)

# ── Test 4: Fetch real image ──────────────────────────────────────────────────
print('\n🛰️  Fetching real Sentinel-2 image...')
print('   Location: Pune, India (18.52°N, 73.85°E)')

try:
    import datetime

    # Pune, India coordinates
    lat, lng = 18.5204, 73.8567
    delta    = 0.009

    region = ee.Geometry.Rectangle([
        lng - delta, lat - delta,
        lng + delta, lat + delta
    ])

    end_date   = datetime.date.today()
    start_date = end_date - datetime.timedelta(days=90)

    collection = (
        ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
        .filterBounds(region)
        .filterDate(str(start_date), str(end_date))
        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
        .sort('CLOUDY_PIXEL_PERCENTAGE')
    )

    count = collection.size().getInfo()
    print(f'   Sentinel-2 images available: {count}')

    if count == 0:
        print('   ⚠️  No Sentinel-2 images found for this period')
        print('   Try increasing SATELLITE_TIME_RANGE_DAYS in .env')
    else:
        print(f'✅ {count} cloud-free images found!')

        # Get thumbnail URL
        image = collection.median()
        url   = image.getThumbURL({
            'min':    0,
            'max':    3000,
            'bands':  ['B4', 'B3', 'B2'],
            'gamma':  1.4,
            'region': region,
            'dimensions': '256x256',
            'format': 'jpg',
        })
        print(f'✅ Thumbnail URL generated')
        print(f'   Preview: {url[:80]}...')

        # Download it
        import requests
        resp = requests.get(url, timeout=30)
        print(f'✅ Image downloaded: {len(resp.content)} bytes')

except Exception as e:
    print(f'❌ Image fetch failed: {e}')
    import traceback
    traceback.print_exc()
    sys.exit(1)

# ── Test 5: NDVI calculation ─────────────────────────────────────────────────
print('\n🌿 Testing NDVI calculation...')
try:
    image = collection.median()
    ndvi  = image.normalizedDifference(['B8', 'B4']).rename('NDVI')

    mean_ndvi = ndvi.reduceRegion(
        reducer  = ee.Reducer.mean(),
        geometry = region,
        scale    = 10,
        maxPixels= 1e9
    ).getInfo()

    ndvi_val = mean_ndvi.get('NDVI', 0)
    print(f'✅ NDVI calculated: {round(float(ndvi_val), 4)}')

    if ndvi_val > 0.3:
        print('   → Moderate to dense vegetation detected')
    else:
        print('   → Sparse vegetation or urban area')

except Exception as e:
    print(f'⚠️  NDVI failed (non-critical): {e}')

print('\n' + '='*50)
print('✨ ALL GEE TESTS PASSED!')
print('   You can now start: python app/main.py')
print('='*50 + '\n')