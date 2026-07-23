/**
 * 简单 LaTeX / Markdown 转 HTML（用于微信小程序 rich-text）
 *
 * 仅做基础渲染：
 * - 行内 $...$、\(...\) 用数学样式包裹
 * - 块级 $$...$$、\[...\] 用块级数学样式包裹
 * - 简单上标 x^2 → x<sup>2</sup>、下标 x_1 → x<sub>1</sub>
 * - 简单分数 \frac{a}{b} → (a)/(b)
 * - Markdown 粗体 **...**、斜体 *...*
 *
 * 复杂公式仍按原文可读展示，不依赖外部渲染服务。
 */

const MATH_STYLE = 'font-family: "Courier New", monospace; color: #006938; background: #F0F7F4; padding: 2rpx 6rpx; border-radius: 4rpx;';
const BLOCK_MATH_STYLE = 'display: block; font-family: "Courier New", monospace; color: #006938; background: #F0F7F4; padding: 16rpx; margin: 12rpx 0; border-radius: 8rpx; white-space: pre-wrap;';

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderSimpleMath(latex) {
  // 简单上标：x^2, a^{bc}（仅一层大括号）
  let out = latex.replace(/(\w)\^\{([^}]+)\}/g, '$1<sup>$2</sup>');
  out = out.replace(/(\w)\^(\w)/g, '$1<sup>$2</sup>');
  // 简单下标
  out = out.replace(/(\w)_\{([^}]+)\}/g, '$1<sub>$2</sub>');
  out = out.replace(/(\w)_(\w)/g, '$1<sub>$2</sub>');
  // 简单分数
  out = out.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)');
  // 常用符号替换
  out = out.replace(/\\times/g, '×')
           .replace(/\\div/g, '÷')
           .replace(/\\pm/g, '±')
           .replace(/\\le(?!t)/g, '≤')
           .replace(/\\ge/g, '≥')
           .replace(/\\ne/g, '≠')
           .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
           .replace(/\\sqrt\[(\d+)\]\{([^}]+)\}/g, '<sup>$1</sup>√($2)')
           .replace(/\\pi/g, 'π')
           .replace(/\\alpha/g, 'α')
           .replace(/\\beta/g, 'β')
           .replace(/\\theta/g, 'θ')
           .replace(/\\Delta/g, 'Δ')
           .replace(/\\rightarrow/g, '→')
           .replace(/\\infty/g, '∞')
           .replace(/\\angle/g, '∠')
           .replace(/\\degree/g, '°')
           .replace(/\\%/g, '%');
  return out;
}

function wrapInlineMath(latex) {
  const rendered = renderSimpleMath(escapeHtml(latex));
  return `<span style="${MATH_STYLE}">${rendered}</span>`;
}

function wrapBlockMath(latex) {
  const rendered = renderSimpleMath(escapeHtml(latex));
  return `<div style="${BLOCK_MATH_STYLE}">${rendered}</div>`;
}

function processMarkdown(text) {
  if (!text) return '';

  // 转义 HTML 特殊字符（后续再处理数学块）
  let html = escapeHtml(text);

  // 块级数学 $$...$$
  html = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, expr) => {
    return wrapBlockMath(expr.trim());
  });

  // 块级数学 \[...\]
  html = html.replace(/\\\[([\s\S]*?)\\\]/g, (match, expr) => {
    return wrapBlockMath(expr.trim());
  });

  // 行内数学 \(...\)
  html = html.replace(/\\\(([\s\S]*?)\\\)/g, (match, expr) => {
    return wrapInlineMath(expr.trim());
  });

  // 行内数学 $...$（注意避免匹配已处理的 $$）
  html = html.replace(/(?<!\$)\$([^$\n]+?)\$(?!\$)/g, (match, expr) => {
    return wrapInlineMath(expr.trim());
  });

  // Markdown 粗体
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Markdown 斜体（排除已转义的粗体标签）
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // 换行
  html = html.replace(/\n/g, '<br/>');

  return html;
}

module.exports = {
  processMarkdown,
  renderSimpleMath,
  escapeHtml
};
