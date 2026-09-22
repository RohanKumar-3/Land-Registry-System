import os
import ee
from dotenv import load_dotenv

load_dotenv()

_initialized = False


def initialize_gee():
    """
    Authenticates and initializes Google Earth Engine.

    Two authentication methods:
    1. Service Account (production) — uses JSON key file
       Best for servers, no browser needed
    2. Interactive auth (development) — opens browser once
       Stores credentials locally after first login

    We try Service Account first, fall back to interactive.
    """
    global _initialized

    if _initialized:
        return True

    key_path     = os.getenv('GEE_SERVICE_ACCOUNT_KEY', '')
    account_email = os.getenv('GEE_SERVICE_ACCOUNT_EMAIL', '')
    project_id   = os.getenv('GEE_PROJECT_ID', '')

    # ── Method 1: Service Account (recommended for production) ──────────
    if key_path and os.path.exists(key_path) and account_email:
        try:
            credentials = ee.ServiceAccountCredentials(
                email=account_email,
                key_file=key_path
            )
            ee.Initialize(
                credentials=credentials,
                project=project_id or None
            )
            _initialized = True
            print('✅ GEE initialized via Service Account')
            print(f'   Account: {account_email}')
            return True
        except Exception as e:
            print(f'⚠️  Service Account auth failed: {e}')

    # ── Method 2: Interactive / stored credentials ───────────────────────
    try:
        ee.Initialize(project=project_id or None)
        _initialized = True
        print('✅ GEE initialized via stored credentials')
        return True
    except Exception:
        pass

    # ── Method 3: Trigger interactive login ──────────────────────────────
    try:
        print('🔑 Starting GEE interactive authentication...')
        print('   A browser window will open. Log in with your Google account.')
        ee.Authenticate()
        ee.Initialize(project=project_id or None)
        _initialized = True
        print('✅ GEE initialized via interactive login')
        return True
    except Exception as e:
        print(f'❌ GEE initialization failed: {e}')
        print('   Set USE_MOCK_SATELLITE=true in .env to use mock images')
        return False


def is_initialized() -> bool:
    return _initialized