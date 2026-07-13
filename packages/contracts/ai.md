# AI Contracts v1

## ai.chat.request.v1

```json
{"model":"string","messages":[{"role":"user","content":"string"}],"stream":true,"attachments":[{"id":"string","name":"string"}]}
```

## ai.file.uploaded.v1

```json
{"id":"string","name":"string","size_bytes":0}
```

Only the gateway may translate these platform contracts into provider-specific requests.
