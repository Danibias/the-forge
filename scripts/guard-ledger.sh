#!/usr/bin/env bash
# PreToolUse guard: the ledger is written through `forge-ledger patch`, never by
# hand. A direct Edit/Write succeeds even when the contents are wrong, and
# nothing surfaces the breakage — the CLI validates and reports instead.
#
# Reads the hook payload on stdin; denies only when the target is the ledger.
set -euo pipefail

LEDGER="${FORGE_HOME:-$HOME/.claude/forge}/ledger.json"

payload=$(cat)
target=$(printf '%s' "$payload" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')

[ -z "$target" ] && exit 0
[ "$target" != "$LEDGER" ] && exit 0

jq -n --arg path "$LEDGER" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: (
      "\($path) is written through the forge-ledger CLI, not by hand.\n\n" +
      "  forge-ledger patch '"'"'{\"field\": value}'"'"'\n\n" +
      "It validates against the §7 schema, writes atomically, and commits. " +
      "Send only the fields that changed; arrays replace wholesale. " +
      "Use `forge-ledger show --json` to read the current state."
    )
  }
}'
