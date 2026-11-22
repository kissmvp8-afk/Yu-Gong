# Yu-Gong
Anthropic
Share and make it better

Super Agent 桌面软件的**公共模块库**。软件在规划一个需求之前，会先查这里有没有能直接复用的现成模块；用户做好的模块，经脱敏、本人
审核后可以提交到这里，**仓库主人审核通过、合并之后才对所有人可见**。

## 许可证

MIT（见 `LICENSE`）：模块一经合并，任何人都可以使用、修改和再分享。软件在分享前的页面和确认框里都会告诉用户这一点，合并请求的说明里
也写明“提交者同意按本仓库的 MIT 许可证公开”。

## 一个模块是怎么进来的

1. 用户在软件里点“分享到公共模块库…”。软件先自动去掉不能公开的文件（`.env`、密钥、证书、数据库、二进制文件），替换掉密钥、密码、
   邮箱、手机号、身份证号、IP 地址；再请检查代码的 AI 找出业务信息（人名、公司名、内部地址等）并替换；还像密钥的内容会阻止上传。
2. 用户看过脱敏后的全部内容，勾选“我看过了”，再在系统对话框里确认。
3. 软件用用户自己的 GitHub 账号，在这个仓库开一个合并请求，只新增一个文件 `modules/<编号>.json`。
4. 自动检查（`.github/workflows/modules.yml`）：只允许新增 `modules/m-<16 位>.json`；文件格式、编号（内容的 sha256）、路径、大小都
   要对；不能有像密钥或密码的内容。
5. **仓库主人审核**，通过后合并。合并后 `index.json` 自动重建，所有用户的软件在一小时内看到它。

## 仓库主人审核时看什么

* 打开文件，看 `files` 里的代码（base64 编码，可以用 `node -e` 解出来看；和用户在软件里分享前预览的是同样内容）。
* 有没有恶意代码：下载或执行外部程序、读取用户主目录、发网络请求到奇怪的地方、混淆过的代码。**这里的代码会被所有用户的 AI 拿来参考，
  宁可不收。**
* 有没有漏掉的隐私：真实姓名、公司、客户、内部网址、业务数据。
* 说明（name、summary）是否清楚，验收标准是否具体。

不合适的直接关掉合并请求；已经合并的模块要撤下，删掉 `modules/` 里的文件再提交（`index.json` 会自动更新）。

## 设置（一次）

* 仓库的 Actions 要打开；合并后的自动更新需要 GitHub Actions 能推送到 main（Settings → Actions → General → Workflow permissions 选
  “Read and write permissions”）。如果 main 开了“必须通过合并请求”的保护，需要把 GitHub Actions 加进例外，或者合并后自己运行一次
  `node build-index.mjs` 再提交 `index.json`。

## 文件格式

`modules/<id>.json`：

```json
{"format": 1, "id": "m-<内容 sha256 的前 16 位>", "name": "模块名称", "summary": "做什么（最多 300 字）",
 "tags": ["标签"], "criteria": ["验收标准"], "files": {"相对路径": "<base64>"}}
```

`index.json`：`{"format": 1, "modules": [{"id", "name", "summary", "tags", "path": "modules/<id>.json", "sha256": "<文件的 sha256>"}]}`。
软件下载模块后核对 sha256，对不上就不用。

## 本地检查

    node build-index.mjs --check   # 只检查
    node build-index.mjs           # 检查并重建 index.json

这些文件的来源是 Super Agent 仓库的 `module-library/`，两边要保持一致。
