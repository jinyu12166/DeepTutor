from PIL import Image, ImageDraw
import os

out_dir = r"E:\new_project\DeepTutor\miniprogram\assets\icons"
os.makedirs(out_dir, exist_ok=True)

size = 81
gray = (153, 153, 153)
brand = (0, 105, 56)
white = (255, 255, 255)

# 简单图标绘制函数
def draw_home(draw, color):
    # 房子轮廓
    draw.polygon([(40, 15), (15, 38), (22, 38), (22, 60), (58, 60), (58, 38), (65, 38)], outline=color, width=4)
    draw.rectangle([34, 42, 46, 60], fill=color)

def draw_practice(draw, color):
    # 文档/练习本
    draw.rounded_rectangle([20, 15, 61, 66], radius=4, outline=color, width=4)
    draw.line([(28, 28), (53, 28)], fill=color, width=3)
    draw.line([(28, 38), (53, 38)], fill=color, width=3)
    draw.line([(28, 48), (43, 48)], fill=color, width=3)

def draw_report(draw, color):
    # 饼图
    draw.ellipse([18, 15, 62, 59], outline=color, width=4)
    draw.pieslice([18, 15, 62, 59], start=0, end=100, fill=color)

def draw_mine(draw, color):
    # 人形
    draw.ellipse([28, 14, 52, 38], outline=color, width=4)
    draw.arc([18, 42, 62, 70], start=0, end=180, fill=color, width=4)

icons = {
    "home": draw_home,
    "practice": draw_practice,
    "report": draw_report,
    "mine": draw_mine
}

for name, draw_func in icons.items():
    for suffix, color in [("", gray), ("-active", brand)]:
        img = Image.new("RGBA", (size, size), (255, 255, 255, 0))
        draw = ImageDraw.Draw(img)
        draw_func(draw, color)
        img.save(os.path.join(out_dir, f"{name}{suffix}.png"), "PNG")
        print(f"已生成: {name}{suffix}.png")
