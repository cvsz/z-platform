cloudflare_account_id = "9afd03fff02846b4ca89caeff350ce56"
cloudflare_zone_id    = "92d9bfd6cbe3c327519d520e56268cba"
cloudflare_tunnel_id  = "45667e7e-7383-4265-b53e-6a9e770a8554"

app_routes = {
  phase6 = {
    app_id       = "phase6-api"
    hostname     = "api6.zeaz.dev"
    origin       = "http://phase6-api:8080"
    port         = 8080
    role         = "phase6-readiness"
    status       = "active"
    health_path  = "/health"
  }
}
