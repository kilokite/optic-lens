# optic-lens 光学透镜滤镜

[English](README.md) | 中文

[![npm version](https://img.shields.io/npm/v/optic-lens.svg)](https://www.npmjs.com/package/optic-lens)

<p align="center">
  <img src="./logo/logo.svg" alt="optic-lens logo"/>
</p>

为前端提供光学透镜风味滤镜效果。支持多种滤镜如液态玻璃、鱼眼、放大镜等。

可单独生成滤镜效果、集成至页面元素、或直接创建可拖动的元素。

支持自定义尺寸、曲率、圆角、边缘柔化、色散、调试模式和拖拽等多种参数。

**在线演示：** [http://optic.play.kt.sb/](http://optic.play.kt.sb/)

## 支持的滤镜

TODO：部分滤镜目前并未完全实现，参数效果与实际效果请参考 demo。

TODO：Vue/React/Solid 开箱即用组件支持。

| 名称 | 中文说明 | 支持参数 | 典型效果 |
|------|----------|----------|----------|
| Glass | 液态玻璃 | width, height, radius, depth, blurAmount | 模拟真实玻璃景深、局部模糊 |
| Fisheye | 鱼眼 | width, height, borderRadius, curvature | 中心突起变形，鱼眼视角 |
| Cylindrical | 柱面 | width, height, borderRadius, curvature, axis | 横向/纵向柱面弯曲 |
| Spherical | 球面 | width, height, borderRadius, curvature, edgeSoftness, chromaticAberration | 全方位球面高斯形变/色差 |
| Magnifier / Reading Glass | 放大镜 | width, height, borderRadius, magnification | 局部放大镜效果 |
| Prism | 棱镜 | width, height, borderRadius, orientation, intensity, dispersion, blurAmount | 变形/反射/色散 |
| Kaleidoscope | 万花筒 | width, height, segments, borderRadius | 万花筒特殊效果 |
| Random Filter | 随机扰动 | width, height, intensity, grain | 背景随机打乱 |

每类滤镜均可通过参数自定义形状、强度、边缘过渡，并支持调试（显示位移图）和拖拽。

## 快速上手

安装：

```bash
npm install optic-lens
```

使用示例：

### 1. 单独生成滤镜效果

生成滤镜 SVG filter URL，可用于自定义应用：

```typescript
import { Glass, FisheyeLens } from "optic-lens";

// 生成滤镜效果 URL
const filterUrl = Glass.createFilter({
  width: 300,
  height: 200,
  radius: 20,
  depth: 12,
  strength: 100,
});

// 应用到元素
const element = document.querySelector('.my-element');
element.style.filter = `url('${filterUrl}')`;
```

### 2. 集成至页面元素

将滤镜效果应用到现有的 DOM 元素：

```typescript
import { Glass, FisheyeLens } from "optic-lens";

// 应用到现有元素
const existingElement = document.querySelector('.my-element');
Glass.apply(existingElement, {
  width: 300,
  height: 200,
  radius: 20,
  depth: 12,
  strength: 100,
  blur: 3,
});
```

### 3. 直接创建可拖动的元素

创建带有拖拽功能的滤镜元素：

```typescript
import { Glass, FisheyeLens } from "optic-lens";

// 创建可拖动的玻璃滤镜元素
const glassEl = Glass.createDraggable({
  width: 300,
  height: 200,
  radius: 20,
  depth: 12,
  strength: 100,
  initialX: 80,  // 初始位置 X
  initialY: 120, // 初始位置 Y
});

document.body.appendChild(glassEl);

// 创建可拖动的鱼眼滤镜元素
const fisheyeEl = FisheyeLens.createDraggable({
  width: 220,
  height: 220,
  borderRadius: '50%',
  distortion: 1.5,
  edgeSoftness: 0.2,
});

document.body.appendChild(fisheyeEl);
```
