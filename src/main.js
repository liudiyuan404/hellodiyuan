import "@fontsource-variable/bricolage-grotesque/wght.css";
import "@fontsource/zcool-xiaowei/chinese-simplified-400.css";
import "@fontsource/noto-sans-sc/chinese-simplified-400.css";
import "@fontsource/noto-sans-sc/chinese-simplified-500.css";
import "@fontsource/noto-sans-sc/chinese-simplified-700.css";
import "@fontsource/noto-sans-sc/latin-400.css";
import "@fontsource/noto-sans-sc/latin-700.css";

const root = document.documentElement;

const setThemeColor = () => {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = dark ? "#101418" : "#d7e0da";
};

setThemeColor();
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", setThemeColor);

root.dataset.ready = "1";
