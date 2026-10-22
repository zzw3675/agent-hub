# agent-hub

给多个 AI Agent 用的轻量共享数据交换间：一个跑在 Cloudflare Workers + KV 上的极简 HTTP 服务，让不同的 Agent（或脚本、工具）通过统一接口交换键值数据和文件。

没有服务器、没有数据库要维护，部署完就是一个网址 + 一把钥匙，谁连上谁就能用。

## 接口

| 方法与路径 | 说明 |
| --- | --- |
| `PUT /kv/<key>` | 存键值：请求体即值（文本/JSON 均可） |
| `GET /kv/<key>` | 取键值：不存在返回 404 |
| `DELETE /kv/<key>` | 删除键 |
| `GET /kv` | 列出全部键 |
| `PUT /files/<name>` | 上传文件：请求体为文件原始字节 |
| `GET /files/<name>` | 下载文件 |
| `DELETE /files/<name>` | 删除文件 |
| `GET /files` | 列出全部文件 |
| `GET /` | 服务自述与接口清单（免鉴权） |

限制：单值上限 25MB（Cloudflare KV 的单值上限）；列表接口一次最多返回 1000 条。

## 鉴权

除根路径外，所有接口都要带共享 API 钥匙，二选一：

- 请求头 `Authorization: Bearer <你的钥匙>`
- 请求头 `X-API-Key: <你的钥匙>`

钥匙由部署者自备，存放在 Worker 的 Secret `API_KEYS` 里（支持英文逗号分隔多把，任一命中即放行）。**不要把真实钥匙写进代码或提交到仓库。**

## 部署

需要一个 Cloudflare 账号和 [wrangler](https://developers.cloudflare.com/workers/wrangler/)。

```bash
# 1. 登录并创建 KV 命名空间
npx wrangler login
npx wrangler kv namespace create HUB

# 2. 准备配置：把上一步得到的命名空间 id 填进去
cp wrangler.toml.example wrangler.toml
# 编辑 wrangler.toml，把 YOUR_KV_ID 换成真实 id（wrangler.toml 已在 .gitignore 中，不会被提交）

# 3. 设置共享钥匙（按提示输入你自备的钥匙字符串）
npx wrangler secret put API_KEYS

# 4. 部署
npx wrangler deploy
```

也可以不用命令行：把 `worker.js` 粘贴到 Cloudflare 控制台的 Worker 在线编辑器，在控制台里绑定一个 KV 命名空间（变量名必须是 `HUB`），再添加 Secret `API_KEYS`，效果一样。

部署完成后可选绑定自己的域名（Workers 的自定义域），不绑也能用 Cloudflare 分配的 `*.workers.dev` 地址。

## 使用示例

```bash
HUB=https://你的地址
KEY=你的钥匙

# 存一个键值
curl -X PUT "$HUB/kv/alice-note" -H "Authorization: Bearer $KEY" -d "明天上午交周报"

# 取回来
curl "$HUB/kv/alice-note" -H "Authorization: Bearer $KEY"

# 上传 / 下载文件
curl -X PUT "$HUB/files/bob-report.txt" -H "Authorization: Bearer $KEY" --data-binary @report.txt
curl "$HUB/files/bob-report.txt" -H "Authorization: Bearer $KEY" -o report.txt

# 看看现在都有什么
curl "$HUB/kv" -H "Authorization: Bearer $KEY"
curl "$HUB/files" -H "Authorization: Bearer $KEY"
```

## 使用约定

- **各 Agent 用自己的名字做前缀**（如 `xiaojia-`、`bob-`），键和文件名都算，避免互相覆盖、误删。
- 内部实现细节：KV 里键值存于 `kv:` 前缀、文件存于 `file:` 前缀，接口层自动处理，使用者无需关心。
- 这里只适合放**不重要的共享数据**：共享钥匙意味着持有钥匙的人人人可读，不要存密码、凭据等机密信息。
- KV 是最终一致存储：刚写入的值在全球节点同步最长可能需要约 60 秒，别拿它当强一致数据库用。

## License

MIT
