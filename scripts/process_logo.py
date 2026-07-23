from PIL import Image
import os

src = r"E:\new_project\DeepTutor\和平树调色logo.png"
out_dir = r"E:\new_project\DeepTutor\miniprogram\assets\images"
os.makedirs(out_dir, exist_ok=True)

img = Image.open(src).convert("RGBA")
print(f"原始尺寸: {img.size}")

# 先裁剪掉最外层的深色细边框（约 15-20px）
crop_margin = 20
w, h = img.size
img = img.crop((crop_margin, crop_margin, w - crop_margin, h - crop_margin))
width, height = img.size
print(f"去边框后尺寸: {img.size}")

# 创建二值掩码：白色背景为 0，非白色为 1
mask = [[1 for _ in range(width)] for _ in range(height)]
pixels = img.load()
white_count = 0
for y in range(height):
    for x in range(width):
        r, g, b, a = pixels[x, y]
        # 白边判定：RGB 均接近 255（保留内部白色文字/花瓶，只处理连通到边界的背景）
        if r > 240 and g > 240 and b > 240:
            mask[y][x] = 0
            white_count += 1
print(f"白色像素数: {white_count}")

# 从四边开始 flood fill，标记连通到边界的白色为背景
from collections import deque
visited = [[False for _ in range(width)] for _ in range(height)]
queue = deque()

for x in range(width):
    queue.append((x, 0))
    queue.append((x, height - 1))
for y in range(height):
    queue.append((0, y))
    queue.append((width - 1, y))

while queue:
    x, y = queue.popleft()
    if x < 0 or x >= width or y < 0 or y >= height:
        continue
    if visited[y][x]:
        continue
    if mask[y][x] == 1:
        continue
    visited[y][x] = True
    queue.append((x - 1, y))
    queue.append((x + 1, y))
    queue.append((x, y - 1))
    queue.append((x, y + 1))

# 将连通边界的白色像素转为透明
visited_count = 0
for y in range(height):
    for x in range(width):
        if visited[y][x]:
            pixels[x, y] = (255, 255, 255, 0)
            visited_count += 1
print(f"已标记为背景透明的像素数: {visited_count}")

# 检测非透明内容区域
left, top, right, bottom = width, height, 0, 0
for y in range(height):
    for x in range(width):
        _, _, _, a = pixels[x, y]
        if a > 10:
            left = min(left, x)
            top = min(top, y)
            right = max(right, x)
            bottom = max(bottom, y)

cropped = img.crop((left, top, right + 1, bottom + 1))
print(f"裁剪后尺寸: {cropped.size}")

# 保存去白边原图
cropped_path = os.path.join(out_dir, "logo.png")
cropped.save(cropped_path, "PNG")
print(f"已保存: {cropped_path}")

# 品牌主色（取自 logo 绿色背景）
BRAND_GREEN = (0, 105, 56)

def make_square_icon(src_img, size, bg_color=BRAND_GREEN):
    """将 logo 居中缩放后放入正方形画布，保持比例，背景填充品牌绿。"""
    canvas = Image.new("RGBA", (size, size), bg_color + (255,))
    # 按短边比例缩放，留边距
    margin = int(size * 0.08)
    avail = size - 2 * margin
    src_w, src_h = src_img.size
    scale = avail / max(src_w, src_h)
    new_w, new_h = int(src_w * scale), int(src_h * scale)
    scaled = src_img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    x = (size - new_w) // 2
    y = (size - new_h) // 2
    canvas.paste(scaled, (x, y), scaled)
    return canvas

# 生成小程序图标尺寸
sizes = {
    "logo_144.png": (144, 144),   # 小程序 App 图标
    "logo_81.png": (81, 81),      # 页面内/启动页图标参考
    "logo_40.png": (40, 40),      # 页面内小图标
}

for name, size in sizes.items():
    icon = make_square_icon(cropped, size[0])
    icon.save(os.path.join(out_dir, name), "PNG")
    print(f"已生成: {name} {size}")

# 同时保存透明原图用于页面内展示
cropped.save(os.path.join(out_dir, "logo_transparent.png"), "PNG")
print(f"已保存透明原图: logo_transparent.png")
