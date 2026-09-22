import numpy as np
from PIL import Image
import io
import base64

# Target size ResNet-50 expects
IMG_SIZE = (224, 224)

# ImageNet mean/std for normalization
# (ResNet-50 was trained on ImageNet so we use same stats)
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406])
IMAGENET_STD  = np.array([0.229, 0.224, 0.225])


def preprocess_image(image_bytes: bytes) -> np.ndarray:
    """
    Takes raw image bytes, returns normalized numpy array
    ready for ResNet-50 inference.

    Steps:
    1. Open image with PIL
    2. Convert to RGB (removes alpha channel if present)
    3. Resize to 224x224 (ResNet-50 input size)
    4. Normalize pixel values to 0-1
    5. Apply ImageNet mean/std normalization
    6. Add batch dimension → shape: (1, 224, 224, 3)
    """
    # Open image
    img = Image.open(io.BytesIO(image_bytes))

    # Convert to RGB (satellite images can be RGBA or grayscale)
    img = img.convert('RGB')

    # Resize to 224x224
    img = img.resize(IMG_SIZE, Image.LANCZOS)

    # Convert to numpy array, normalize 0-255 → 0.0-1.0
    img_array = np.array(img, dtype=np.float32) / 255.0

    # Apply ImageNet normalization
    img_array = (img_array - IMAGENET_MEAN) / IMAGENET_STD

    # Add batch dimension: (224, 224, 3) → (1, 224, 224, 3)
    img_array = np.expand_dims(img_array, axis=0)

    return img_array


def image_to_base64(image_bytes: bytes) -> str:
    """Convert image bytes to base64 string for API response"""
    return base64.b64encode(image_bytes).decode('utf-8')


def bytes_to_pil(image_bytes: bytes) -> Image.Image:
    """Convert bytes to PIL Image"""
    return Image.open(io.BytesIO(image_bytes))


def create_mock_satellite_image(lat: float, lng: float) -> bytes:
    """
    Creates a realistic-looking mock satellite image when
    Sentinel Hub is not configured. Used for development.
    
    Generates different colored images based on land type
    inferred from rough coordinate ranges.
    """
    img_array = np.zeros((256, 256, 3), dtype=np.uint8)

    # Simulate different land types based on coordinates
    # (very rough — just for development/demo)
    if lat > 25 and lng > 68 and lng < 97:
        # India region — mix of colors
        base_green = np.random.randint(60, 120)
        base_brown = np.random.randint(80, 140)

        # Add some variation to simulate real satellite texture
        img_array[:, :, 0] = base_brown + np.random.randint(0, 30, (256, 256))  # Red
        img_array[:, :, 1] = base_green + np.random.randint(0, 40, (256, 256))  # Green
        img_array[:, :, 2] = np.random.randint(30, 70, (256, 256))              # Blue
    else:
        # Generic land
        img_array[:, :, 0] = np.random.randint(100, 160, (256, 256))
        img_array[:, :, 1] = np.random.randint(120, 180, (256, 256))
        img_array[:, :, 2] = np.random.randint(60, 100, (256, 256))

    # Add some random texture patches to simulate buildings/fields
    for _ in range(np.random.randint(3, 8)):
        x = np.random.randint(0, 200)
        y = np.random.randint(0, 200)
        w = np.random.randint(10, 40)
        h = np.random.randint(10, 40)
        color = np.random.randint(50, 200, 3)
        img_array[y:y+h, x:x+w] = color

    img = Image.fromarray(img_array)
    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=85)
    return buf.getvalue()