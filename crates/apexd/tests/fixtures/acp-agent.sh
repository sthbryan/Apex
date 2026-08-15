#!/bin/sh
notify() {
  printf '{"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"s-1","update":%s}}\n' "$1"
}

while IFS= read -r line; do
  id=$(printf '%s' "$line" | sed -n 's/.*"id":\([0-9]*\).*/\1/p')
  case "$line" in
    *'"initialize"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"protocolVersion":1,"agentInfo":{"name":"fake","version":"0"}}}\n' "$id"
      ;;
    *'"session/new"'*)
      printf '%s\n' "$line" > ./session-new.json
      printf '{"jsonrpc":"2.0","id":%s,"result":{"sessionId":"s-1","models":{"currentModelId":"fast","availableModels":[{"modelId":"fast","name":"Fast"},{"modelId":"deep","name":"Deep"}]}}}\n' "$id"
      notify '{"sessionUpdate":"available_commands_update","availableCommands":[{"name":"compact","description":"Shrink the context"}]}'
      ;;
    *'"session/set_model"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":null}\n' "$id"
      ;;
    *'"session/prompt"'*)
      case "$line" in
        *walk\ out*) exit 3 ;;
      esac
      notify '{"sessionUpdate":"agent_message_chunk","content":{"type":"text","text":"on it"}}'
      notify '{"sessionUpdate":"tool_call","toolCallId":"c1","title":"Edit hello.txt","kind":"edit","status":"in_progress","content":[{"type":"diff","path":"/tmp/hello.txt","oldText":"one","newText":"two"}]}'
      printf '{"jsonrpc":"2.0","id":100,"method":"session/request_permission","params":{"sessionId":"s-1","toolCall":{"toolCallId":"c1","title":"Edit hello.txt"},"options":[{"optionId":"allow_once","name":"Allow once","kind":"allow_once"}]}}\n'
      IFS= read -r answer
      case "$answer" in
        *'allow_once'*)
          notify '{"sessionUpdate":"tool_call_update","toolCallId":"c1","status":"completed"}'
          ;;
      esac
      printf '{"jsonrpc":"2.0","id":%s,"result":{"stopReason":"end_turn"}}\n' "$id"
      ;;
  esac
done
