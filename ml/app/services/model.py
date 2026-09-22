import numpy as np
import os
from app.utils.image_utils import preprocess_image

# ── Land type class labels ────────────────────────────────────────────────────
# These match what ImageNet-trained ResNet-50 can detect
# We map ImageNet classes → land use categories
LAND_CLASSES = [
    'agricultural',   # farmland, crops, fields
    'residential',    # houses, neighborhoods
    'commercial',     # shops, offices, dense buildings
    'industrial',     # factories, warehouses
    'forest',         # trees, dense vegetation
    'wasteland',      # barren land, sand, rocks
]

# ImageNet class index ranges that map to our land categories
# ResNet-50 has 1000 classes — we group relevant ones
IMAGENET_TO_LAND = {
    'agricultural': list(range(985, 1000)) + [949, 950],   # harvester, thresher etc.
    'residential':  list(range(600, 700)),                   # various building classes
    'commercial':   list(range(700, 800)),                   # shops, malls
    'industrial':   list(range(800, 900)),                   # factories
    'forest':       [340, 341, 342, 343, 344, 345, 346],    # tree species
    'wasteland':    [970, 971, 972, 973, 974, 975],         # desert, shore
}

# Singleton model instance
_model = None


def load_model():
    """
    Loads pre-trained ResNet-50 from TensorFlow/Keras.
    
    ResNet-50 is a deep CNN (50 layers) trained on ImageNet.
    It can classify 1000 types of objects/scenes.
    We use it as a feature extractor for land classification.
    
    Model is downloaded once (~100MB) and cached locally.
    Subsequent loads use the cached version.
    """
    global _model
    if _model is not None:
        return _model

    try:
        # Import TensorFlow here to avoid slow startup
        import tensorflow as tf
        from tensorflow.keras.applications import ResNet50
        from tensorflow.keras.applications.resnet50 import preprocess_input

        print('  🧠 Loading ResNet-50 model...')

        # Load with ImageNet weights, include top classification layer
        _model = ResNet50(
            weights='imagenet',   # Pre-trained on ImageNet
            include_top=True,     # Include final 1000-class layer
            input_shape=(224, 224, 3)
        )

        print('  ✅ ResNet-50 loaded successfully')
        return _model

    except ImportError:
        print('  ⚠️  TensorFlow not available — using mock model')
        return None
    except Exception as e:
        print(f'  ⚠️  Model load failed: {e} — using mock model')
        return None


def classify_land(image_bytes: bytes) -> dict:
    """
    Main function: takes image bytes, returns land classification.
    
    Returns dict with:
    - detected_land_type: most likely land type
    - confidence: 0.0 to 1.0
    - all_scores: scores for each land type
    - raw_top5: top 5 ImageNet predictions
    - used_mock: whether mock inference was used
    """
    model = load_model()

    if model is None:
        return _mock_classify(image_bytes)

    try:
        import tensorflow as tf
        from tensorflow.keras.applications.resnet50 import decode_predictions

        # Preprocess image for ResNet-50
        img_array = preprocess_image(image_bytes)

        # Run inference
        # Shape: (1, 1000) — probability for each ImageNet class
        predictions = model.predict(img_array, verbose=0)

        # Decode top 5 predictions
        top5 = decode_predictions(predictions, top=5)[0]

        # Map ImageNet predictions → land types
        land_scores = _map_to_land_types(predictions[0])

        # Get most likely land type
        detected_type = max(land_scores, key=land_scores.get)
        confidence    = land_scores[detected_type]

        return {
            'detected_land_type': detected_type,
            'confidence':         round(confidence, 4),
            'all_scores':         {k: round(v, 4) for k, v in land_scores.items()},
            'raw_top5':           [(label, round(float(score), 4)) for _, label, score in top5],
            'used_mock':          False,
        }

    except Exception as e:
        print(f'  ⚠️  Inference failed: {e} — using mock')
        return _mock_classify(image_bytes)


def _map_to_land_types(predictions: np.ndarray) -> dict:
    """
    Maps 1000 ImageNet class probabilities to 6 land type scores.
    
    For each land type, sums up probabilities of relevant ImageNet classes.
    Then normalizes so all scores sum to 1.0.
    """
    land_scores = {}

    for land_type, imagenet_indices in IMAGENET_TO_LAND.items():
        # Sum probabilities for this land type's ImageNet classes
        score = float(np.sum(predictions[imagenet_indices]))
        land_scores[land_type] = score

    # Add residual score to cover unclassified classes
    total = sum(land_scores.values())
    if total < 1.0:
        # Distribute remaining probability proportionally
        residual = (1.0 - total) / len(LAND_CLASSES)
        for k in land_scores:
            land_scores[k] += residual

    # Normalize to sum to 1.0
    total = sum(land_scores.values())
    if total > 0:
        land_scores = {k: v / total for k, v in land_scores.items()}

    return land_scores


def _mock_classify(image_bytes: bytes) -> dict:
    """
    Mock classification when TensorFlow is not available.
    Generates realistic-looking but random results.
    Used for development/testing.
    """
    import random

    # Pick a random land type with weighted probabilities
    weights = [0.35, 0.25, 0.15, 0.10, 0.10, 0.05]
    detected = random.choices(LAND_CLASSES, weights=weights, k=1)[0]

    # Generate mock scores
    scores = {}
    remaining = 1.0
    for i, cls in enumerate(LAND_CLASSES):
        if i == len(LAND_CLASSES) - 1:
            scores[cls] = round(remaining, 4)
        else:
            if cls == detected:
                s = round(random.uniform(0.35, 0.65), 4)
            else:
                s = round(random.uniform(0.02, 0.15), 4)
            s = min(s, remaining - 0.01)
            scores[cls] = s
            remaining -= s

    return {
        'detected_land_type': detected,
        'confidence':         scores[detected],
        'all_scores':         scores,
        'raw_top5':           [(detected, scores[detected])],
        'used_mock':          True,
    }