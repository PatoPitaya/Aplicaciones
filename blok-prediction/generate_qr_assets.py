"""QR code generator for BLOK OPEN XXL.

Generates exclusively the 2 requested PNG assets:
1. qr_code_hires.png (High-resolution 2000x2000px, 300+ DPI, white background for printing)
2. qr_code_transparent.png (High-resolution 2000x2000px with transparent background)

Usage:
    python generate_qr_assets.py
    python generate_qr_assets.py --url https://blok-prediction.onrender.com
"""

import argparse
import qrcode
from PIL import Image

DEFAULT_URL = "https://blok-prediction.onrender.com"

def create_hires_qr(url: str, out_path: str = "qr_code_hires.png", size: int = 2000, border: int = 4) -> None:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=40,
        border=border,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#140d12", back_color="#ffffff").convert("RGBA")
    img = img.resize((size, size), Image.Resampling.NEAREST)
    img.save(out_path, "PNG")
    print(f"[OK] Saved High-Res QR: {out_path} ({size}x{size}px, 300 DPI ready)")

def create_transparent_qr(url: str, out_path: str = "qr_code_transparent.png", size: int = 2000, border: int = 4) -> None:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=40,
        border=border,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#140d12", back_color="transparent").convert("RGBA")
    img = img.resize((size, size), Image.Resampling.NEAREST)
    img.save(out_path, "PNG")
    print(f"[OK] Saved Transparent QR: {out_path} ({size}x{size}px)")

def main() -> None:
    parser = argparse.ArgumentParser(description="Generate official QR codes for BLOK OPEN XXL.")
    parser.add_argument("--url", default=DEFAULT_URL, help=f"Target event URL (default: {DEFAULT_URL})")
    args = parser.parse_args()

    print("\n==========================================")
    print(" BLOK OPEN XXL - QR CODE GENERATOR")
    print(f" Target URL: {args.url}")
    print("==========================================")

    create_hires_qr(args.url, out_path="qr_code_hires.png", size=2000, border=4)
    create_transparent_qr(args.url, out_path="qr_code_transparent.png", size=2000, border=4)

    print("\n[DONE] Successfully generated official QR assets:")
    print(" 1. qr_code_hires.png       -> 2000x2000px crisp PNG (white background)")
    print(" 2. qr_code_transparent.png -> 2000x2000px transparent PNG")
    print("==========================================\n")

if __name__ == "__main__":
    main()
