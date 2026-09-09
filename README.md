# hellodiyuan.xin

刘迪远的个人介绍页。静态站，不需要自己的服务器。

## 本地预览

```bash
npm install
npm run dev
```

浏览器打开终端里给出的地址，一般是 `http://127.0.0.1:5173`。

## 改文案和邮箱

打开 `index.html`：

- 自我介绍在「最近」和中间那一段
- 邮箱在 `#write` 里的 `mailto:` 和可见文字，两处一起改

照片放在 `public/images/`，文件名保持不变就能直接替换。

## 发布到网上并绑域名

仓库：https://github.com/liudiyuan404/hellodiyuan  
临时地址：https://liudiyuan404.github.io/hellodiyuan/

推到 `main` 后，GitHub Actions 会自动构建并发布。

绑定 `hellodiyuan.xin`：

1. 仓库 Settings → Pages → Custom domain 填 `hellodiyuan.xin`
2. 在域名注册商处把 DNS 指到 `liudiyuan404.github.io`

如果域名买在阿里云 / 腾讯云，最省事的做法：

1. 把域名的 DNS 服务器改成 Cloudflare 给你的那两行 NS
2. 等生效后，在 Pages 里添加 `hellodiyuan.xin`
3. Cloudflare 会自动配 HTTPS

还没有配 `hello@hellodiyuan.xin` 时，先把页面上的邮箱改成你正在用的那个。域名邮箱可以以后再在注册商那里做转发。
