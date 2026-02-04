import sys
try:
    from PIL import Image, ImageDraw
except ImportError:
    print("Pillow library not found. Please install it using 'pip install Pillow'", file=sys.stderr)
    sys.exit(1)

# Image dimensions for 16:9 aspect ratio
width, height = 1600, 900
image = Image.new("RGB", (width, height), "white")
draw = ImageDraw.Draw(image)

# Calculate coordinates for a centered blue square
square_size = 600
x_start = (width - square_size) // 2
y_start = (height - square_size) // 2
x_end = x_start + square_size
y_end = y_start + square_size

draw.rectangle([x_start, y_start, x_end, y_end], fill="blue")

image.save("test.png")
print("Image 'test.png' generated successfully.")
