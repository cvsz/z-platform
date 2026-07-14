package app

import (
	"slices"
	"strings"
	"testing"
)

func TestParseGlobalFlagsAfterCommand(t *testing.T) {
	o, cmd, args, err := parse([]string{"health", "--json", "--profile", "staging", "--wait"})
	if err != nil { t.Fatal(err) }
	if cmd != "health" || !o.json || o.profile != "staging" || !slices.Equal(args, []string{"--wait"}) {
		t.Fatalf("unexpected parse result: %+v %s %v", o, cmd, args)
	}
}

func TestProfilesGuardPurge(t *testing.T) {
	local, err := defaults("local"); if err != nil { t.Fatal(err) }
	production, err := defaults("production"); if err != nil { t.Fatal(err) }
	if !local.allowPurge || production.allowPurge { t.Fatal("invalid purge policy") }
}

func TestSplitServices(t *testing.T) {
	svc, flags, err := splitServices([]string{"--service", "ai-gateway", "--wait"})
	if err != nil { t.Fatal(err) }
	if !slices.Equal(svc, []string{"ai-gateway"}) || !slices.Equal(flags, []string{"--wait"}) { t.Fatalf("%v %v", svc, flags) }
}

func TestRejectUnknownFlag(t *testing.T) {
	if err := reject([]string{"--unsafe"}, "--wait"); err == nil { t.Fatal("expected rejection") }
}

func TestRedact(t *testing.T) {
	got := redact("request failed token=super-secret")
	if strings.Contains(got, "super-secret") { t.Fatalf("secret leaked: %s", got) }
}
