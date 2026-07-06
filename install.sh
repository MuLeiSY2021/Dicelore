#!/usr/bin/env bash
# Copyright (C) 2026 MuLeiSY2021
#
# This file is part of Dicelore.
#
# Dicelore is free software: you can redistribute it and/or modify it under
# the terms of the GNU Affero General Public License as published by the Free
# Software Foundation, either version 3 of the License, or (at your option)
# any later version. See <https://www.gnu.org/licenses/>.
#
# eval 隔离启动器铺设脚本(仓库根、幂等)。
#
# 用法(在仓库根跑):
#   bash install.sh [-d|--dir <安装目录>]
#     -d/--dir <path>  数据根实例目录(默认 .dicelore-eval,相对仓库根)。
#
# 职责: 铺一个数据根 $ROOT 实例——
#   1. mkdir -p $ROOT
#   2. 从 harness/eval-setup/run.sh.tmpl 生成 $ROOT/run.sh(把仓库根路径烙进去)
#   3. 铺 $ROOT/config.toml([env] 预置 DICELORE_FAKE_GM="0" 等;已存在则不覆盖)
#   4. 把 $ROOT 加进 .gitignore(幂等;仅当 $ROOT 在仓库内)
# 不拷源码、不 npm install(复用仓库 node_modules)。幂等: 重复跑不炸、不覆盖已有 config.toml。

set -euo pipefail

DIR=".dicelore-eval"
while [ $# -gt 0 ]; do
  case "$1" in
    -d|--dir)
      [ $# -ge 2 ] || { echo "install.sh: $1 需要一个目录参数" >&2; exit 2; }
      DIR="$2"; shift 2 ;;
    -h|--help)
      sed -n '11,24p' "$0"; exit 0 ;;
    *) echo "install.sh: 未知参数 $1" >&2; exit 2 ;;
  esac
done

REPO_ROOT="$(git rev-parse --show-toplevel)"
TMPL="$REPO_ROOT/harness/eval-setup/run.sh.tmpl"
[ -f "$TMPL" ] || { echo "install.sh: 找不到模板 $TMPL" >&2; exit 1; }

# 解析 $ROOT 绝对路径(相对路径按 $PWD 展开)。
case "$DIR" in
  /*) ROOT="$DIR" ;;
  *)  ROOT="$PWD/$DIR" ;;
esac

# 1. 建数据根。
mkdir -p "$ROOT"

# 2. 生成 $ROOT/run.sh(烙入仓库根路径)。每次重铺以跟进模板更新;run.sh 本身无用户态。
esc_repo="$(printf '%s' "$REPO_ROOT" | sed 's/[&|\\]/\\&/g')"
sed "s|@@REPO_ROOT@@|$esc_repo|g" "$TMPL" > "$ROOT/run.sh"
chmod +x "$ROOT/run.sh"
echo "install.sh: 已生成 $ROOT/run.sh (repo=$REPO_ROOT)"

# 3. 铺最小 config.toml([env] 预置);已存在则保留用户改动,不覆盖。
CONFIG="$ROOT/config.toml"
if [ -f "$CONFIG" ]; then
  echo "install.sh: $CONFIG 已存在,跳过(不覆盖)"
else
  cat > "$CONFIG" <<'TOML'
# Dicelore eval 数据根配置。$ROOT = 本文件所在目录: catalog.db / keys.db / logs/ / sessions/ 均落此。
# 优先级: 真实进程 env > 本文件 [env]。敏感键(DICELORE_KEY_MASTER)只认真实 env,写这里会被忽略。
# 后端首次启动会在同目录铺一份带全量注释的 config.example.toml,可参照补键。

[env]
# 假 GM(不烧 LLM,回固定桩;eval/联调默认关,置 "1" 开启)。
DICELORE_FAKE_GM = "0"
# 监听端口(等价 PORT 环境变量;run.sh -p / 后端 --port 命令行最优先)。
# PORT = "8787"
# eval baseline: openingPrompt 去 doctrine + skills 全关(分离「教条有无」)。
# DICELORE_BASELINE = "0"
# 明骰降级: DiceSession 不注入 rollGate,core 立即掷(裸 CC / eval)。
# DICELORE_DEBUG = "0"
TOML
  echo "install.sh: 已铺 $CONFIG"
fi

# 4. 把 $ROOT 加进仓库 .gitignore(幂等;仅当 $ROOT 落在仓库内)。
GITIGNORE="$REPO_ROOT/.gitignore"
case "$ROOT/" in
  "$REPO_ROOT/"*)
    REL="${ROOT#$REPO_ROOT/}/"
    if [ -f "$GITIGNORE" ] && grep -qxF "$REL" "$GITIGNORE"; then
      echo "install.sh: .gitignore 已含 $REL,跳过"
    else
      # 追加前保证 .gitignore 以换行结尾,否则新条目会粘到最后一行(损坏+非幂等)。
      if [ -f "$GITIGNORE" ] && [ -s "$GITIGNORE" ] && [ -n "$(tail -c1 "$GITIGNORE")" ]; then
        printf '\n' >> "$GITIGNORE"
      fi
      printf '%s\n' "$REL" >> "$GITIGNORE"
      echo "install.sh: 已把 $REL 加进 .gitignore"
    fi
    ;;
  *)
    echo "install.sh: $ROOT 在仓库外,跳过 .gitignore"
    ;;
esac

echo "install.sh: 完成。下一步: cd $ROOT && bash run.sh -f"
