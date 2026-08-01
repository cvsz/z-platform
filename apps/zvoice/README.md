# ZVoice

`apps/zvoice` is the browser voice surface for the Z Platform realtime voice-agent stack.

It requests short-lived signed WebSocket tickets from `services/voice-gateway`, captures microphone audio with an AudioWorklet, sends 16 kHz PCM16 events using the OpenAI Realtime protocol, plays streaming response audio, and stops queued playback when the user interrupts.

The app never exposes `Z_PLATFORM_SERVICE_TOKEN` or provider keys to the browser. In production, place it behind Cloudflare Access or another approved identity boundary and set `ZVOICE_ALLOW_ANONYMOUS=false`.
